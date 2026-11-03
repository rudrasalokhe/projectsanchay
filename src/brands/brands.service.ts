import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrandFilterDto } from './dto/brand-filter.dto';

const COMPLIANCE_DISCLAIMER =
  'This dashboard displays digital e-waste handover manifests verified on Sanchay. It represents documented chain-of-custody handovers, not official CPCB EPR certificates or proof of final smelting/recycling.';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private buildDateFilter(filter?: BrandFilterDto): Prisma.DigitalManifestWhereInput {
    const where: Prisma.DigitalManifestWhereInput = {};
    if (filter?.startDate || filter?.endDate) {
      where.handoverDate = {
        ...(filter.startDate ? { gte: new Date(filter.startDate) } : {}),
        ...(filter.endDate ? { lte: new Date(new Date(filter.endDate).setHours(23, 59, 59, 999)) } : {}),
      };
    }
    return where;
  }

  async getDashboard(brandId: string, filter?: BrandFilterDto) {
    const dateFilter = this.buildDateFilter(filter);
    const where: Prisma.DigitalManifestWhereInput = {
      brandAccess: { some: { brandId } },
      ...dateFilter,
    };

    const manifests = await this.prisma.digitalManifest.findMany({
      where,
      orderBy: { handoverDate: 'desc' },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            recyclerId: true,
            recycler: { select: { id: true, fullName: true, organizationName: true } },
          },
        },
      },
    });

    let totalDocumentedWeightKg = 0;
    const recyclerSet = new Set<string>();
    const categoryMap: Record<string, { count: number; weightKg: number }> = {};
    const cityMap: Record<string, { count: number; weightKg: number; state: string }> = {};

    for (const m of manifests) {
      const weight = Number(m.actualWeightKg);
      totalDocumentedWeightKg += weight;

      if (m.transaction?.recyclerId) {
        recyclerSet.add(m.transaction.recyclerId);
      }

      // Category breakdown
      if (!categoryMap[m.wasteCategory]) {
        categoryMap[m.wasteCategory] = { count: 0, weightKg: 0 };
      }
      categoryMap[m.wasteCategory].count += 1;
      categoryMap[m.wasteCategory].weightKg += weight;

      // City breakdown
      if (!cityMap[m.city]) {
        cityMap[m.city] = { count: 0, weightKg: 0, state: m.state };
      }
      cityMap[m.city].count += 1;
      cityMap[m.city].weightKg += weight;
    }

    return {
      kpis: {
        totalDocumentedWeightKg: Number(totalDocumentedWeightKg.toFixed(2)),
        verifiedHandoversCount: manifests.length,
        manifestCount: manifests.length,
        associatedRecyclersCount: recyclerSet.size,
      },
      categoryDistribution: Object.entries(categoryMap).map(([category, val]) => ({
        category,
        count: val.count,
        weightKg: Number(val.weightKg.toFixed(2)),
        percentage: manifests.length > 0 ? Number(((val.weightKg / totalDocumentedWeightKg) * 100).toFixed(1)) : 0,
      })),
      cityDistribution: Object.entries(cityMap).map(([city, val]) => ({
        city,
        state: val.state,
        count: val.count,
        weightKg: Number(val.weightKg.toFixed(2)),
      })),
      recentManifests: manifests.slice(0, 5).map((m) => ({
        id: m.id,
        manifestNumber: m.manifestNumber,
        wasteCategory: m.wasteCategory,
        actualWeightKg: Number(m.actualWeightKg),
        handoverDate: m.handoverDate,
        city: m.city,
        state: m.state,
        recycler: m.recyclerOrg || m.recyclerName,
      })),
      complianceNotice: COMPLIANCE_DISCLAIMER,
    };
  }

  async getCategoryAnalytics(brandId: string, filter?: BrandFilterDto) {
    const dashboard = await this.getDashboard(brandId, filter);
    return {
      totalDocumentedWeightKg: dashboard.kpis.totalDocumentedWeightKg,
      categories: dashboard.categoryDistribution,
    };
  }

  async getMonthlyAnalytics(brandId: string, filter?: BrandFilterDto) {
    const dateFilter = this.buildDateFilter(filter);
    const manifests = await this.prisma.digitalManifest.findMany({
      where: {
        brandAccess: { some: { brandId } },
        ...dateFilter,
      },
      orderBy: { handoverDate: 'asc' },
    });

    const monthlyMap: Record<string, { month: string; weightKg: number; count: number }> = {};

    for (const m of manifests) {
      const d = new Date(m.handoverDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = { month: key, weightKg: 0, count: 0 };
      }
      monthlyMap[key].weightKg += Number(m.actualWeightKg);
      monthlyMap[key].count += 1;
    }

    return Object.values(monthlyMap).map((item) => ({
      ...item,
      weightKg: Number(item.weightKg.toFixed(2)),
    }));
  }

  async getLocationAnalytics(brandId: string, filter?: BrandFilterDto) {
    const dashboard = await this.getDashboard(brandId, filter);
    return {
      totalDocumentedWeightKg: dashboard.kpis.totalDocumentedWeightKg,
      locations: dashboard.cityDistribution,
    };
  }

  async getManifests(brandId: string, filter?: BrandFilterDto) {
    const dateFilter = this.buildDateFilter(filter);
    const where: Prisma.DigitalManifestWhereInput = {
      brandAccess: { some: { brandId } },
      ...dateFilter,
    };

    const [total, items] = await Promise.all([
      this.prisma.digitalManifest.count({ where }),
      this.prisma.digitalManifest.findMany({
        where,
        skip: filter?.skip || 0,
        take: filter?.limit || 10,
        orderBy: { handoverDate: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              status: true,
              recycler: { select: { id: true, fullName: true, organizationName: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: filter?.page || 1,
      limit: filter?.limit || 10,
      totalPages: Math.ceil(total / (filter?.limit || 10)),
      items,
    };
  }

  async getTransactions(brandId: string, filter?: BrandFilterDto) {
    const dateFilter = this.buildDateFilter(filter);
    const where: Prisma.TransactionWhereInput = {
      manifest: {
        brandAccess: { some: { brandId } },
        ...dateFilter,
      },
    };

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip: filter?.skip || 0,
        take: filter?.limit || 10,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: true,
          collector: { select: { id: true, fullName: true, organizationName: true, city: true, state: true } },
          recycler: { select: { id: true, fullName: true, organizationName: true, city: true, state: true } },
          manifest: { select: { id: true, manifestNumber: true, publicToken: true, pdfPath: true } },
        },
      }),
    ]);

    return {
      total,
      page: filter?.page || 1,
      limit: filter?.limit || 10,
      totalPages: Math.ceil(total / (filter?.limit || 10)),
      items,
    };
  }

  async exportCsv(brandId: string, filter?: BrandFilterDto): Promise<string> {
    const dateFilter = this.buildDateFilter(filter);
    const manifests = await this.prisma.digitalManifest.findMany({
      where: {
        brandAccess: { some: { brandId } },
        ...dateFilter,
      },
      orderBy: { handoverDate: 'desc' },
      include: {
        transaction: {
          include: {
            recycler: true,
            collector: true,
          },
        },
      },
    });

    const headers = [
      'Manifest Number',
      'Handover Date',
      'Waste Category',
      'Weight (kg)',
      'Price Per Kg (INR)',
      'Total Value (INR)',
      'Platform Fee (INR)',
      'City',
      'State',
      'Recycler Facility',
      'Verification Status',
      'Public Verification Token',
      'Compliance Disclaimer',
    ];

    const rows = manifests.map((m) => [
      m.manifestNumber,
      m.handoverDate.toISOString(),
      m.wasteCategory,
      m.actualWeightKg.toString(),
      m.agreedPricePerKg.toString(),
      m.totalAmount.toString(),
      m.platformFee.toString(),
      `"${m.city}"`,
      `"${m.state}"`,
      `"${m.recyclerOrg || m.recyclerName}"`,
      m.verificationStatus,
      m.publicToken,
      `"${m.disclaimer.replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

