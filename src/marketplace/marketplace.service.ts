import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ListingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListingQueryDto } from '../listings/dto/listing-query.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailableListings(query: ListingQueryDto) {
    const where: Prisma.WasteListingWhereInput = {
      status: ListingStatus.AVAILABLE,
      ...(query.category ? { category: query.category } : {}),
      ...(query.city ? { city: { contains: query.city, mode: 'insensitive' } } : {}),
      ...(query.state ? { state: { contains: query.state, mode: 'insensitive' } } : {}),
      ...(query.minWeight || query.maxWeight
        ? {
            estimatedWeightKg: {
              ...(query.minWeight ? { gte: new Prisma.Decimal(query.minWeight) } : {}),
              ...(query.maxWeight ? { lte: new Prisma.Decimal(query.maxWeight) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.wasteListing.count({ where }),
      this.prisma.wasteListing.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          collector: {
            select: {
              id: true,
              fullName: true,
              organizationName: true,
              city: true,
              state: true,
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

  async findListingDetails(id: string) {
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
            address: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException(`Marketplace listing ${id} not found`);
    }

    return listing;
  }
}

