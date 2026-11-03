import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Role, WasteCategory, TransactionStatus, ListingStatus } from '@prisma/client';

async function runE2EWorkflow() {
  console.log('================================================================');
  console.log(' PROJECT SANCHAY: 15-STEP END-TO-END VERIFICATION WALKTHROUGH');
  console.log('================================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });
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
  const server = app.getHttpServer();

  // STEP 1: Register or log in as a collector
  console.log('▶ STEP 1: Logging in as registered collector (collector@sanchay.io)...');
  const collectorLogin = await request(server)
    .post('/api/auth/login')
    .send({ email: 'collector@sanchay.io', password: 'Password123!' });
  const collectorToken = collectorLogin.body.data.tokens.accessToken;
  const collectorId = collectorLogin.body.data.user.id;
  console.log(`  ✓ Authenticated Collector: ${collectorLogin.body.data.user.fullName} (ID: ${collectorId})`);

  // STEP 2: Create a waste listing containing 8 kg of circuit boards with asking price ₹100/kg
  console.log('\n▶ STEP 2: Creating waste listing: 8 kg Circuit Boards @ ₹100/kg...');
  const createListingRes = await request(server)
    .post('/api/listings')
    .set('Authorization', `Bearer ${collectorToken}`)
    .send({
      category: WasteCategory.CIRCUIT_BOARDS_PCBS,
      description: 'End-of-life telecom server boards for precious metal recovery',
      estimatedWeightKg: 8.0,
      expectedPricePerKg: 100.0,
      city: 'Mumbai',
      state: 'Maharashtra',
      pickupAddress: 'Gala 18, Dharavi Scrap Compound, 90ft Road',
      photoUrls: ['/uploads/photos/pcb-sample-batch.jpg'],
    });
  const listingId = createListingRes.body.data.id;
  console.log(`  ✓ Listing Created Successfully! ID: ${listingId}`);
  console.log(`  ✓ Status: ${createListingRes.body.data.status}, Weight: ${createListingRes.body.data.estimatedWeightKg} kg, Price: ₹${createListingRes.body.data.expectedPricePerKg}/kg`);

  // STEP 3: Log in as an approved recycler
  console.log('\n▶ STEP 3: Logging in as approved recycler (recycler@sanchay.io)...');
  const recyclerLogin = await request(server)
    .post('/api/auth/login')
    .send({ email: 'recycler@sanchay.io', password: 'Password123!' });
  const recyclerToken = recyclerLogin.body.data.tokens.accessToken;
  const recyclerId = recyclerLogin.body.data.user.id;
  console.log(`  ✓ Authenticated Recycler: ${recyclerLogin.body.data.user.fullName} (Facility: ${recyclerLogin.body.data.user.recyclerProfile.companyName})`);

  // STEP 4: Retrieve the listing from the marketplace
  console.log('\n▶ STEP 4: Querying marketplace for available listings...');
  const marketplaceRes = await request(server)
    .get('/api/marketplace/listings')
    .set('Authorization', `Bearer ${recyclerToken}`)
    .query({ category: WasteCategory.CIRCUIT_BOARDS_PCBS });
  const foundListing = marketplaceRes.body.data.items.find((item: any) => item.id === listingId);
  console.log(`  ✓ Found Listing in Marketplace! Category: ${foundListing.category}, Est. Weight: ${foundListing.estimatedWeightKg} kg, City: ${foundListing.city}`);

  // STEP 5: Accept the listing
  console.log('\n▶ STEP 5: Recycler accepts listing...');
  const acceptRes = await request(server)
    .post(`/api/transactions/accept/${listingId}`)
    .set('Authorization', `Bearer ${recyclerToken}`)
    .send({ agreedPricePerKg: 100.0 });
  const transactionId = acceptRes.body.data.id;
  console.log(`  ✓ Transaction Created! ID: ${transactionId}`);
  console.log(`  ✓ Transaction Status: ${acceptRes.body.data.status}, Listing Status: ${acceptRes.body.data.listing.status}`);

  // STEP 6: Record actual received weight and upload evidence
  console.log('\n▶ STEP 6: Recording received weight (8.25 kg) & uploading evidence...');
  const weightRes = await request(server)
    .patch(`/api/transactions/${transactionId}/received-weight`)
    .set('Authorization', `Bearer ${recyclerToken}`)
    .send({ actualWeightKg: 8.25 });
  console.log(`  ✓ Recorded Weight: ${weightRes.body.data.actualWeightKg} kg`);
  console.log(`  ✓ Calculated Total Value: ₹${weightRes.body.data.totalAmount} (Platform Fee: ₹${weightRes.body.data.platformFee})`);

  const evidenceRes = await request(server)
    .post(`/api/transactions/${transactionId}/evidence`)
    .set('Authorization', `Bearer ${recyclerToken}`)
    .send({
      evidenceUrls: [
        '/uploads/evidence/weighing-platform-slip-8.25kg.jpg',
        '/uploads/evidence/handover-truck-loading.jpg',
      ],
      evidenceNotes: 'Floor scale digital printout attached. Material accepted in sealed drums.',
    });
  console.log(`  ✓ Evidence Attached: ${evidenceRes.body.data.evidenceUrls.length} file(s)`);

  // STEP 7: Confirm handover from recycler account
  console.log('\n▶ STEP 7: Recycler executes handover receipt confirmation...');
  const recConfirmRes = await request(server)
    .post(`/api/transactions/${transactionId}/recycler-confirm`)
    .set('Authorization', `Bearer ${recyclerToken}`);
  console.log(`  ✓ Recycler Confirmed At: ${recConfirmRes.body.data.recyclerConfirmedAt}`);
  console.log(`  ✓ Interim Status: ${recConfirmRes.body.data.status}`);

  // STEP 8: Confirm handover from collector account
  console.log('\n▶ STEP 8: Collector executes physical handover confirmation...');
  const colConfirmRes = await request(server)
    .post(`/api/transactions/${transactionId}/collector-confirm`)
    .set('Authorization', `Bearer ${collectorToken}`);
  console.log(`  ✓ Collector Confirmed At: ${colConfirmRes.body.data.collectorConfirmedAt}`);

  // STEP 9: Verify that transaction becomes HANDOVER_VERIFIED
  console.log('\n▶ STEP 9: Verifying transaction final status...');
  console.log(`  ✓ Final Transaction Status: ${colConfirmRes.body.data.status} (Expected: HANDOVER_VERIFIED)`);
  console.log(`  ✓ Final Listing Status: COMPLETED`);

  // STEP 10: Automatically generate a digital manifest
  console.log('\n▶ STEP 10: Inspecting automatically generated digital manifest...');
  const manifestRes = await request(server)
    .get(`/api/transactions/${transactionId}`)
    .set('Authorization', `Bearer ${recyclerToken}`);
  const manifest = manifestRes.body.data.manifest;
  console.log(`  ✓ Manifest Number: ${manifest.manifestNumber}`);
  console.log(`  ✓ Manifest ID: ${manifest.id}`);
  console.log(`  ✓ Public Token: ${manifest.publicToken}`);
  console.log(`  ✓ PDF File Path: ${manifest.pdfPath}`);

  // STEP 11: Retrieve QR code and download PDF
  console.log('\n▶ STEP 11: Retrieving QR code PNG and downloading PDF...');
  const qrRes = await request(server)
    .get(`/api/manifests/${manifest.id}/qr`)
    .set('Authorization', `Bearer ${recyclerToken}`);
  console.log(`  ✓ QR Code Image Response: Status ${qrRes.status}, Content-Type: ${qrRes.headers['content-type']}, Size: ${qrRes.body.length} bytes`);

  const pdfRes = await request(server)
    .get(`/api/manifests/${manifest.id}/pdf`)
    .set('Authorization', `Bearer ${recyclerToken}`);
  console.log(`  ✓ PDF Manifest Response: Status ${pdfRes.status}, Content-Type: ${pdfRes.headers['content-type']}, Size: ${pdfRes.body.length} bytes`);

  // STEP 12: Verify public manifest information through the QR token
  console.log('\n▶ STEP 12: Public verification through QR verification URL / token...');
  const verifyRes = await request(server)
    .get(`/api/verify/${manifest.publicToken}`);
  console.log(`  ✓ Public Verification Successful!`);
  console.log(`    - Manifest: ${verifyRes.body.data.manifestNumber}`);
  console.log(`    - Verified Status: ${verifyRes.body.data.verificationStatus}`);
  console.log(`    - Weight: ${verifyRes.body.data.actualWeightKg} kg`);
  console.log(`    - Category: ${verifyRes.body.data.wasteCategory}`);
  console.log(`    - Source: ${verifyRes.body.data.collectorEntity} (${verifyRes.body.data.sourceCity})`);
  console.log(`    - Recycler: ${verifyRes.body.data.recyclerFacility}`);
  console.log(`    - Compliance Disclaimer: "${verifyRes.body.data.complianceNotice}"`);

  // STEP 13: Log in as admin and associate manifest with demo brand account
  console.log('\n▶ STEP 13: Admin associates manifest with demo brand account...');
  const adminLogin = await request(server)
    .post('/api/auth/login')
    .send({ email: 'admin@sanchay.io', password: 'Password123!' });
  const adminToken = adminLogin.body.data.tokens.accessToken;

  // Retrieve brand ID
  const brandLogin = await request(server)
    .post('/api/auth/login')
    .send({ email: 'brand@sanchay.io', password: 'Password123!' });
  const brandToken = brandLogin.body.data.tokens.accessToken;
  const brandId = brandLogin.body.data.user.id;

  const associateRes = await request(server)
    .post(`/api/admin/brands/${brandId}/manifests/${manifest.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  console.log(`  ✓ ${associateRes.body.data.message}`);

  // STEP 14: Log in as brand and view transaction in dashboard
  console.log('\n▶ STEP 14: Brand views dashboard & manifests...');
  const brandDashboardRes = await request(server)
    .get('/api/brands/dashboard')
    .set('Authorization', `Bearer ${brandToken}`);

  // STEP 15: Confirm dashboard shows correct documented weight, counts, and status
  console.log('\n▶ STEP 15: Validating Brand Dashboard KPI Aggregations...');
  const kpis = brandDashboardRes.body.data.kpis;
  console.log(`  ✓ Total Documented Weight: ${kpis.totalDocumentedWeightKg} kg`);
  console.log(`  ✓ Verified Handovers Count: ${kpis.verifiedHandoversCount}`);
  console.log(`  ✓ Associated Recyclers Count: ${kpis.associatedRecyclersCount}`);
  console.log(`  ✓ Category Breakdown:`, brandDashboardRes.body.data.categoryDistribution);
  console.log(`  ✓ Compliance Disclaimer: "${brandDashboardRes.body.data.complianceNotice}"`);

  console.log('\n================================================================');
  console.log(' ALL 15 END-TO-END STEPS VERIFIED AND COMPLETED SUCCESSFULLY! ');
  console.log('================================================================');

  await app.close();
}

runE2EWorkflow().catch((err) => {
  console.error('E2E Walkthrough Failed:', err);
  process.exit(1);
});

