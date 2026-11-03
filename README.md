# Project Sanchay — Digital E-Waste Bridge

> **Tagline:** Digital E-Waste Bridge — Connecting India's Informal Waste Economy to Formal EPR Markets.

Sanchay is an asset-light digital intermediary connecting informal electronic waste collectors (*kabadiwalas*) with authorized e-waste recyclers. The platform records verifiable transactions and creates digital handover manifests, establishing an auditable chain of custody. Electronics brands access authorized transaction records through a reporting dashboard.

---

## 1. Compliance & Regulatory Notice

> [!IMPORTANT]
> **Regulatory Disclaimer:** A Sanchay digital manifest verifies an authenticated, digitally confirmed **handover** on the Sanchay platform. It is **not** a CPCB-issued EPR certificate, government credit, or proof of final smelting/recycling.
>
> Mandatory Notice: *"This document records a digital e-waste handover on the Sanchay platform. It is not a CPCB-issued EPR certificate or independent proof of completed recycling."*

---

## 2. Technology Stack

- **Frontend:** Responsive Single-Page Application (HTML5, Tailwind CSS, Vanilla Modern ES6+ JavaScript, FontAwesome 6)
- **Backend Framework:** NestJS 10 (TypeScript)
- **Database:** PostgreSQL 16 / 18
- **ORM & Migrations:** Prisma ORM 5.22
- **Authentication & Security:** JWT (Access & Refresh token rotation), bcrypt password hashing, Helmet, Rate limiting (`@nestjs/throttler`)
- **Authorization:** Role-Based Access Control (RBAC) with NestJS Guards (`JwtAuthGuard`, `RolesGuard`)
- **Validation & Transformation:** `class-validator`, `class-transformer`
- **API Documentation:** Swagger / OpenAPI 3.0 at `/api/docs`
- **File Uploads:** Local storage with magic-number buffer signature validation
- **QR Code Engine:** `qrcode` (public verification token generation)
- **PDF Generation:** `pdfkit` (digital manifest document generation)
- **Testing:** Jest, Supertest

---

## 3. Architecture & Project Structure

```
├── public/                    # Production Frontend SPA (Served directly by NestJS)
│   ├── index.html             # Single-Page Application Shell (Tailwind CSS, Icons)
│   ├── css/
│   │   └── style.css          # Design system, status badges, progress bars
│   └── js/
│       ├── api.js             # Robust API client with auto-refresh & error handlers
│       └── app.js             # Role routing, state management, modals, and charts
├── src/
│   ├── main.ts                # Bootstrap: Static assets, Swagger, Helmet, CORS
│   ├── app.module.ts          # Root AppModule & Global Providers
│   ├── config/                # Typed environment configuration
│   ├── prisma/                # Global Prisma database service
│   ├── common/                # @Roles, @CurrentUser, Guards, Filters, Interceptors
│   ├── auth/                  # Registration, Login, Token Rotation, Profile
│   ├── users/                 # Profile updates and password management
│   ├── listings/              # Waste listing CRUD & soft cancellation
│   ├── marketplace/           # Filtered public/recycler marketplace
│   ├── transactions/          # Concurrency-safe acceptance, weight & confirmations
│   ├── manifests/             # Digital manifest, QR code, and PDFKit generator
│   ├── collectors/            # Collector KPI dashboard & earnings
│   ├── recyclers/             # Recycler verification profile & dashboard
│   ├── brands/                # Brand sustainability metrics, charts & CSV export
│   ├── admin/                 # Recycler review, manifest association, audit logs
│   ├── audit-logs/            # Append-only audit logger service
│   └── uploads/               # Secure photo, document & evidence uploads
├── prisma/
│   ├── schema.prisma          # Complete database schema with Prisma Decimals
│   ├── migrations/            # Applied SQL migrations (20261103123308_init)
│   └── seed.ts                # Development demonstration seed script
└── test/
    ├── app.e2e-spec.ts        # 13 mandatory test suites (30 tests)
    ├── probe-frontend.ts      # Automated frontend delivery verification script
    └── e2e-workflow-runner.ts # 15-step live HTTP verification script
```

---

## 4. Getting Started & Setup

### Prerequisites
- Node.js v18+ (tested on Node v22.12.0)
- npm or pnpm
- PostgreSQL (Docker or local PostgreSQL)

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default local `.env` values:
```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sanchay_dev?schema=public"
PORT=3000
JWT_ACCESS_SECRET="sanchay_dev_jwt_access_super_secret_key_2026_production_grade"
JWT_REFRESH_SECRET="sanchay_dev_jwt_refresh_super_secret_key_2026_production_grade"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:5173"
BACKEND_PUBLIC_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"
PLATFORM_FEE_PER_KG=2
```

### 2. Database Setup (Docker Compose or Native PostgreSQL)
If using Docker:
```bash
docker-compose up -d
```

### 3. Install Dependencies & Apply Migrations
```bash
npm install
npx prisma generate
npx prisma migrate dev
```

### 4. Seed Demonstration Data
```bash
npm run prisma:seed
```

### 5. Start the Application
```bash
# Development mode with hot-reload
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

- **Frontend Web Application:** [`http://localhost:3000`](http://localhost:3000)
- **REST API Endpoint:** [`http://localhost:3000/api`](http://localhost:3000/api)
- **Interactive Swagger Documentation:** [`http://localhost:3000/api/docs`](http://localhost:3000/api/docs)
- **Public QR Verification:** [`http://localhost:3000/verify`](http://localhost:3000/verify)

---

## 5. Demonstration Accounts (Local Development Only)

All seeded accounts use password: **`Password123!`**

| Role | Email | Name / Organization | Description |
|---|---|---|---|
| **ADMIN** | `admin@sanchay.io` | Sanchay Administrator | Manages users, approves recyclers, assigns brand access |
| **COLLECTOR** | `collector@sanchay.io` | Ramesh Kumar (*Ramesh Scrap*) | Informal kabadiwala aggregator listing e-waste |
| **RECYCLER** | `recycler@sanchay.io` | Vikram Mehta (*GreenCycle Tech*) | Approved recycling facility accepting handovers |
| **BRAND** | `brand@sanchay.io` | Ananya Sharma (*NovaTech India*) | Electronics OEM tracking verified supply chain records |

---

## 6. Complete REST API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new `COLLECTOR`, `RECYCLER`, or `BRAND`.
- `POST /api/auth/login` — Login with email and password (returns access & refresh tokens).
- `POST /api/auth/refresh` — Rotate refresh token and get a new access token.
- `POST /api/auth/logout` — Invalidate refresh token session.
- `GET /api/auth/me` — Retrieve current authenticated user profile.

### User Management (`/api/users`)
- `PATCH /api/users/me` — Update personal profile details (role cannot be altered).
- `PATCH /api/users/change-password` — Change password securely.

### Waste Listings (`/api/listings`)
- `POST /api/listings` — Create a waste listing (`COLLECTOR` or `ADMIN`).
- `GET /api/listings/my` — List all listings created by the authenticated collector.
- `GET /api/listings/:id` — Get details of a specific listing.
- `PATCH /api/listings/:id` — Update an `AVAILABLE` listing.
- `DELETE /api/listings/:id` — Controlled cancellation of an `AVAILABLE` listing.

### Marketplace (`/api/marketplace`)
- `GET /api/marketplace/listings` — Search available waste listings with filters (`category`, `city`, `state`, `minWeight`, `maxWeight`, pagination).
- `GET /api/marketplace/listings/:id` — View listing details for acceptance evaluation.

### Transactions & Handover (`/api/transactions`)
- `GET /api/transactions` — List user transactions.
- `GET /api/transactions/:id` — Get transaction details with manifest and participant data.
- `POST /api/transactions/accept/:listingId` — Verified recycler accepts available listing (**concurrency protected** via Prisma transaction).
- `PATCH /api/transactions/:id/received-weight` — Recycler records verified physical scale weight.
- `POST /api/transactions/:id/evidence` — Attach weighing scale slips and handover photos.
- `POST /api/transactions/:id/collector-confirm` — Collector confirms physical handover.
- `POST /api/transactions/:id/recycler-confirm` — Recycler confirms facility receipt.
  *(Dual confirmation automatically transitions status to `HANDOVER_VERIFIED` and creates `DigitalManifest`)*.
- `POST /api/transactions/:id/cancel` — Cancel pending transaction and release listing.
- `POST /api/transactions/:id/dispute` — Flag transaction for administrative review.

### Digital Manifests (`/api/manifests` & `/api/verify`)
- `GET /api/manifests` — View authorized manifests.
- `GET /api/manifests/:id` — View detailed manifest.
- `GET /api/manifests/:id/pdf` — Download professionally formatted PDF manifest.
- `GET /api/manifests/:id/qr` — Get QR code PNG image.
- `GET /api/verify/:publicToken` — **Public QR verification endpoint** (sanitized, non-sensitive audit details).

### Collector Dashboard (`/api/collectors`)
- `GET /api/collectors/dashboard` — Overview KPIs: documented weight, gross earnings, recent handovers.
- `GET /api/collectors/transactions` — Historical transactions and earnings.

### Recycler Dashboard (`/api/recyclers`)
- `GET /api/recyclers/dashboard` — Recycler metrics: verified handovers, weight received, purchase values.
- `GET /api/recyclers/profile` — Verification status, registration number, approval metadata.
- `GET /api/recyclers/transactions` — Recycler transaction history.

### Brand Dashboard & Analytics (`/api/brands`)
- `GET /api/brands/dashboard` — Real-time analytics from database: total weight, verified handovers, recycler count.
- `GET /api/brands/analytics/categories` — Waste volume breakdown by category.
- `GET /api/brands/analytics/monthly` — Monthly volume trends.
- `GET /api/brands/analytics/locations` — Geographic breakdown by city and state.
- `GET /api/brands/manifests` — Manifests explicitly associated with this brand.
- `GET /api/brands/transactions` — Associated transaction records.
- `GET /api/brands/export/csv` — Export verified chain-of-custody data as CSV.

### Admin Module (`/api/admin`)
- `GET /api/admin/dashboard` — Platform-wide metrics, user distribution, transaction breakdown.
- `GET /api/admin/users` — List registered users.
- `GET /api/admin/recyclers/pending` — View pending recycler applications.
- `PATCH /api/admin/recyclers/:id/approve` — Approve recycler verification.
- `PATCH /api/admin/recyclers/:id/reject` — Reject recycler application.
- `GET /api/admin/listings` — View all listings.
- `GET /api/admin/transactions` — View all transactions.
- `GET /api/admin/manifests` — View all manifests.
- `POST /api/admin/brands/:brandId/manifests/:manifestId` — Grant brand access to a manifest.
- `GET /api/admin/audit-logs` — Review append-only audit trail logs.

### File Uploads (`/api/uploads`)
- `POST /api/uploads/photos` — Upload waste photographs (JPEG, PNG, WebP).
- `POST /api/uploads/documents` — Upload recycler registration documents (PDF, JPEG, PNG).
- `POST /api/uploads/evidence` — Upload handover proof (Photos, Weighing slips).
- `GET /api/uploads/:folder/:filename` — Securely stream uploaded files.

---

## 7. Automated Testing

Run the full end-to-end integration test suite:

```bash
npm run test:e2e
```

**Results:**
- **30 / 30 tests passing (100% pass rate)**
- Validates:
  1. User registration, login, and password hashing.
  2. Unauthorized endpoint access.
  3. Role-based restrictions (RBAC).
  4. Waste listing creation and queries.
  5. Recycler listing acceptance.
  6. Atomic database concurrency protection against double-acceptance.
  7. Physical handover verification & dual confirmations.
  8. Rejection of unauthorized cross-user confirmations.
  9. Automatic digital manifest creation.
  10. Public QR token verification without sensitive data leaks.
  11. Brand manifest isolation and explicit admin association.
  12. Real-time KPI aggregation matching database records.
  13. Input validation and invalid status transition rejections.

---

## 8. Executable 15-Step End-to-End Walkthrough

To execute the live 15-step end-to-end verification script:

```bash
npx ts-node test/e2e-workflow-runner.ts
```

This script performs the complete real-world flow using live HTTP requests and persistent PostgreSQL database transactions:
1. Collector logs in.
2. Collector lists 8 kg of circuit boards @ ₹100/kg.
3. Approved recycler logs in.
4. Recycler locates listing on marketplace.
5. Recycler accepts listing (listing transitions to `RESERVED`).
6. Recycler records received weight (8.25 kg) and uploads scale evidence.
7. Recycler confirms receipt (`PARTIALLY_CONFIRMED`).
8. Collector confirms handover (`HANDOVER_VERIFIED`, listing `COMPLETED`).
9. System automatically generates `DigitalManifest` (e.g. `SAN-2026-000002`).
10. Generates QR code and downloads PDF manifest.
11. Public token verified via QR endpoint with compliance disclaimer.
12. Admin associates manifest with brand account.
13. Brand logs in and views dashboard.
14. Dashboard displays updated verified weight, category breakdown, and KPIs.

