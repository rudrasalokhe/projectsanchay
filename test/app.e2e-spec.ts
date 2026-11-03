import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role, WasteCategory, ListingStatus, TransactionStatus, RecyclerRegistrationStatus } from '@prisma/client';

describe('Project Sanchay E2E Integration Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let collectorToken: string;
  let collectorId: string;
  let recyclerToken: string;
  let recyclerId: string;
  let secondRecyclerToken: string;
  let secondRecyclerId: string;
  let brandToken: string;
  let brandId: string;

  beforeAll(async () => {
    // Force DATABASE_URL to sanchay_test
    process.env.DATABASE_URL = 'postgresql://postgres@localhost:5433/sanchay_test?schema=public';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    // Clean test database
    await prisma.auditLog.deleteMany();
    await prisma.brandManifestAccess.deleteMany();
    await prisma.digitalManifest.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.wasteListing.deleteMany();
    await prisma.recyclerProfile.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // 1. User registration and login
  describe('1. User Registration & Login', () => {
    it('should register a new COLLECTOR', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          fullName: 'Suresh Kabadiwala',
          email: 'suresh@collector.com',
          phone: '+919800000001',
          password: 'Password123!',
          role: Role.COLLECTOR,
          city: 'Mumbai',
          state: 'Maharashtra',
        })
        .expect(201);

      expect(res.body.data.user.email).toBe('suresh@collector.com');
      expect(res.body.data.user.role).toBe(Role.COLLECTOR);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();

      collectorId = res.body.data.user.id;
      collectorToken = res.body.data.tokens.accessToken;
    });

    it('should prevent self-registration as ADMIN', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          fullName: 'Malicious Actor',
          email: 'hacker@sanchay.io',
          phone: '+919999999999',
          password: 'Password123!',
          role: Role.ADMIN,
          city: 'Delhi',
          state: 'Delhi',
        })
        .expect(400);
    });

    it('should register an approved RECYCLER (via admin approval later)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          fullName: 'Apex Recyclers Facility',
          email: 'apex@recycler.com',
          phone: '+919800000002',
          password: 'Password123!',
          role: Role.RECYCLER,
          city: 'Navi Mumbai',
          state: 'Maharashtra',
          companyName: 'Apex E-Waste Recyclers Ltd',
          registrationNumber: 'REC-MH-TEST-001',
        })
        .expect(201);

      recyclerId = res.body.data.user.id;
      recyclerToken = res.body.data.tokens.accessToken;

      // Seed an ADMIN to approve recyclers
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('Password123!', 10);
      const adminUser = await prisma.user.create({
        data: {
          fullName: 'System SuperAdmin',
          email: 'admin@sanchay.io',
          phone: '+919800000099',
          passwordHash: hash,
          role: Role.ADMIN,
          city: 'Mumbai',
          state: 'Maharashtra',
        },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@sanchay.io', password: 'Password123!' })
        .expect(200);

      adminToken = loginRes.body.data.tokens.accessToken;

      // Admin approves recycler
      const profile = await prisma.recyclerProfile.findUnique({ where: { userId: recyclerId } });
      await request(app.getHttpServer())
        .patch(`/api/admin/recyclers/${profile.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should register a second recycler for concurrency testing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          fullName: 'Beta EcoRecycle',
          email: 'beta@recycler.com',
          phone: '+919800000003',
          password: 'Password123!',
          role: Role.RECYCLER,
          city: 'Thane',
          state: 'Maharashtra',
          companyName: 'Beta Recycling Corp',
          registrationNumber: 'REC-MH-TEST-002',
        })
        .expect(201);

      secondRecyclerId = res.body.data.user.id;
      secondRecyclerToken = res.body.data.tokens.accessToken;

      const profile = await prisma.recyclerProfile.findUnique({ where: { userId: secondRecyclerId } });
      await request(app.getHttpServer())
        .patch(`/api/admin/recyclers/${profile.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should register a BRAND user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          fullName: 'Global Electronics Sustainability',
          email: 'sustainability@brand.com',
          phone: '+919800000004',
          password: 'Password123!',
          role: Role.BRAND,
          organizationName: 'Global Brands India',
          city: 'Bengaluru',
          state: 'Karnataka',
        })
        .expect(201);

      brandId = res.body.data.user.id;
      brandToken = res.body.data.tokens.accessToken;
    });

    it('should login successfully and return access and refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'suresh@collector.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });
  });

  // 2. Unauthorized endpoint access
  describe('2. Unauthorized Access & Guards', () => {
    it('should reject requests without authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject invalid bearer token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-garbage-token')
        .expect(401);
    });
  });

  // 3. Role-based restrictions
  describe('3. Role-based Restrictions', () => {
    it('should prevent COLLECTOR from accessing ADMIN endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${collectorToken}`)
        .expect(403);
    });

    it('should prevent BRAND from creating waste listings', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${brandToken}`)
        .send({
          category: WasteCategory.CIRCUIT_BOARDS_PCBS,
          estimatedWeightKg: 10,
          expectedPricePerKg: 100,
          city: 'Mumbai',
          state: 'Maharashtra',
          pickupAddress: 'Street 1',
        })
        .expect(403);
    });
  });

  // 4. Collector creating a listing
  let testListingId: string;
  describe('4. Waste Listing Lifecycle', () => {
    it('should allow COLLECTOR to create a listing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${collectorToken}`)
        .send({
          category: WasteCategory.CIRCUIT_BOARDS_PCBS,
          description: 'Telecom servers PCBs (Test)',
          estimatedWeightKg: 8.0,
          expectedPricePerKg: 100.0,
          city: 'Mumbai',
          state: 'Maharashtra',
          pickupAddress: 'Gala 5, Dharavi Compound',
        })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe(ListingStatus.AVAILABLE);
      expect(Number(res.body.data.estimatedWeightKg)).toBe(8);
      testListingId = res.body.data.id;
    });

    it('should view listing in marketplace', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/marketplace/listings')
        .set('Authorization', `Bearer ${recyclerToken}`)
        .query({ category: WasteCategory.CIRCUIT_BOARDS_PCBS })
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.items.find((item: any) => item.id === testListingId);
      expect(found).toBeDefined();
    });
  });

  // 5 & 6. Recycler accepting a listing & Concurrency protection
  let testTransactionId: string;
  describe('5 & 6. Transaction Acceptance & Concurrency Protection', () => {
    it('should allow verified RECYCLER to accept available listing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/transactions/accept/${testListingId}`)
        .set('Authorization', `Bearer ${recyclerToken}`)
        .send({ agreedPricePerKg: 100.0 })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe(TransactionStatus.PENDING_HANDOVER);
      testTransactionId = res.body.data.id;

      // Listing must now be RESERVED
      const listing = await prisma.wasteListing.findUnique({ where: { id: testListingId } });
      expect(listing.status).toBe(ListingStatus.RESERVED);
    });

    it('should reject second recycler attempting to accept the same reserved listing (Concurrency guard)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/transactions/accept/${testListingId}`)
        .set('Authorization', `Bearer ${secondRecyclerToken}`)
        .send({ agreedPricePerKg: 105.0 })
        .expect(400);

      expect(res.body.message).toContain('no longer available');
    });
  });

  // 7, 8, 9, 10. Handover, Dual Confirmations, Unauthorized Rejection, Manifest & QR
  describe('7, 8, 9, 10. Handover, Dual Confirmations & Manifest Generation', () => {
    it('should record actual measured weight', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/transactions/${testTransactionId}/received-weight`)
        .set('Authorization', `Bearer ${recyclerToken}`)
        .send({ actualWeightKg: 8.5 })
        .expect(200);

      expect(Number(res.body.data.actualWeightKg)).toBe(8.5);
      expect(Number(res.body.data.totalAmount)).toBe(850.0); // 8.5 * 100
      expect(Number(res.body.data.platformFee)).toBe(17.0); // 8.5 * 2
    });

    it('should attach handover evidence', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/transactions/${testTransactionId}/evidence`)
        .set('Authorization', `Bearer ${recyclerToken}`)
        .send({
          evidenceUrls: ['/uploads/evidence/slip-01.jpg'],
          evidenceNotes: 'Floor scale calibration verified',
        })
        .expect(200);

      expect(res.body.data.evidenceUrls).toContain('/uploads/evidence/slip-01.jpg');
    });

    it('8. should reject unauthorized confirmation (collector attempting recycler confirm)', async () => {
      await request(app.getHttpServer())
        .post(`/api/transactions/${testTransactionId}/recycler-confirm`)
        .set('Authorization', `Bearer ${collectorToken}`) // collector calling recycler confirm
        .expect(403);
    });

    it('should allow recycler to confirm handover (becomes PARTIALLY_CONFIRMED)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/transactions/${testTransactionId}/recycler-confirm`)
        .set('Authorization', `Bearer ${recyclerToken}`)
        .expect(200);

      expect(res.body.data.status).toBe(TransactionStatus.PARTIALLY_CONFIRMED);
      expect(res.body.data.recyclerConfirmedAt).toBeDefined();
    });

    it('should allow collector to confirm handover (becomes HANDOVER_VERIFIED & generates Manifest)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/transactions/${testTransactionId}/collector-confirm`)
        .set('Authorization', `Bearer ${collectorToken}`)
        .expect(200);

      expect(res.body.data.status).toBe(TransactionStatus.HANDOVER_VERIFIED);
      expect(res.body.data.collectorConfirmedAt).toBeDefined();

      // Listing must now be COMPLETED
      const listing = await prisma.wasteListing.findUnique({ where: { id: testListingId } });
      expect(listing.status).toBe(ListingStatus.COMPLETED);
    });

    let generatedManifest: any;
    it('9. should verify digital manifest was automatically generated', async () => {
      const manifest = await prisma.digitalManifest.findUnique({
        where: { transactionId: testTransactionId },
      });

      expect(manifest).toBeDefined();
      expect(manifest.manifestNumber).toMatch(/^SAN-2026-\d{6}$/);
      expect(Number(manifest.actualWeightKg)).toBe(8.5);
      expect(manifest.publicToken).toBeDefined();
      expect(manifest.pdfPath).toBeDefined();

      generatedManifest = manifest;
    });

    it('10. should verify public manifest via QR publicToken without exposing private details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/verify/${generatedManifest.publicToken}`)
        .expect(200);

      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.manifestNumber).toBe(generatedManifest.manifestNumber);
      expect(res.body.data.actualWeightKg).toBe(8.5);
      expect(res.body.data.complianceNotice).toContain('not a CPCB-issued EPR certificate');
      // Must not expose phone numbers or exact private address
      expect(res.body.data.phone).toBeUndefined();
      expect(res.body.data.pickupLocation).toBeUndefined();
    });
  });

  // 11. Brand accessing only associated manifests
  describe('11. Brand Manifest Association and Isolation', () => {
    let manifestId: string;

    beforeAll(async () => {
      const manifest = await prisma.digitalManifest.findUnique({
        where: { transactionId: testTransactionId },
      });
      manifestId = manifest.id;
    });

    it('brand should NOT see manifest before admin assigns access', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/brands/manifests')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      const found = res.body.data.items.find((m: any) => m.id === manifestId);
      expect(found).toBeUndefined();
    });

    it('admin associates manifest with brand account', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/brands/${brandId}/manifests/${manifestId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });

    it('brand CAN now view associated manifest', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/brands/manifests')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      const found = res.body.data.items.find((m: any) => m.id === manifestId);
      expect(found).toBeDefined();
      expect(found.manifestNumber).toBeDefined();
    });
  });

  // 12. Dashboard totals matching database records
  describe('12. Dashboard Analytics Consistency', () => {
    it('brand dashboard metrics must match database verified values', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/brands/dashboard')
        .set('Authorization', `Bearer ${brandToken}`)
        .expect(200);

      expect(res.body.data.kpis.totalDocumentedWeightKg).toBe(8.5);
      expect(res.body.data.kpis.verifiedHandoversCount).toBe(1);
      expect(res.body.data.categoryDistribution.length).toBe(1);
      expect(res.body.data.complianceNotice).toBeDefined();
    });

    it('collector dashboard metrics must match recorded earnings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/collectors/dashboard')
        .set('Authorization', `Bearer ${collectorToken}`)
        .expect(200);

      expect(res.body.data.overview.totalWeightCollectedKg).toBe(8.5);
      expect(res.body.data.overview.totalGrossEarnings).toBe(850.0);
    });

    it('admin dashboard platform metrics must aggregate correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.platformMetrics.totalDocumentedWeightKg).toBe(8.5);
      expect(res.body.data.platformMetrics.totalGrossTransactionValue).toBe(850.0);
      expect(res.body.data.platformMetrics.totalPlatformFeesCollected).toBe(17.0);
    });
  });

  // 13. Invalid input and failed status transitions
  describe('13. Validation and Invalid Status Transitions', () => {
    it('should reject negative listing weight', async () => {
      await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${collectorToken}`)
        .send({
          category: WasteCategory.BATTERIES,
          estimatedWeightKg: -15,
          expectedPricePerKg: 50,
          city: 'Mumbai',
          state: 'Maharashtra',
          pickupAddress: 'Address',
        })
        .expect(400);
    });

    it('should reject duplicate confirmations', async () => {
      await request(app.getHttpServer())
        .post(`/api/transactions/${testTransactionId}/collector-confirm`)
        .set('Authorization', `Bearer ${collectorToken}`)
        .expect(400);
    });

    it('should reject cancelling a verified completed handover', async () => {
      await request(app.getHttpServer())
        .post(`/api/transactions/${testTransactionId}/cancel`)
        .set('Authorization', `Bearer ${collectorToken}`)
        .send({ reason: 'Changed mind' })
        .expect(400);
    });
  });
});

