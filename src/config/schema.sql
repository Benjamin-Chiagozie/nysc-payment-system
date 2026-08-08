-- ============================================================
-- NYSC AUTOMATED PAYMENT DISBURSEMENT PLATFORM
-- Database Schema
-- Version: 1.0 | Sprint 2
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE 1: USERS
-- System administrators, finance officers, state coordinators
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (
        role IN ('admin', 'finance_officer', 'state_coordinator')
    ),
    state VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: CORPS_MEMBERS
-- Master beneficiary table
-- ============================================================
CREATE TABLE IF NOT EXISTS corps_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    deployment_state VARCHAR(50) NOT NULL,
    deployment_lga VARCHAR(80) NOT NULL,
    ppa_name VARCHAR(200),
    batch VARCHAR(10) NOT NULL,
    bank_name VARCHAR(100),
    bank_code VARCHAR(10),
    account_number VARCHAR(20),
    account_name VARCHAR(150),
    account_validated BOOLEAN DEFAULT FALSE,
    paystack_recipient_code VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE 3: CLEARANCES
-- Monthly attendance and CDS verification records
-- A corps member MUST have an approved clearance before
-- they can receive payment for that month
-- ============================================================
CREATE TABLE IF NOT EXISTS clearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corps_member_id UUID NOT NULL
        REFERENCES corps_members(id) ON DELETE CASCADE,
    clearance_month DATE NOT NULL,
    attendance_confirmed BOOLEAN DEFAULT FALSE,
    cds_confirmed BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (corps_member_id, clearance_month)
);

-- ============================================================
-- TABLE 4: PAYMENT_BATCHES
-- Groups of payments dispatched together in one cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_month DATE NOT NULL,
    batch_label VARCHAR(100) NOT NULL,
    total_members INTEGER DEFAULT 0,
    total_amount NUMERIC(14,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN (
            'scheduled','processing','completed','failed'
        )),
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE 5: PAYMENTS
-- Individual ₦77,000 transaction per corps member per month
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corps_member_id UUID NOT NULL
        REFERENCES corps_members(id),
    clearance_id UUID
        REFERENCES clearances(id),
    batch_id UUID
        REFERENCES payment_batches(id),
    payment_month DATE NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 77000.00,
    idempotency_key VARCHAR(150) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending','processing','success','failed','reversed'
        )),
    retry_count INTEGER DEFAULT 0,
    failure_reason TEXT,
    paystack_transfer_code VARCHAR(100),
    paystack_reference VARCHAR(100),
    initiated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE (corps_member_id, payment_month)
);

-- ============================================================
-- TABLE 6: AUDIT_LOGS
-- Permanent, append-only record of every system event
-- Nothing in this table is ever updated or deleted
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(20) NOT NULL DEFAULT 'system'
        CHECK (actor_type IN ('user', 'system')),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- Speed up the most common database queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_corps_state_code
    ON corps_members(state_code);

CREATE INDEX IF NOT EXISTS idx_corps_deployment_state
    ON corps_members(deployment_state);

CREATE INDEX IF NOT EXISTS idx_clearances_member
    ON clearances(corps_member_id);

CREATE INDEX IF NOT EXISTS idx_clearances_month_status
    ON clearances(clearance_month, status);

CREATE INDEX IF NOT EXISTS idx_payments_member
    ON payments(corps_member_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_batch
    ON payments(batch_id);

CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_actor
    ON audit_logs(actor_id);