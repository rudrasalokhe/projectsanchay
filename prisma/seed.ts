import { PrismaClient, Role, RecyclerRegistrationStatus, WasteCategory, ListingStatus, TransactionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Project Sanchay Demonstration Database ---');

  // Clean existing demonstration records
  await prisma.auditLog.deleteMany();
  await prisma.brandManifestAccess.deleteMany();
  await prisma.digitalManifest.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.wasteListing.deleteMany();
  await prisma.recyclerProfile.deleteMany();
  await prisma.user.deleteMany();

  const saltRounds = 10;
  const commonPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(commonPassword, saltRounds);

  // 1. ADMIN Account
  const admin = await prisma.user.create({
    data: {
      fullName: 'Sanchay Administrator (Demo)',
      email: 'admin@sanchay.io',
      phone: '+919810011001',
      passwordHash,
      role: Role.ADMIN,
      organizationName: 'Project Sanchay Operations',
      address: 'Bandrakurla Complex, Level 5',
      city: 'Mumbai',
      state: 'Maharashtra',
    },
  });
  console.log(`Created Admin: ${admin.email}`);

  // 2. COLLECTOR Account (Informal Kabadiwala Aggregator)
  const collector = await prisma.user.create({
    data: {
      fullName: 'Ramesh Kumar (Demo Collector)',
      email: 'collector@sanchay.io',
      phone: '+919820022002',
      passwordHash,
      role: Role.COLLECTOR,
      organizationName: 'Ramesh Scrap & Metal Aggregators',
      address: 'Shop No 14, 90 Feet Road, Dharavi Compound',
      city: 'Mumbai',
      state: 'Maharashtra',
    },
  });
  console.log(`Created Collector: ${collector.email}`);

  // 3. RECYCLER Account (Approved Recycler)
  const recycler = await prisma.user.create({
    data: {
      fullName: 'Vikram Mehta (Demo Recycler)',
      email: 'recycler@sanchay.io',
      phone: '+919830033003',
      passwordHash,
      role: Role.RECYCLER,
      organizationName: 'GreenCycle Technologies Pvt Ltd',
      address: 'Plot 42, TTC Industrial Area, MIDC Mahape',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      recyclerProfile: {
        create: {
          companyName: 'GreenCycle Technologies Pvt Ltd',
          registrationNumber: 'REC-MH-MIDC-2026-0891',
          registrationDocumentUrl: '/uploads/documents/greencycle-sample-cert.pdf',
          registrationStatus: RecyclerRegistrationStatus.APPROVED,
          verifiedAt: new Date(),
          verifiedBy: admin.id,
        },
      },
    },
    include: { recyclerProfile: true },
  });
  console.log(`Created Recycler: ${recycler.email} (Status: APPROVED)`);

  // 4. BRAND Account (Electronics OEM Sustainability Lead)
  const brand = await prisma.user.create({
    data: {
      fullName: 'Ananya Sharma (Demo Brand)',
      email: 'brand@sanchay.io',
      phone: '+919840044004',
      passwordHash,
      role: Role.BRAND,
      organizationName: 'NovaTech Electronics India Ltd',
      address: 'DLF Cyber City, Tower B, 8th Floor',
      city: 'Gurugram',
      state: 'Haryana',
    },
  });
  console.log(`Created Brand: ${brand.email}`);

  // 5. Sample Listings
  // Listing 1: Completed listing that led to the sample manifest
  const listing1 = await prisma.wasteListing.create({
    data: {
      collectorId: collector.id,
      category: WasteCategory.CIRCUIT_BOARDS_PCBS,
      description: 'High-grade telecommunication and motherboard printed circuit boards (Demo)',
      estimatedWeightKg: 12.5,
      expectedPricePerKg: 150.0,
      city: 'Mumbai',
      state: 'Maharashtra',
      pickupAddress: 'Shop 14, 90 Feet Road, Dharavi',
      status: ListingStatus.COMPLETED,
      photoUrls: ['/uploads/photos/demo-pcb-1.jpg'],
    },
  });

  // Listing 2: Available listing ready for marketplace demo
  const listing2 = await prisma.wasteListing.create({
    data: {
      collectorId: collector.id,
      category: WasteCategory.MOBILE_PHONES,
      description: 'Mixed end-of-life smartphones with batteries removed (Demo)',
      estimatedWeightKg: 8.0,
      expectedPricePerKg: 110.0,
      city: 'Mumbai',
      state: 'Maharashtra',
      pickupAddress: 'Shop 14, 90 Feet Road, Dharavi',
      status: ListingStatus.AVAILABLE,
      photoUrls: ['/uploads/photos/demo-phones-1.jpg'],
    },
  });

  // Listing 3: Available laptop listing
  const listing3 = await prisma.wasteListing.create({
    data: {
      collectorId: collector.id,
      category: WasteCategory.LAPTOPS,
      description: 'Scrap laptops and ultrabooks for circuit recovery (Demo)',
      estimatedWeightKg: 25.0,
      expectedPricePerKg: 180.0,
      city: 'Pune',
      state: 'Maharashtra',
      pickupAddress: 'Hadapsar Industrial Estate Gala 9',
      status: ListingStatus.AVAILABLE,
      photoUrls: ['/uploads/photos/demo-laptops-1.jpg'],
    },
  });

  console.log('Created Sample Waste Listings (COMPLETED & AVAILABLE)');

  // 6. Completed Transaction for Listing 1
  const actualWeight = 12.8;
  const agreedPrice = 150.0;
  const totalAmount = actualWeight * agreedPrice; // 1920.00
  const platformFee = actualWeight * 2.0; // 25.60

  const transaction1 = await prisma.transaction.create({
    data: {
      listingId: listing1.id,
      collectorId: collector.id,
      recyclerId: recycler.id,
      agreedPricePerKg: agreedPrice,
      actualWeightKg: actualWeight,
      totalAmount,
      platformFee,
      evidenceUrls: [
        '/uploads/evidence/demo-weighing-slip-001.jpg',
        '/uploads/evidence/demo-handover-photo-001.jpg',
      ],
      evidenceNotes: 'Weighed on digital certified floor scale. Weight verified by both parties.',
      collectorConfirmedAt: new Date(Date.now() - 3600000 * 2),
      recyclerConfirmedAt: new Date(Date.now() - 3600000 * 1),
      status: TransactionStatus.HANDOVER_VERIFIED,
      acceptedAt: new Date(Date.now() - 3600000 * 5),
      completedAt: new Date(Date.now() - 3600000 * 1),
    },
  });
  console.log(`Created Completed Transaction: ${transaction1.id}`);

  // 7. Digital Manifest for Transaction 1
  const manifestNumber = 'SAN-2026-000001';
  const publicToken = crypto.randomUUID();
  const manifest = await prisma.digitalManifest.create({
    data: {
      manifestNumber,
      transactionId: transaction1.id,
      wasteCategory: WasteCategory.CIRCUIT_BOARDS_PCBS,
      actualWeightKg: actualWeight,
      agreedPricePerKg: agreedPrice,
      totalAmount,
      platformFee,
      handoverDate: transaction1.completedAt || new Date(),
      pickupLocation: listing1.pickupAddress,
      city: listing1.city,
      state: listing1.state,
      collectorName: collector.fullName,
      collectorOrg: collector.organizationName,
      recyclerName: recycler.fullName,
      recyclerOrg: recycler.recyclerProfile?.companyName,
      verificationStatus: 'HANDOVER_VERIFIED',
      publicToken,
      qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      pdfPath: `/uploads/manifests/${manifestNumber}.pdf`,
      disclaimer: 'This document records a digital e-waste handover on the Sanchay platform. It is not a CPCB-issued EPR certificate or independent proof of completed recycling.',
    },
  });
  console.log(`Created Digital Manifest: ${manifest.manifestNumber} (Token: ${manifest.publicToken})`);

  // 8. Associate Manifest with Brand
  await prisma.brandManifestAccess.create({
    data: {
      brandId: brand.id,
      manifestId: manifest.id,
      grantedBy: admin.id,
    },
  });
  console.log(`Associated Manifest ${manifest.manifestNumber} with Brand ${brand.organizationName}`);

  // 9. Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: collector.id,
        entityType: 'WASTE_LISTING',
        entityId: listing1.id,
        action: 'LISTING_CREATED',
        newStatus: ListingStatus.AVAILABLE,
      },
      {
        actorId: recycler.id,
        entityType: 'TRANSACTION',
        entityId: transaction1.id,
        action: 'TRANSACTION_ACCEPTED',
        newStatus: TransactionStatus.PENDING_HANDOVER,
      },
      {
        actorId: recycler.id,
        entityType: 'TRANSACTION',
        entityId: transaction1.id,
        action: 'WEIGHT_RECORDED',
        metadata: { actualWeightKg: actualWeight },
      },
      {
        actorId: collector.id,
        entityType: 'TRANSACTION',
        entityId: transaction1.id,
        action: 'COLLECTOR_CONFIRMED',
        newStatus: TransactionStatus.PARTIALLY_CONFIRMED,
      },
      {
        actorId: recycler.id,
        entityType: 'TRANSACTION',
        entityId: transaction1.id,
        action: 'RECYCLER_CONFIRMED',
        newStatus: TransactionStatus.HANDOVER_VERIFIED,
      },
      {
        actorId: admin.id,
        entityType: 'DIGITAL_MANIFEST',
        entityId: manifest.id,
        action: 'MANIFEST_GENERATED',
        metadata: { manifestNumber },
      },
      {
        actorId: admin.id,
        entityType: 'BRAND_MANIFEST_ACCESS',
        entityId: manifest.id,
        action: 'BRAND_ACCESS_GRANTED',
        metadata: { brandId: brand.id },
      },
    ],
  });

  console.log('--- Demonstration Database Seed Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

