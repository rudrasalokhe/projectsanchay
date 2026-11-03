-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COLLECTOR', 'RECYCLER', 'BRAND', 'ADMIN');

-- CreateEnum
CREATE TYPE "RecyclerRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WasteCategory" AS ENUM ('MOBILE_PHONES', 'LAPTOPS', 'DESKTOP_COMPUTERS', 'CIRCUIT_BOARDS_PCBS', 'BATTERIES', 'CABLES_AND_WIRES', 'ELECTRONIC_COMPONENTS', 'OTHER_ELECTRONIC_WASTE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING_HANDOVER', 'PARTIALLY_CONFIRMED', 'HANDOVER_VERIFIED', 'CANCELLED', 'DISPUTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "organizationName" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecyclerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "registrationDocumentUrl" TEXT,
    "registrationStatus" "RecyclerRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecyclerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteListing" (
    "id" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "category" "WasteCategory" NOT NULL,
    "description" TEXT,
    "estimatedWeightKg" DECIMAL(10,2) NOT NULL,
    "expectedPricePerKg" DECIMAL(10,2) NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "recyclerId" TEXT NOT NULL,
    "agreedPricePerKg" DECIMAL(10,2) NOT NULL,
    "actualWeightKg" DECIMAL(10,2),
    "totalAmount" DECIMAL(12,2),
    "platformFee" DECIMAL(10,2),
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceNotes" TEXT,
    "collectorConfirmedAt" TIMESTAMP(3),
    "recyclerConfirmedAt" TIMESTAMP(3),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING_HANDOVER',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "disputeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalManifest" (
    "id" TEXT NOT NULL,
    "manifestNumber" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "wasteCategory" "WasteCategory" NOT NULL,
    "actualWeightKg" DECIMAL(10,2) NOT NULL,
    "agreedPricePerKg" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "handoverDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickupLocation" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "collectorName" TEXT NOT NULL,
    "recyclerName" TEXT NOT NULL,
    "collectorOrg" TEXT,
    "recyclerOrg" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'HANDOVER_VERIFIED',
    "publicToken" TEXT NOT NULL,
    "qrCodeDataUrl" TEXT,
    "pdfPath" TEXT,
    "disclaimer" TEXT NOT NULL DEFAULT 'This document records a digital e-waste handover on the Sanchay platform. It is not a CPCB-issued EPR certificate or independent proof of completed recycling.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandManifestAccess" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandManifestAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RecyclerProfile_userId_key" ON "RecyclerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecyclerProfile_registrationNumber_key" ON "RecyclerProfile"("registrationNumber");

-- CreateIndex
CREATE INDEX "RecyclerProfile_registrationStatus_idx" ON "RecyclerProfile"("registrationStatus");

-- CreateIndex
CREATE INDEX "WasteListing_status_idx" ON "WasteListing"("status");

-- CreateIndex
CREATE INDEX "WasteListing_category_idx" ON "WasteListing"("category");

-- CreateIndex
CREATE INDEX "WasteListing_city_idx" ON "WasteListing"("city");

-- CreateIndex
CREATE INDEX "WasteListing_collectorId_idx" ON "WasteListing"("collectorId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_collectorId_idx" ON "Transaction"("collectorId");

-- CreateIndex
CREATE INDEX "Transaction_recyclerId_idx" ON "Transaction"("recyclerId");

-- CreateIndex
CREATE INDEX "Transaction_listingId_idx" ON "Transaction"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalManifest_manifestNumber_key" ON "DigitalManifest"("manifestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalManifest_transactionId_key" ON "DigitalManifest"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalManifest_publicToken_key" ON "DigitalManifest"("publicToken");

-- CreateIndex
CREATE INDEX "DigitalManifest_manifestNumber_idx" ON "DigitalManifest"("manifestNumber");

-- CreateIndex
CREATE INDEX "DigitalManifest_publicToken_idx" ON "DigitalManifest"("publicToken");

-- CreateIndex
CREATE INDEX "DigitalManifest_handoverDate_idx" ON "DigitalManifest"("handoverDate");

-- CreateIndex
CREATE INDEX "BrandManifestAccess_brandId_idx" ON "BrandManifestAccess"("brandId");

-- CreateIndex
CREATE INDEX "BrandManifestAccess_manifestId_idx" ON "BrandManifestAccess"("manifestId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandManifestAccess_brandId_manifestId_key" ON "BrandManifestAccess"("brandId", "manifestId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RecyclerProfile" ADD CONSTRAINT "RecyclerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteListing" ADD CONSTRAINT "WasteListing_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "WasteListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recyclerId_fkey" FOREIGN KEY ("recyclerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalManifest" ADD CONSTRAINT "DigitalManifest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandManifestAccess" ADD CONSTRAINT "BrandManifestAccess_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandManifestAccess" ADD CONSTRAINT "BrandManifestAccess_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "DigitalManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
