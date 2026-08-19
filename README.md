# 🇳🇬 Automated NYSC Payment Disbursement Platform

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Authentication-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Paystack](https://img.shields.io/badge/Paystack-Payment_Gateway-00C3F7?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-In_Development-orange?style=for-the-badge)

> A secure, scalable, and fully automated web-based platform for disbursing monthly allowances (₦77,000) to NYSC corps members — replacing the fragmented manual process with intelligent batch scheduling, pre-payment bank account validation, real-time payment tracking, automated failure recovery, and a comprehensive fraud-prevention audit infrastructure.

---

## 📋 Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [API Endpoints](#-api-endpoints)
- [Database Schema](#-database-schema)
- [Development Sprints](#-development-sprints)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Security](#-security)
- [Academic Context](#-academic-context)
- [Author](#-author)

---

## 🚨 The Problem

The National Youth Service Corps (NYSC) scheme mobilizes approximately **350,000 corps members** annually across Nigeria's 36 states and FCT. Every month, each corps member is entitled to a ₦77,000 allowance — colloquially known as **"allawee"** — funded by the Federal Government of Nigeria.

The current disbursement process is **manual, fragmented, and structurally inadequate**, producing five recurring failures:

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Payment delays** — oversized single batches cause bank network congestion | Corps members wait days or weeks beyond expected payment date |
| 2 | **Failed payments** — bank account details never validated before dispatch | Money sent to invalid or dormant accounts |
| 3 | **No real-time visibility** — corps members have no way to track payment status | High inquiry volume at coordination offices, distress among members |
| 4 | **Duplicate payments** — no idempotency controls | Financial leakage, irrecoverable double payments |
| 5 | **No audit trail** — no immutable record of who authorized what | Fraud vulnerability, impossible forensic investigation |

---

## ✅ The Solution

The **Automated NYSC Payment Disbursement Platform** resolves all five problems through a purpose-built, integrated system:

```
Corps Member Registered
        ↓
Bank Account Validated via Paystack API
        ↓
Monthly Clearance Approved (attendance + CDS confirmed)
        ↓
OTP Confirmation by Finance Officer
        ↓
Dynamic Batch Scheduler dispatches ₦77,000 payments
        ↓
Failed payments → 3-stage automated retry
        ↓
Corps member notified via SMS + Email in real time
        ↓
Every action permanently recorded in Audit Log
```

---

## ⭐ Key Features

### 🔐 Security & Authentication
- JWT-based stateless authentication with 24-hour token expiry
- Role-Based Access Control (RBAC) across 4 roles: Admin, Finance Officer, State Coordinator, Corps Member
- bcrypt password hashing (cost factor 12)
- Rate limiting — 5 login attempts per 15 minutes per IP
- Helmet.js HTTP security headers on every response
- OTP confirmation required before any payment batch is dispatched

### 👥 Corps Member Management
- Full CRUD operations on 1,050+ corps member records
- Search by name, state code, or email
- Filter by deployment state, batch, validation status
- Pagination support for large datasets
- Bank details update with automatic validation reset
- Activate/deactivate corps members

### 🏦 Bank Account Validation
- Pre-payment validation via Paystack Bank Account Resolution API
- Single and bulk validation endpoints
- Automatic Paystack transfer recipient creation for validated members
- Invalid accounts flagged with failure reason before any money moves

### 💰 Payment Batch Engine *(Sprint 6)*
- Dynamic batch partitioning — splits 350,000 payments into manageable sub-batches
- Interval-based dispatch to prevent bank network congestion
- 3-stage automated retry protocol:
  - Stage 1: Immediate retry
  - Stage 2: Delayed retry (30 minutes)
  - Stage 3: Administrative escalation
- Idempotency key enforcement — mathematically impossible to pay the same person twice in the same month
- OTP confirmation layer before batch dispatch

### 📊 Real-Time Tracking *(Sprint 7)*
- Live payment status dashboard (Pending → Processing → Paid/Failed)
- Paystack webhook handler for instant payment event callbacks
- Automated email and SMS notifications at each payment lifecycle event

### 🔍 Audit & Fraud Prevention
- Immutable, append-only audit log for every system event
- Captures: actor, action, affected record, timestamp, IP address
- Duplicate payment detection at both application and database level
- Ghost-beneficiary prevention through mandatory pre-payment validation

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│         (Admin Portal / Corps Member Dashboard)          │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│                  APPLICATION LAYER                       │
│                                                          │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  Routes  │→ │ Controllers │→ │    Services       │   │
│  └──────────┘  └─────────────┘  │  ┌─────────────┐ │   │
│                                  │  │  Paystack   │ │   │
│  ┌────────────────────────────┐  │  │  Service    │ │   │
│  │        Middleware           │  │  └─────────────┘ │   │
│  │  JWT Auth │ RBAC │ Validate│  │  ┌─────────────┐ │   │
│  └────────────────────────────┘  │  │  Payment    │ │   │
│                                  │  │  Engine     │ │   │
│                                  │  └─────────────┘ │   │
│                                  └──────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   DATA LAYER                             │
│                                                          │
│   PostgreSQL Database (nysc_payment_db)                  │
│   ┌──────────┐ ┌──────────────┐ ┌───────────────────┐  │
│   │  users   │ │corps_members │ │    clearances      │  │
│   └──────────┘ └──────────────┘ └───────────────────┘  │
│   ┌──────────┐ ┌──────────────┐ ┌───────────────────┐  │
│   │ payments │ │payment_batch │ │    audit_logs      │  │
│   └──────────┘ └──────────────┘ └───────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               EXTERNAL SERVICES                          │
│                                                          │
│   ┌──────────────────────────────────────────────────┐  │
│   │  Paystack API (CBN Licensed)                     │  │
│   │  • Bank Account Resolution                       │  │
│   │  • Bulk Transfer API                             │  │
│   │  • Webhook Notifications                         │  │
│   └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Runtime** | Node.js 20 LTS | Non-blocking I/O for high-concurrency payment dispatch |
| **Framework** | Express.js 5 | Minimal, flexible, security middleware ecosystem |
| **Database** | PostgreSQL 16 | ACID transactions, relational integrity, duplicate prevention constraints |
| **Authentication** | JSON Web Tokens (JWT) | Stateless, role-carrying tokens for scalable RBAC |
| **Password Hashing** | bcryptjs | Industry-standard adaptive hashing |
| **Payment Gateway** | Paystack API | CBN-licensed, bulk transfer, account resolution, webhook support |
| **Input Validation** | Joi | Schema-based validation on all API endpoints |
| **HTTP Client** | Axios | Paystack API communication |
| **Security Headers** | Helmet.js | Protective HTTP headers on every response |
| **Rate Limiting** | express-rate-limit | Brute-force attack prevention |
| **Version Control** | Git + GitHub | Sprint-level commit history, traceable development record |
| **IDE** | VS Code | Integrated terminal and API testing |

---

## 📡 API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/login` | Public | Login and receive JWT token |
| `GET` | `/me` | All roles | Get current user profile |
| `POST` | `/logout` | All roles | Logout and record audit entry |
| `POST` | `/register` | Admin only | Create new system user |
| `GET` | `/users` | Admin only | Get all system users |

### Corps Members (`/api/corps-members`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | All roles | Get all corps members (paginated, filterable) |
| `GET` | `/dashboard/summary` | All roles | Get dashboard metrics |
| `GET` | `/:id` | All roles | Get single corps member with history |
| `GET` | `/state-code/:code` | All roles | Find member by NYSC state code |
| `PATCH` | `/:id/bank-details` | Admin, Finance | Update bank account details |
| `PATCH` | `/:id/deactivate` | Admin, Coordinator | Deactivate corps member |
| `PATCH` | `/:id/reactivate` | Admin, Coordinator | Reactivate corps member |

### Validation (`/api/validation`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/banks` | All roles | Get list of all Nigerian banks |
| `GET` | `/summary` | All roles | Get validation status summary |
| `POST` | `/validate/:id` | Admin, Finance | Validate single account via Paystack |
| `POST` | `/bulk-validate` | Admin, Finance | Validate all pending accounts |

### Payments (`/api/payments`) *(Sprint 6)*
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/request-otp` | Finance | Request OTP before batch dispatch |
| `POST` | `/verify-otp` | Finance | Verify OTP to authorize dispatch |
| `POST` | `/initiate-batch` | Finance | Initiate payment batch after OTP |
| `GET` | `/batches` | All roles | Get all payment batches |
| `GET` | `/batch/:id` | All roles | Get single batch with all payments |
| `POST` | `/retry/:id` | Admin, Finance | Manually retry failed payment |

### Notifications (`/api/notifications`) *(Sprint 7)*
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/webhook/paystack` | System | Paystack webhook handler |
| `GET` | `/payment-status/:stateCode` | Corps Member | Check own payment status |

---

## 🗄 Database Schema

```
users
├── id (UUID, PK)
├── full_name
├── email (UNIQUE)
├── password_hash
├── role (admin | finance_officer | state_coordinator)
├── state
└── is_active

corps_members
├── id (UUID, PK)
├── state_code (UNIQUE) ← e.g. LA/24A/1234
├── full_name, email, phone_number
├── deployment_state, deployment_lga, ppa_name, batch
├── bank_name, bank_code, account_number, account_name
├── account_validated ← FALSE until Paystack confirms
└── paystack_recipient_code ← used to send money

clearances
├── id (UUID, PK)
├── corps_member_id (FK → corps_members)
├── clearance_month
├── attendance_confirmed, cds_confirmed
├── status (pending | approved | rejected)
└── UNIQUE (corps_member_id, clearance_month)

payment_batches
├── id (UUID, PK)
├── batch_month, batch_label
├── total_members, total_amount
└── status (scheduled | processing | completed | failed)

payments
├── id (UUID, PK)
├── corps_member_id (FK → corps_members)
├── clearance_id (FK → clearances) ← proves eligibility
├── batch_id (FK → payment_batches)
├── payment_month
├── amount (₦77,000 default)
├── idempotency_key (UNIQUE) ← prevents duplicate payments
├── status (pending | processing | success | failed | reversed)
├── retry_count
└── UNIQUE (corps_member_id, payment_month) ← database-level duplicate prevention

audit_logs
├── id (UUID, PK)
├── actor_id (FK → users)
├── actor_type (user | system)
├── action ← e.g. LOGIN_SUCCESS, PAYMENT_INITIATED
├── entity_type, entity_id
├── details (JSONB)
└── created_at ← append-only, never updated
```

---

## 🚀 Development Sprints

| Sprint | Title | Status | Key Deliverables |
|--------|-------|--------|-----------------|
| **1** | Project Setup & Environment | ✅ Complete | Node.js, PostgreSQL, Express, folder structure, database connection |
| **2** | Database Schema & Synthetic Data | ✅ Complete | 6-table schema, 1,050 synthetic corps member records |
| **3** | Authentication & RBAC | ✅ Complete | JWT login, 4-role RBAC, audit logging of all auth events |
| **4** | Corps Member Management | ✅ Complete | Search, filter, paginate, update bank details, dashboard summary |
| **5** | Bank Account Validation | ✅ Complete | Paystack Bank Resolution API, single + bulk validation, recipient creation |
| **6** | Payment Batch Engine + OTP | 🔄 In Progress | Dynamic scheduling, 3-stage retry, idempotency, OTP confirmation |
| **7** | Real-Time Tracking & Notifications | ⏳ Pending | Paystack webhooks, SMS/email notifications, payment tracking portal |
| **8** | Audit Dashboard & Testing | ⏳ Pending | Admin analytics, immutable audit viewer, full functional testing |

---

## 🏁 Getting Started

### Prerequisites
- Node.js v20 or higher
- PostgreSQL 16
- A Paystack account (free at [paystack.com](https://paystack.com))
- Git

### Installation

**1. Clone the repository:**
```bash
git clone https://github.com/Benjamin-Chiagozie/nysc-payment-system.git
cd nysc-payment-system/backend
```

**2. Install dependencies:**
```bash
npm install
```

**3. Create your environment file:**
```bash
cp .env.example .env
```
Then edit `.env` with your own values (see Environment Variables below).

**4. Create the database:**
```sql
-- In pgAdmin or psql:
CREATE DATABASE nysc_payment_db;
```

**5. Run the database schema:**
```bash
psql -U postgres -d nysc_payment_db -f src/config/schema.sql
```

**6. Seed the database with synthetic data:**
```bash
node src/config/seed.js
```

**7. Start the development server:**
```bash
npm run dev
```

**8. Verify the server is running:**
```
http://localhost:5000/api/health
```

### Default Login Credentials
```
Admin:               admin@nysc-payment.gov.ng      / Admin@2024
Finance Officer:     finance.lagos@nysc-payment.gov.ng / Admin@2024
State Coordinator:   coordinator.lagos@nysc-payment.gov.ng / Admin@2024
```

---

## 🔧 Environment Variables

Create a `.env` file in the `backend` folder with these variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nysc_payment_db
DB_USER=postgres
DB_PASSWORD=your_postgresql_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# Paystack (use test keys from dashboard.paystack.com)
PAYSTACK_SECRET_KEY=sk_test_your_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_key_here

# App
FRONTEND_URL=http://localhost:3000
```

> ⚠️ **Never commit your `.env` file to GitHub.** It is already listed in `.gitignore`.

---

## 🔒 Security

This platform implements multiple layers of security:

- **Authentication:** JWT tokens with 24-hour expiry
- **Authorization:** Fine-grained RBAC — no single role can both initiate and approve a payment
- **Password Storage:** bcrypt with cost factor 12 (4,096 hashing rounds)
- **Rate Limiting:** 5 login attempts per 15 minutes per IP address
- **OTP Layer:** 6-digit one-time password required before any payment batch is dispatched
- **HTTP Headers:** Helmet.js adds 11 security headers to every response
- **Input Validation:** Joi schema validation on every API endpoint
- **Duplicate Prevention:** Idempotency keys enforced at both application and database level
- **Audit Trail:** Every action permanently recorded — no updates, no deletes
- **Webhook Verification:** HMAC-SHA512 signature verification on all Paystack callbacks

---

## 🎓 Academic Context

This project was developed as a final-year Computer Science capstone project at **[Your University Name]**.

- **Title:** Automated NYSC Payment Disbursement Platform
- **Methodology:** Agile/Scrum across 8 sprints using Design Science Research (DSR)
- **Data Strategy:** Synthetic dataset of 1,050 corps member records (stratified by data quality)
- **Evaluation:** Functional test case matrix + quantitative performance benchmarks
- **Payment Gateway:** Paystack test-mode sandbox (CBN-licensed)

---

## 👨‍💻 Author

**Benjamin Chiagozie**
Final Year Computer Science Student

[![GitHub](https://img.shields.io/badge/GitHub-Benjamin--Chiagozie-181717?style=for-the-badge&logo=github)](https://github.com/Benjamin-Chiagozie)

---

## 📄 License

This project is licensed under the MIT License.

---

> *"The absence of an automated, intelligent, and auditable disbursement platform is the single structural cause underpinning all five payment failure dimensions experienced by NYSC corps members annually."*
> — Research Gap Statement, Chapter Two
