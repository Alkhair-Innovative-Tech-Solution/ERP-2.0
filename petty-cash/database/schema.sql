-- ============================================
-- NGO EXPENSE MANAGEMENT SYSTEM
-- PostgreSQL Database Schema
-- ============================================

-- Branches / Campuses
CREATE TABLE IF NOT EXISTS branches (
    id              BIGSERIAL PRIMARY KEY,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('head_office','school','college','hospital','medical_center','it_institute')),
    name            VARCHAR(200) NOT NULL,
    code            VARCHAR(20) UNIQUE NOT NULL,
    location        VARCHAR(255) NOT NULL DEFAULT '',
    contact         VARCHAR(20) NOT NULL DEFAULT '',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    password        VARCHAR(128) NOT NULL,
    last_login      TIMESTAMPTZ,
    is_superuser    BOOLEAN NOT NULL DEFAULT FALSE,
    username        VARCHAR(150) UNIQUE NOT NULL,
    first_name      VARCHAR(150) NOT NULL DEFAULT '',
    last_name       VARCHAR(150) NOT NULL DEFAULT '',
    email           VARCHAR(254) NOT NULL DEFAULT '',
    is_staff        BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    role            VARCHAR(20) NOT NULL DEFAULT 'branch_manager'
                        CHECK (role IN ('accounts_head', 'branch_manager', 'auditor')),
    department      VARCHAR(100) NOT NULL DEFAULT '',
    employee_id     VARCHAR(50) UNIQUE,
    phone           VARCHAR(20) NOT NULL DEFAULT '',
    branch_id       BIGINT REFERENCES branches(id) ON DELETE SET NULL
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    is_allowed      BOOLEAN NOT NULL DEFAULT TRUE,
    monthly_limit   NUMERIC(10, 2) CHECK (monthly_limit >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly Budgets (per branch)
CREATE TABLE IF NOT EXISTS monthly_budgets (
    id              BIGSERIAL PRIMARY KEY,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    department      VARCHAR(100) NOT NULL DEFAULT 'General',
    total_budget    NUMERIC(12, 2) NOT NULL CHECK (total_budget > 0),
    notes           TEXT NOT NULL DEFAULT '',
    created_by_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    branch_id       BIGINT REFERENCES branches(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (year, month, department, branch_id)
);

-- Transactions (per branch)
CREATE TABLE IF NOT EXISTS transactions (
    id              BIGSERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    amount          NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    category_id     BIGINT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    budget_id       BIGINT REFERENCES monthly_budgets(id) ON DELETE RESTRICT,
    description     TEXT NOT NULL,
    receipt         VARCHAR(255),
    vendor_name     VARCHAR(200) NOT NULL DEFAULT '',
    entered_by_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    branch_id       BIGINT REFERENCES branches(id) ON DELETE CASCADE,
    is_void         BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason     TEXT NOT NULL DEFAULT '',
    voided_by_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    voided_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cash Fund (per branch)
CREATE TABLE IF NOT EXISTS cash_fund (
    id                      INTEGER NOT NULL DEFAULT 1,
    current_balance         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    low_balance_threshold   NUMERIC(10, 2) NOT NULL DEFAULT 5000,
    branch_id               BIGINT REFERENCES branches(id) ON DELETE CASCADE,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, branch_id)
);

-- Replenishments (per branch)
CREATE TABLE IF NOT EXISTS replenishments (
    id                  BIGSERIAL PRIMARY KEY,
    amount              NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    date                DATE NOT NULL,
    reference_number    VARCHAR(100) NOT NULL DEFAULT '',
    notes               TEXT NOT NULL DEFAULT '',
    added_by_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    branch_id           BIGINT REFERENCES branches(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(20) NOT NULL
                    CHECK (action IN ('create','update','void','login','replenish','budget_set')),
    model_name  VARCHAR(50) NOT NULL,
    object_id   INTEGER,
    description TEXT NOT NULL,
    ip_address  INET,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category   ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch     ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_void    ON transactions(is_void);
CREATE INDEX IF NOT EXISTS idx_transactions_entered_by ON transactions(entered_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp    ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user         ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_replenishments_date     ON replenishments(date);
CREATE INDEX IF NOT EXISTS idx_replenishments_branch   ON replenishments(branch_id);
CREATE INDEX IF NOT EXISTS idx_budgets_branch          ON monthly_budgets(branch_id);
