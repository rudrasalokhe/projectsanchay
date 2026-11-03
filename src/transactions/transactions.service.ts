import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ListingStatus, TransactionStatus, Role, RecyclerRegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ManifestsService } from '../manifests/manifests.service';
import { AcceptListingDto } from './dto/accept-listing.dto';
import { RecordWeightDto } from './dto/record-weight.dto';
import { AddEvidenceDto } from './dto/add-evidence.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { DisputeTransactionDto } from './dto/dispute-transaction.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    private readonly manifestsService: ManifestsService,
  ) {}

  async acceptListing(listingId: string, recyclerId: string, dto?: AcceptListingDto) {
    const recycler = await this.prisma.user.findUnique({
      where: { id: recyclerId },
      include: { recyclerProfile: true },
    });

    if (!recycler) {
      throw new NotFoundException('Recycler account not found');
    }

    if (recycler.role !== Role.RECYCLER && recycler.role !== Role.ADMIN) {
      throw new ForbiddenException('Only verified recyclers or admins can accept waste listings');
    }

    // Verify recycler status
    if (
      recycler.role === Role.RECYCLER &&
      recycler.recyclerProfile?.registrationStatus !== RecyclerRegistrationStatus.APPROVED
    ) {
      throw new ForbiddenException(
        'Recycler profile is currently pending administrator verification or rejected. Only approved recyclers may accept listings.',
      );
    }

    // Database transaction with atomic check-and-reserve concurrency control
    const transaction = await this.prisma.$transaction(async (tx) => {
      const listing = await tx.wasteListing.findUnique({
        where: { id: listingId },
      });

      if (!listing) {
        throw new NotFoundException(`Listing with ID ${listingId} not found`);
      }

      if (listing.collectorId === recyclerId) {
        throw new BadRequestException('Collectors cannot accept their own listings');
      }

      if (listing.status !== ListingStatus.AVAILABLE) {
        throw new BadRequestException(
          `Listing is no longer available for acceptance (current status: ${listing.status})`,
        );
      }

      // Transition listing status to RESERVED
      await tx.wasteListing.update({
        where: { id: listingId },
        data: { status: ListingStatus.RESERVED },
      });

      const agreedPricePerKg = dto?.agreedPricePerKg
        ? new Prisma.Decimal(dto.agreedPricePerKg)
        : listing.expectedPricePerKg;

      const feePerKg = new Prisma.Decimal(
        this.configService.get<number>('platformFeePerKg') || 2,
      );
      const estWeight = listing.estimatedWeightKg;
      const initialTotal = estWeight.mul(agreedPricePerKg);
      const initialFee = estWeight.mul(feePerKg);

      const createdTransaction = await tx.transaction.create({
        data: {
          listingId,
          collectorId: listing.collectorId,
          recyclerId,
          agreedPricePerKg,
          actualWeightKg: estWeight, // Initialized with estimated, refined upon physical weighing
          totalAmount: initialTotal,
          platformFee: initialFee,
          status: TransactionStatus.PENDING_HANDOVER,
        },
        include: {
          listing: true,
          collector: {
            select: { id: true, fullName: true, phone: true, organizationName: true, city: true, state: true },
          },
          recycler: {
            select: { id: true, fullName: true, phone: true, organizationName: true, city: true, state: true },
          },
        },
      });

      return createdTransaction;
    });

    await this.auditLogsService.log({
      actorId: recyclerId,
      entityType: 'TRANSACTION',
      entityId: transaction.id,
      action: 'TRANSACTION_ACCEPTED',
      newStatus: TransactionStatus.PENDING_HANDOVER,
      metadata: {
        listingId,
        agreedPricePerKg: Number(transaction.agreedPricePerKg),
      },
    });

    return transaction;
  }

  async recordReceivedWeight(transactionId: string, userId: string, dto: RecordWeightDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.recyclerId !== userId) {
      // Check if admin
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.ADMIN) {
        throw new ForbiddenException('Only the assigned recycler or an administrator can record received weight');
      }
    }

    if (
      transaction.status === TransactionStatus.HANDOVER_VERIFIED ||
      transaction.status === TransactionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot alter received weight for transaction in final status: ${transaction.status}`,
      );
    }

    const actualWeight = new Prisma.Decimal(dto.actualWeightKg);
    const agreedPrice = transaction.agreedPricePerKg;
    const feePerKg = new Prisma.Decimal(
      this.configService.get<number>('platformFeePerKg') || 2,
    );

    const totalAmount = actualWeight.mul(agreedPrice);
    const platformFee = actualWeight.mul(feePerKg);

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        actualWeightKg: actualWeight,
        totalAmount,
        platformFee,
      },
      include: {
        listing: true,
        collector: { select: { id: true, fullName: true, organizationName: true } },
        recycler: { select: { id: true, fullName: true, organizationName: true } },
      },
    });

    await this.auditLogsService.log({
      actorId: userId,
      entityType: 'TRANSACTION',
      entityId: transactionId,
      action: 'WEIGHT_RECORDED',
      metadata: {
        actualWeightKg: dto.actualWeightKg,
        totalAmount: Number(totalAmount),
        platformFee: Number(platformFee),
      },
    });

    return updated;
  }

  async addEvidence(transactionId: string, userId: string, dto: AddEvidenceDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (
      transaction.collectorId !== userId &&
      transaction.recyclerId !== userId
    ) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.ADMIN) {
        throw new ForbiddenException('Only transaction participants may attach evidence');
      }
    }

    if (
      transaction.status === TransactionStatus.HANDOVER_VERIFIED ||
      transaction.status === TransactionStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot add evidence to transaction in status: ${transaction.status}`);
    }

    const currentUrls = transaction.evidenceUrls || [];
    const mergedUrls = Array.from(new Set([...currentUrls, ...dto.evidenceUrls]));

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        evidenceUrls: mergedUrls,
        ...(dto.evidenceNotes ? { evidenceNotes: dto.evidenceNotes.trim() } : {}),
      },
    });

    await this.auditLogsService.log({
      actorId: userId,
      entityType: 'TRANSACTION',
      entityId: transactionId,
      action: 'EVIDENCE_ATTACHED',
      metadata: { evidenceCount: mergedUrls.length, notes: dto.evidenceNotes },
    });

    return updated;
  }

  async confirmCollector(transactionId: string, collectorId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { listing: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.collectorId !== collectorId) {
      throw new ForbiddenException('Only the assigned collector can execute collector confirmation');
    }

    if (transaction.collectorConfirmedAt) {
      throw new BadRequestException('Collector handover has already been confirmed');
    }

    if (
      transaction.status === TransactionStatus.CANCELLED ||
      transaction.status === TransactionStatus.DISPUTED
    ) {
      throw new BadRequestException(`Cannot confirm transaction in status ${transaction.status}`);
    }

    const isRecyclerAlreadyConfirmed = !!transaction.recyclerConfirmedAt;
    const newStatus = isRecyclerAlreadyConfirmed
      ? TransactionStatus.HANDOVER_VERIFIED
      : TransactionStatus.PARTIALLY_CONFIRMED;

    const completedAt = isRecyclerAlreadyConfirmed ? new Date() : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const txUpdated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          collectorConfirmedAt: new Date(),
          status: newStatus,
          ...(completedAt ? { completedAt } : {}),
        },
        include: {
          listing: true,
          collector: { select: { id: true, fullName: true, organizationName: true } },
          recycler: { select: { id: true, fullName: true, organizationName: true } },
        },
      });

      if (isRecyclerAlreadyConfirmed) {
        await tx.wasteListing.update({
          where: { id: transaction.listingId },
          data: { status: ListingStatus.COMPLETED },
        });
      }

      return txUpdated;
    });

    await this.auditLogsService.log({
      actorId: collectorId,
      entityType: 'TRANSACTION',
      entityId: transactionId,
      action: 'COLLECTOR_CONFIRMED',
      newStatus,
      metadata: { bothConfirmed: isRecyclerAlreadyConfirmed },
    });

    // If both parties confirmed, atomically generate digital manifest
    if (isRecyclerAlreadyConfirmed) {
      await this.manifestsService.generateManifestForTransaction(transactionId);
    }

    return updated;
  }

  async confirmRecycler(transactionId: string, recyclerId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { listing: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.recyclerId !== recyclerId) {
      throw new ForbiddenException('Only the assigned recycler can execute recycler confirmation');
    }

    if (transaction.recyclerConfirmedAt) {
      throw new BadRequestException('Recycler handover has already been confirmed');
    }

    if (
      transaction.status === TransactionStatus.CANCELLED ||
      transaction.status === TransactionStatus.DISPUTED
    ) {
      throw new BadRequestException(`Cannot confirm transaction in status ${transaction.status}`);
    }

    const isCollectorAlreadyConfirmed = !!transaction.collectorConfirmedAt;
    const newStatus = isCollectorAlreadyConfirmed
      ? TransactionStatus.HANDOVER_VERIFIED
      : TransactionStatus.PARTIALLY_CONFIRMED;

    const completedAt = isCollectorAlreadyConfirmed ? new Date() : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const txUpdated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          recyclerConfirmedAt: new Date(),
          status: newStatus,
          ...(completedAt ? { completedAt } : {}),
        },
        include: {
          listing: true,
          collector: { select: { id: true, fullName: true, organizationName: true } },
          recycler: { select: { id: true, fullName: true, organizationName: true } },
        },
      });

      if (isCollectorAlreadyConfirmed) {
        await tx.wasteListing.update({
          where: { id: transaction.listingId },
          data: { status: ListingStatus.COMPLETED },
        });
      }

      return txUpdated;
    });

    await this.auditLogsService.log({
      actorId: recyclerId,
      entityType: 'TRANSACTION',
      entityId: transactionId,
      action: 'RECYCLER_CONFIRMED',
      newStatus,
      metadata: { bothConfirmed: isCollectorAlreadyConfirmed },
    });

    // If both parties confirmed, atomically generate digital manifest
    if (isCollectorAlreadyConfirmed) {
      await this.manifestsService.generateManifestForTransaction(transactionId);
    }

    return updated;
  }

  async cancel(transactionId: string, userId: string, dto: CancelTransactionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (
      transaction.collectorId !== userId &&
      transaction.recyclerId !== userId
    ) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.ADMIN) {
        throw new ForbiddenException('Only transaction participants or an admin can cancel');
      }
    }

    if (transaction.status === TransactionStatus.HANDOVER_VERIFIED) {
      throw new BadRequestException('Cannot cancel a completed, verified handover transaction');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const txUpdated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.CANCELLED,
          cancellationReason: dto.reason.trim(),
        },
      });

      // Release listing back to AVAILABLE so other recyclers can acquire it
      await tx.wasteListing.update({
        where: { id: transaction.listingId },
        data: { status: ListingStatus.AVAILABLE },
      });

      return txUpdated;
    });

    await this.auditLogsService.log({
      actorId: userId,
      entityType: 'TRANSACTION',
      entityId: transactionId,
      action: 'TRANSACTION_CANCELLED',
      previousStatus: transaction.status,
      newStatus: TransactionStatus.CANCELLED,
      metadata: { reason: dto.reason },
    });

    return updated;
  }

  async dispute(transactionId: string, userId: string, dto: DisputeTransactionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (
      transaction.collectorId !== userId &&
      transaction.recyclerId !== userId
    ) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.role !== Role.ADMIN) {
        throw new ForbiddenException('Only transaction participants or an admin can flag a dispute');
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.DISPUTED,
        disputeReason: dto.reason.trim(),
      },
    });

    await this.auditLogsService.log({
      actorId: userId,
      entityType: 'TRANSACTION',
      entityId: transactionId,
      action: 'TRANSACTION_DISPUTED',
      previousStatus: transaction.status,
      newStatus: TransactionStatus.DISPUTED,
      metadata: { reason: dto.reason },
    });

    return updated;
  }

  async findAll(user: AuthenticatedUser, query: PaginationDto) {
    let where: Prisma.TransactionWhereInput = {};

    if (user.role === Role.COLLECTOR) {
      where = { collectorId: user.id };
    } else if (user.role === Role.RECYCLER) {
      where = { recyclerId: user.id };
    } // ADMIN views all

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: true,
          collector: {
            select: { id: true, fullName: true, phone: true, organizationName: true, city: true, state: true },
          },
          recycler: {
            select: { id: true, fullName: true, phone: true, organizationName: true, city: true, state: true },
          },
          manifest: {
            select: { id: true, manifestNumber: true, publicToken: true, pdfPath: true },
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

  async findOne(id: string, user: AuthenticatedUser) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        listing: true,
        collector: {
          select: { id: true, fullName: true, phone: true, organizationName: true, city: true, state: true },
        },
        recycler: {
          select: { id: true, fullName: true, phone: true, organizationName: true, city: true, state: true },
        },
        manifest: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (
      user.role === Role.COLLECTOR &&
      transaction.collectorId !== user.id
    ) {
      throw new ForbiddenException('Access denied: You are not a participant in this transaction');
    }

    if (
      user.role === Role.RECYCLER &&
      transaction.recyclerId !== user.id
    ) {
      throw new ForbiddenException('Access denied: You are not a participant in this transaction');
    }

    return transaction;
  }
}

