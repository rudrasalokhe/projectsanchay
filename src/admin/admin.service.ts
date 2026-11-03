import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Role, RecyclerRegistrationStatus, ListingStatus, TransactionStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getDashboard() {
    const [
      users,
      listings,
      transactions,
      manifests,
      pendingRecyclers,
      recentLogs,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.wasteListing.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.transaction.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.digitalManifest.findMany({
        select: {
          actualWeightKg: true,
          totalAmount: true,
          platformFee: true,
        },
      }),
      this.prisma.recyclerProfile.count({
        where: { registrationStatus: RecyclerRegistrationStatus.PENDING },
      }),
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, fullName: true, email: true, role: true } },
        },
      }),
    ]);

    let totalDocumentedWeightKg = 0;
    let totalGrossValue = 0;
    let totalPlatformFees = 0;

    for (const m of manifests) {
      totalDocumentedWeightKg += Number(m.actualWeightKg);
      totalGrossValue += Number(m.totalAmount);
      totalPlatformFees += Number(m.platformFee);
    }

    const userRoleCounts = users.reduce((acc, curr) => {
      acc[curr.role] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    const listingStatusCounts = listings.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    const transactionStatusCounts = transactions.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    return {
      platformMetrics: {
        totalDocumentedWeightKg: Number(totalDocumentedWeightKg.toFixed(2)),
        totalGrossTransactionValue: Number(totalGrossValue.toFixed(2)),
        totalPlatformFeesCollected: Number(totalPlatformFees.toFixed(2)),
        totalManifestsGenerated: manifests.length,
        pendingRecyclerApprovals: pendingRecyclers,
      },
      userBreakdown: {
        total: users.reduce((sum, u) => sum + u._count.id, 0),
        collectors: userRoleCounts[Role.COLLECTOR] || 0,
        recyclers: userRoleCounts[Role.RECYCLER] || 0,
        brands: userRoleCounts[Role.BRAND] || 0,
        admins: userRoleCounts[Role.ADMIN] || 0,
      },
      listingBreakdown: {
        available: listingStatusCounts[ListingStatus.AVAILABLE] || 0,
        reserved: listingStatusCounts[ListingStatus.RESERVED] || 0,
        completed: listingStatusCounts[ListingStatus.COMPLETED] || 0,
        cancelled: listingStatusCounts[ListingStatus.CANCELLED] || 0,
      },
      transactionBreakdown: {
        pendingHandover: transactionStatusCounts[TransactionStatus.PENDING_HANDOVER] || 0,
        partiallyConfirmed: transactionStatusCounts[TransactionStatus.PARTIALLY_CONFIRMED] || 0,
        handoverVerified: transactionStatusCounts[TransactionStatus.HANDOVER_VERIFIED] || 0,
        cancelled: transactionStatusCounts[TransactionStatus.CANCELLED] || 0,
        disputed: transactionStatusCounts[TransactionStatus.DISPUTED] || 0,
      },
      recentAuditLogs: recentLogs,
    };
  }

  async getUsers(query: PaginationDto) {
    const [total, items] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          organizationName: true,
          city: true,
          state: true,
          createdAt: true,
          updatedAt: true,
          recyclerProfile: true,
        },
      }),
    ]);

    return {
      total,
      page: query.page || 1,
      limit: query.limit || 10,
      totalPages: Math.ceil(total / (query.limit || 10)),
      items,
    };
  }

  async getPendingRecyclers() {
    return this.prisma.recyclerProfile.findMany({
      where: { registrationStatus: RecyclerRegistrationStatus.PENDING },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            city: true,
            state: true,
            organizationName: true,
          },
        },
      },
    });
  }

  async approveRecycler(profileId: string, adminId: string) {
    const profile = await this.prisma.recyclerProfile.findUnique({
      where: { id: profileId },
      include: { user: true },
    });

    if (!profile) {
      throw new NotFoundException(`Recycler profile with ID ${profileId} not found`);
    }

    const updated = await this.prisma.recyclerProfile.update({
      where: { id: profileId },
      data: {
        registrationStatus: RecyclerRegistrationStatus.APPROVED,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
    });

    await this.auditLogsService.log({
      actorId: adminId,
      entityType: 'RECYCLER_PROFILE',
      entityId: profileId,
      action: 'RECYCLER_APPROVED',
      previousStatus: profile.registrationStatus,
      newStatus: RecyclerRegistrationStatus.APPROVED,
      metadata: { recyclerUserId: profile.userId, companyName: profile.companyName },
    });

    return {
      message: 'Recycler verification application approved',
      profile: updated,
    };
  }

  async rejectRecycler(profileId: string, adminId: string) {
    const profile = await this.prisma.recyclerProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException(`Recycler profile with ID ${profileId} not found`);
    }

    const updated = await this.prisma.recyclerProfile.update({
      where: { id: profileId },
      data: {
        registrationStatus: RecyclerRegistrationStatus.REJECTED,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
    });

    await this.auditLogsService.log({
      actorId: adminId,
      entityType: 'RECYCLER_PROFILE',
      entityId: profileId,
      action: 'RECYCLER_REJECTED',
      previousStatus: profile.registrationStatus,
      newStatus: RecyclerRegistrationStatus.REJECTED,
      metadata: { recyclerUserId: profile.userId },
    });

    return {
      message: 'Recycler verification application rejected',
      profile: updated,
    };
  }

  async getListings(query: PaginationDto) {
    const [total, items] = await Promise.all([
      this.prisma.wasteListing.count(),
      this.prisma.wasteListing.findMany({
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          collector: {
            select: { id: true, fullName: true, organizationName: true, phone: true, city: true, state: true },
          },
        },
      }),
    ]);

    return {
      total,
      page: query.page || 1,
      limit: query.limit || 10,
      totalPages: Math.ceil(total / (query.limit || 10)),
      items,
    };
  }

  async getTransactions(query: PaginationDto) {
    const [total, items] = await Promise.all([
      this.prisma.transaction.count(),
      this.prisma.transaction.findMany({
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: true,
          collector: { select: { id: true, fullName: true, organizationName: true } },
          recycler: { select: { id: true, fullName: true, organizationName: true } },
          manifest: { select: { id: true, manifestNumber: true, publicToken: true } },
        },
      }),
    ]);

    return {
      total,
      page: query.page || 1,
      limit: query.limit || 10,
      totalPages: Math.ceil(total / (query.limit || 10)),
      items,
    };
  }

  async getManifests(query: PaginationDto) {
    const [total, items] = await Promise.all([
      this.prisma.digitalManifest.count(),
      this.prisma.digitalManifest.findMany({
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          brandAccess: {
            include: {
              brand: { select: { id: true, fullName: true, organizationName: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: query.page || 1,
      limit: query.limit || 10,
      totalPages: Math.ceil(total / (query.limit || 10)),
      items,
    };
  }

  async associateBrandWithManifest(brandId: string, manifestId: string, adminId: string) {
    const brand = await this.prisma.user.findUnique({
      where: { id: brandId },
    });

    if (!brand || brand.role !== Role.BRAND) {
      throw new BadRequestException('Target user does not exist or does not possess the BRAND role');
    }

    const manifest = await this.prisma.digitalManifest.findUnique({
      where: { id: manifestId },
    });

    if (!manifest) {
      throw new NotFoundException(`Manifest with ID ${manifestId} not found`);
    }

    const existingAccess = await this.prisma.brandManifestAccess.findUnique({
      where: {
        brandId_manifestId: {
          brandId,
          manifestId,
        },
      },
    });

    if (existingAccess) {
      return {
        message: 'Manifest is already associated with this brand',
        access: existingAccess,
      };
    }

    const access = await this.prisma.brandManifestAccess.create({
      data: {
        brandId,
        manifestId,
        grantedBy: adminId,
      },
    });

    await this.auditLogsService.log({
      actorId: adminId,
      entityType: 'BRAND_MANIFEST_ACCESS',
      entityId: access.id,
      action: 'BRAND_ACCESS_GRANTED',
      metadata: { brandId, manifestId, manifestNumber: manifest.manifestNumber },
    });

    return {
      message: 'Manifest successfully associated with brand account',
      access,
    };
  }

  async getAuditLogs(query: PaginationDto) {
    return this.auditLogsService.findAll({
      skip: query.skip,
      take: query.limit,
    });
  }
}

