import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingStatus, TransactionStatus } from '@prisma/client';

@Injectable()
export class CollectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(collectorId: string) {
    const [
      totalListings,
      availableListings,
      reservedListings,
      completedListings,
      verifiedTransactions,
      recentTransactions,
    ] = await Promise.all([
      this.prisma.wasteListing.count({ where: { collectorId } }),
      this.prisma.wasteListing.count({ where: { collectorId, status: ListingStatus.AVAILABLE } }),
      this.prisma.wasteListing.count({ where: { collectorId, status: ListingStatus.RESERVED } }),
      this.prisma.wasteListing.count({ where: { collectorId, status: ListingStatus.COMPLETED } }),
      this.prisma.transaction.findMany({
        where: {
          collectorId,
          status: TransactionStatus.HANDOVER_VERIFIED,
        },
        select: {
          actualWeightKg: true,
          totalAmount: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: { collectorId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: true,
          recycler: { select: { id: true, fullName: true, organizationName: true } },
          manifest: { select: { id: true, manifestNumber: true, publicToken: true } },
        },
      }),
    ]);

    let totalWeightCollectedKg = 0;
    let totalGrossEarnings = 0;

    for (const tx of verifiedTransactions) {
      if (tx.actualWeightKg) {
        totalWeightCollectedKg += Number(tx.actualWeightKg);
      }
      if (tx.totalAmount) {
        totalGrossEarnings += Number(tx.totalAmount);
      }
    }

    return {
      overview: {
        totalListings,
        availableListings,
        reservedListings,
        completedListings,
        verifiedHandoversCount: verifiedTransactions.length,
        totalWeightCollectedKg: Number(totalWeightCollectedKg.toFixed(2)),
        totalGrossEarnings: Number(totalGrossEarnings.toFixed(2)),
      },
      recentTransactions,
    };
  }

  async getTransactions(collectorId: string) {
    return this.prisma.transaction.findMany({
      where: { collectorId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: true,
        recycler: { select: { id: true, fullName: true, organizationName: true, phone: true } },
        manifest: { select: { id: true, manifestNumber: true, publicToken: true, pdfPath: true } },
      },
    });
  }
}

