import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { ListingStatus } from '@prisma/client';

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(collectorId: string, dto: CreateListingDto) {
    const listing = await this.prisma.wasteListing.create({
      data: {
        collectorId,
        category: dto.category,
        description: dto.description?.trim() || null,
        estimatedWeightKg: new Prisma.Decimal(dto.estimatedWeightKg),
        expectedPricePerKg: new Prisma.Decimal(dto.expectedPricePerKg),
        city: dto.city.trim(),
        state: dto.state.trim(),
        pickupAddress: dto.pickupAddress.trim(),
        latitude: dto.latitude || null,
        longitude: dto.longitude || null,
        photoUrls: dto.photoUrls || [],
        status: ListingStatus.AVAILABLE,
      },
      include: {
        collector: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            organizationName: true,
            city: true,
            state: true,
          },
        },
      },
    });

    await this.auditLogsService.log({
      actorId: collectorId,
      entityType: 'WASTE_LISTING',
      entityId: listing.id,
      action: 'LISTING_CREATED',
      newStatus: ListingStatus.AVAILABLE,
      metadata: {
        category: listing.category,
        estimatedWeightKg: Number(listing.estimatedWeightKg),
        expectedPricePerKg: Number(listing.expectedPricePerKg),
      },
    });

    return listing;
  }

  async findMyListings(collectorId: string, query: ListingQueryDto) {
    const where: Prisma.WasteListingWhereInput = {
      collectorId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.city ? { city: { contains: query.city, mode: 'insensitive' } } : {}),
      ...(query.state ? { state: { contains: query.state, mode: 'insensitive' } } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.wasteListing.count({ where }),
      this.prisma.wasteListing.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transactions: {
            select: {
              id: true,
              status: true,
              agreedPricePerKg: true,
              actualWeightKg: true,
              totalAmount: true,
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

  async findOne(id: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
      include: {
        collector: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            organizationName: true,
            city: true,
            state: true,
          },
        },
        transactions: {
          include: {
            recycler: {
              select: {
                id: true,
                fullName: true,
                organizationName: true,
              },
            },
            manifest: {
              select: {
                id: true,
                manifestNumber: true,
                publicToken: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException(`Waste listing with ID ${id} not found`);
    }

    return listing;
  }

  async update(id: string, collectorId: string, dto: UpdateListingDto) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException(`Waste listing with ID ${id} not found`);
    }

    if (listing.collectorId !== collectorId) {
      throw new ForbiddenException('You are not authorized to update this listing');
    }

    if (listing.status !== ListingStatus.AVAILABLE) {
      throw new BadRequestException(
        `Cannot update listing in status ${listing.status}. Only AVAILABLE listings may be modified.`,
      );
    }

    const updated = await this.prisma.wasteListing.update({
      where: { id },
      data: {
        ...(dto.category ? { category: dto.category } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.estimatedWeightKg ? { estimatedWeightKg: new Prisma.Decimal(dto.estimatedWeightKg) } : {}),
        ...(dto.expectedPricePerKg ? { expectedPricePerKg: new Prisma.Decimal(dto.expectedPricePerKg) } : {}),
        ...(dto.city ? { city: dto.city.trim() } : {}),
        ...(dto.state ? { state: dto.state.trim() } : {}),
        ...(dto.pickupAddress ? { pickupAddress: dto.pickupAddress.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.photoUrls ? { photoUrls: dto.photoUrls } : {}),
      },
    });

    await this.auditLogsService.log({
      actorId: collectorId,
      entityType: 'WASTE_LISTING',
      entityId: id,
      action: 'LISTING_UPDATED',
      metadata: { changes: Object.keys(dto) },
    });

    return updated;
  }

  async cancel(id: string, collectorId: string) {
    const listing = await this.prisma.wasteListing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException(`Waste listing with ID ${id} not found`);
    }

    if (listing.collectorId !== collectorId) {
      throw new ForbiddenException('You are not authorized to cancel this listing');
    }

    if (listing.status !== ListingStatus.AVAILABLE) {
      throw new BadRequestException(
        `Cannot cancel listing with status ${listing.status}. Only AVAILABLE listings can be cancelled.`,
      );
    }

    const updated = await this.prisma.wasteListing.update({
      where: { id },
      data: { status: ListingStatus.CANCELLED },
    });

    await this.auditLogsService.log({
      actorId: collectorId,
      entityType: 'WASTE_LISTING',
      entityId: id,
      action: 'LISTING_CANCELLED',
      previousStatus: listing.status,
      newStatus: ListingStatus.CANCELLED,
    });

    return {
      message: 'Listing successfully cancelled',
      listing: updated,
    };
  }
}

