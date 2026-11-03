import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { QrService } from './qr.service';
import { PdfService } from './pdf.service';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

const COMPLIANCE_DISCLAIMER =
  'This document records a digital e-waste handover on the Sanchay platform. It is not a CPCB-issued EPR certificate or independent proof of completed recycling.';

@Injectable()
export class ManifestsService {
  private readonly logger = new Logger(ManifestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly qrService: QrService,
    private readonly pdfService: PdfService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async generateManifestForTransaction(transactionId: string) {
    // Prevent duplicate manifests
    const existing = await this.prisma.digitalManifest.findUnique({
      where: { transactionId },
    });
    if (existing) {
      return existing;
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: true,
        collector: true,
        recycler: {
          include: { recyclerProfile: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    // Generate unique sequential-style manifest number: SAN-2026-XXXXXX
    const count = await this.prisma.digitalManifest.count();
    const year = new Date().getFullYear();
    const manifestNumber = `SAN-${year}-${String(count + 1).padStart(6, '0')}`;
    const publicToken = crypto.randomUUID();

    const backendPublicUrl =
      this.configService.get<string>('backendPublicUrl') || 'http://localhost:3000';
    const verificationUrl = `${backendPublicUrl}/api/verify/${publicToken}`;

    const qrCodeDataUrl = await this.qrService.generateQrDataUrl(verificationUrl);

    const actualWeightKg = transaction.actualWeightKg
      ? Number(transaction.actualWeightKg)
      : Number(transaction.listing.estimatedWeightKg);

    const agreedPricePerKg = Number(transaction.agreedPricePerKg);
    const totalAmount = transaction.totalAmount
      ? Number(transaction.totalAmount)
      : actualWeightKg * agreedPricePerKg;

    const feePerKg = this.configService.get<number>('platformFeePerKg') || 2;
    const platformFee = transaction.platformFee
      ? Number(transaction.platformFee)
      : actualWeightKg * feePerKg;

    // Generate PDF
    const pdfBuffer = await this.pdfService.generateManifestPdf({
      manifestNumber,
      handoverDate: transaction.completedAt || new Date(),
      verificationStatus: 'HANDOVER_VERIFIED',
      wasteCategory: transaction.listing.category,
      actualWeightKg,
      agreedPricePerKg,
      totalAmount,
      platformFee,
      pickupLocation: transaction.listing.pickupAddress,
      city: transaction.listing.city,
      state: transaction.listing.state,
      collectorName: transaction.collector.fullName,
      collectorOrg: transaction.collector.organizationName || 'Independent Aggregator',
      recyclerName: transaction.recycler.fullName,
      recyclerOrg:
        transaction.recycler.recyclerProfile?.companyName ||
        transaction.recycler.organizationName ||
        'Authorized Recycler',
      verificationUrl,
      disclaimer: COMPLIANCE_DISCLAIMER,
    });

    // Save PDF file locally
    const uploadDir = path.resolve(
      this.configService.get<string>('uploadDir') || './uploads',
    );
    const manifestsDir = path.join(uploadDir, 'manifests');
    if (!fs.existsSync(manifestsDir)) {
      fs.mkdirSync(manifestsDir, { recursive: true });
    }

    const pdfFilename = `${manifestNumber}.pdf`;
    const pdfFilePath = path.join(manifestsDir, pdfFilename);
    await fs.promises.writeFile(pdfFilePath, pdfBuffer);

    const pdfRelativePath = `/uploads/manifests/${pdfFilename}`;

    const manifest = await this.prisma.digitalManifest.create({
      data: {
        manifestNumber,
        transactionId,
        wasteCategory: transaction.listing.category,
        actualWeightKg: new Prisma.Decimal(actualWeightKg),
        agreedPricePerKg: new Prisma.Decimal(agreedPricePerKg),
        totalAmount: new Prisma.Decimal(totalAmount),
        platformFee: new Prisma.Decimal(platformFee),
        handoverDate: transaction.completedAt || new Date(),
        pickupLocation: transaction.listing.pickupAddress,
        city: transaction.listing.city,
        state: transaction.listing.state,
        collectorName: transaction.collector.fullName,
        collectorOrg: transaction.collector.organizationName || null,
        recyclerName: transaction.recycler.fullName,
        recyclerOrg:
          transaction.recycler.recyclerProfile?.companyName ||
          transaction.recycler.organizationName ||
          null,
        verificationStatus: 'HANDOVER_VERIFIED',
        publicToken,
        qrCodeDataUrl,
        pdfPath: pdfRelativePath,
        disclaimer: COMPLIANCE_DISCLAIMER,
      },
    });

    await this.auditLogsService.log({
      actorId: transaction.recyclerId,
      entityType: 'DIGITAL_MANIFEST',
      entityId: manifest.id,
      action: 'MANIFEST_GENERATED',
      metadata: { manifestNumber, transactionId, actualWeightKg },
    });

    return manifest;
  }

  async findAll(user: AuthenticatedUser, query: PaginationDto) {
    let where: Prisma.DigitalManifestWhereInput = {};

    if (user.role === Role.COLLECTOR) {
      where = { transaction: { collectorId: user.id } };
    } else if (user.role === Role.RECYCLER) {
      where = { transaction: { recyclerId: user.id } };
    } else if (user.role === Role.BRAND) {
      where = { brandAccess: { some: { brandId: user.id } } };
    } // ADMIN has no filter (can see all)

    const [total, items] = await Promise.all([
      this.prisma.digitalManifest.count({ where }),
      this.prisma.digitalManifest.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              status: true,
              actualWeightKg: true,
              totalAmount: true,
              collector: {
                select: { id: true, fullName: true, organizationName: true },
              },
              recycler: {
                select: { id: true, fullName: true, organizationName: true },
              },
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

  async findOne(id: string, user: AuthenticatedUser) {
    const manifest = await this.prisma.digitalManifest.findUnique({
      where: { id },
      include: {
        transaction: {
          include: {
            listing: true,
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
            recycler: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                organizationName: true,
                city: true,
                state: true,
                recyclerProfile: true,
              },
            },
          },
        },
        brandAccess: {
          include: {
            brand: {
              select: { id: true, fullName: true, organizationName: true },
            },
          },
        },
      },
    });

    if (!manifest) {
      throw new NotFoundException(`Manifest with ID ${id} not found`);
    }

    // Role-based access validation
    if (user.role === Role.COLLECTOR && manifest.transaction.collectorId !== user.id) {
      throw new ForbiddenException('Access denied: You are not the collector for this manifest');
    }
    if (user.role === Role.RECYCLER && manifest.transaction.recyclerId !== user.id) {
      throw new ForbiddenException('Access denied: You are not the recycler for this manifest');
    }
    if (user.role === Role.BRAND) {
      const hasAccess = manifest.brandAccess.some((ba) => ba.brandId === user.id);
      if (!hasAccess) {
        throw new ForbiddenException('Access denied: Your brand does not have access to this manifest');
      }
    }

    return manifest;
  }

  async getPdfBuffer(id: string, user: AuthenticatedUser): Promise<{ buffer: Buffer; filename: string }> {
    const manifest = await this.findOne(id, user);

    const uploadDir = path.resolve(
      this.configService.get<string>('uploadDir') || './uploads',
    );
    const manifestsDir = path.join(uploadDir, 'manifests');
    const pdfFilename = `${manifest.manifestNumber}.pdf`;
    const fullPath = path.join(manifestsDir, pdfFilename);

    if (fs.existsSync(fullPath)) {
      const buffer = await fs.promises.readFile(fullPath);
      return { buffer, filename: pdfFilename };
    }

    // If PDF file doesn't exist on disk, regenerate on-the-fly
    const backendPublicUrl =
      this.configService.get<string>('backendPublicUrl') || 'http://localhost:3000';
    const verificationUrl = `${backendPublicUrl}/api/verify/${manifest.publicToken}`;

    const buffer = await this.pdfService.generateManifestPdf({
      manifestNumber: manifest.manifestNumber,
      handoverDate: manifest.handoverDate,
      verificationStatus: manifest.verificationStatus,
      wasteCategory: manifest.wasteCategory,
      actualWeightKg: Number(manifest.actualWeightKg),
      agreedPricePerKg: Number(manifest.agreedPricePerKg),
      totalAmount: Number(manifest.totalAmount),
      platformFee: Number(manifest.platformFee),
      pickupLocation: manifest.pickupLocation,
      city: manifest.city,
      state: manifest.state,
      collectorName: manifest.collectorName,
      collectorOrg: manifest.collectorOrg || 'Independent Aggregator',
      recyclerName: manifest.recyclerName,
      recyclerOrg: manifest.recyclerOrg || 'Authorized Recycler',
      verificationUrl,
      disclaimer: COMPLIANCE_DISCLAIMER,
    });

    await fs.promises.writeFile(fullPath, buffer);
    return { buffer, filename: pdfFilename };
  }

  async getQrImage(id: string, user: AuthenticatedUser): Promise<Buffer> {
    const manifest = await this.findOne(id, user);
    const backendPublicUrl =
      this.configService.get<string>('backendPublicUrl') || 'http://localhost:3000';
    const verificationUrl = `${backendPublicUrl}/api/verify/${manifest.publicToken}`;
    return this.qrService.generateQrBuffer(verificationUrl);
  }

  async verifyPublicToken(publicToken: string) {
    const manifest = await this.prisma.digitalManifest.findUnique({
      where: { publicToken },
      include: {
        transaction: {
          select: {
            id: true,
            acceptedAt: true,
            collectorConfirmedAt: true,
            recyclerConfirmedAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!manifest) {
      throw new NotFoundException('Invalid or non-existent manifest verification token');
    }

    // Exclude sensitive private personal details
    return {
      verified: true,
      manifestNumber: manifest.manifestNumber,
      verificationStatus: manifest.verificationStatus,
      handoverDate: manifest.handoverDate,
      wasteCategory: manifest.wasteCategory,
      actualWeightKg: Number(manifest.actualWeightKg),
      sourceCity: manifest.city,
      sourceState: manifest.state,
      collectorEntity: manifest.collectorOrg || 'Informal Waste Aggregator',
      recyclerFacility: manifest.recyclerOrg || 'Authorized E-Waste Recycler',
      timeline: {
        acceptedAt: manifest.transaction.acceptedAt,
        collectorConfirmedAt: manifest.transaction.collectorConfirmedAt,
        recyclerConfirmedAt: manifest.transaction.recyclerConfirmedAt,
        completedAt: manifest.transaction.completedAt,
      },
      complianceNotice: manifest.disclaimer,
    };
  }
}

