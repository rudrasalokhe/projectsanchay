import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class RecyclersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(recyclerId: string) {
    const profile = await this.prisma.recyclerProfile.findUnique({
      where: { userId: recyclerId },
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

    if (!profile) {
      throw new NotFoundException('Recycler profile not found');
    }

    return profile;
  }

  async getDashboard(recyclerId: string) {
    const profile = await this.getProfile(recyclerId);

    const [
      totalAccepted,
      pendingHandover,
      partiallyConfirmed,
      verifiedTransactions,
      recentHandovers,
    ] = await Promise.all([
      this.prisma.transaction.count({ where: { recyclerId } }),
      this.prisma.transaction.count({
        where: { recyclerId, status: TransactionStatus.PENDING_HANDOVER },
      }),
      this.prisma.transaction.count({
        where: { recyclerId, status: TransactionStatus.PARTIALLY_CONFIRMED },
      }),
      this.prisma.transaction.findMany({
        where: { recyclerId, status: TransactionStatus.HANDOVER_VERIFIED },
        select: {
          actualWeightKg: true,
          totalAmount: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: { recyclerId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: true,
          collector: { select: { id: true, fullName: true, organizationName: true, phone: true } },
          manifest: { select: { id: true, manifestNumber: true, publicToken: true, pdfPath: true } },
        },
      }),
    ]);

    let totalWeightReceivedKg = 0;
    let totalPurchaseValue = 0;

    for (const tx of verifiedTransactions) {
      if (tx.actualWeightKg) {
        totalWeightReceivedKg += Number(tx.actualWeightKg);
      }
      if (tx.totalAmount) {
        totalPurchaseValue += Number(tx.totalAmount);
      }
    }

    return {
      profile: {
        companyName: profile.companyName,
        registrationNumber: profile.registrationNumber,
        registrationStatus: profile.registrationStatus,
        verifiedAt: profile.verifiedAt,
      },
      overview: {
        totalAcceptedTransactions: totalAccepted,
        pendingHandover,
        partiallyConfirmed,
        verifiedHandoversCount: verifiedTransactions.length,
        totalWeightReceivedKg: Number(totalWeightReceivedKg.toFixed(2)),
        totalPurchaseValue: Number(totalPurchaseValue.toFixed(2)),
      },
      recentHandovers,
    };
  }

  async getTransactions(recyclerId: string) {
    return this.prisma.transaction.findMany({
      where: { recyclerId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: true,
        collector: { select: { id: true, fullName: true, organizationName: true, phone: true } },
        manifest: { select: { id: true, manifestNumber: true, publicToken: true, pdfPath: true } },
      },
    });
  }
}

