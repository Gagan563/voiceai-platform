-- ============================================
-- NOVA VoiceAI Platform — Full Schema Migration
-- ============================================
--
-- Upgrades from init_memory (User + Memory only) to the complete schema
-- with all 12 models: User, Memory, Session, Message, Routine, Execution,
-- Task, MoodLog, FinanceRecord, EmergencyContact, GeneratedDocument, ModuleRecord.

-- ── Upgrade User table (add new columns) ──
ALTER TABLE "User" RENAME TO "users";

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "password" TEXT,
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

-- Make email unique (skip if users exist without email)
DO $$
BEGIN
  -- Set email for any existing rows that don't have one
  UPDATE "users" SET "email" = "id" || '@nova.local' WHERE "email" IS NULL;
  UPDATE "users" SET "updated_at" = NOW() WHERE "updated_at" IS NULL;

  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
  END IF;
END $$;

-- Rename User columns to match schema mapping
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";

-- ── Upgrade Memory table ──
ALTER TABLE "Memory" RENAME TO "memories";
ALTER TABLE "memories" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "memories" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "memories"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'fact',
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Update foreign key reference
ALTER TABLE "memories" DROP CONSTRAINT IF EXISTS "Memory_userId_fkey";
ALTER TABLE "memories"
  ADD CONSTRAINT "memories_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Sessions ──
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_fkey";
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Messages ──
CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "type" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "messages_session_id_idx" ON "messages"("session_id");

ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_session_id_fkey";
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Routines ──
CREATE TABLE IF NOT EXISTS "routines" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "trigger" TEXT NOT NULL,
  "actions" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_run" TIMESTAMP(3),
  "run_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- ── Executions ──
CREATE TABLE IF NOT EXISTS "executions" (
  "id" TEXT NOT NULL,
  "intent" JSONB,
  "plan" JSONB,
  "result" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "duration" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- ── Tasks ──
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'todo',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "tags" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks"("user_id");
CREATE INDEX IF NOT EXISTS "tasks_user_id_status_idx" ON "tasks"("user_id", "status");

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_user_id_fkey";
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── MoodLogs ──
CREATE TABLE IF NOT EXISTS "mood_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "mood" INTEGER NOT NULL,
  "note" TEXT,
  "metrics" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mood_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mood_logs_user_id_idx" ON "mood_logs"("user_id");
CREATE INDEX IF NOT EXISTS "mood_logs_user_id_created_at_idx" ON "mood_logs"("user_id", "created_at");

ALTER TABLE "mood_logs" DROP CONSTRAINT IF EXISTS "mood_logs_user_id_fkey";
ALTER TABLE "mood_logs"
  ADD CONSTRAINT "mood_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── FinanceRecords ──
CREATE TABLE IF NOT EXISTS "finance_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "category" TEXT,
  "description" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "finance_records_user_id_idx" ON "finance_records"("user_id");
CREATE INDEX IF NOT EXISTS "finance_records_user_id_date_idx" ON "finance_records"("user_id", "date");

ALTER TABLE "finance_records" DROP CONSTRAINT IF EXISTS "finance_records_user_id_fkey";
ALTER TABLE "finance_records"
  ADD CONSTRAINT "finance_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── EmergencyContacts ──
CREATE TABLE IF NOT EXISTS "emergency_contacts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "relationship" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "emergency_contacts_user_id_idx" ON "emergency_contacts"("user_id");

ALTER TABLE "emergency_contacts" DROP CONSTRAINT IF EXISTS "emergency_contacts_user_id_fkey";
ALTER TABLE "emergency_contacts"
  ADD CONSTRAINT "emergency_contacts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── GeneratedDocuments ──
CREATE TABLE IF NOT EXISTS "generated_documents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "country" TEXT,
  "language" TEXT DEFAULT 'en',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "generated_documents_user_id_idx" ON "generated_documents"("user_id");

ALTER TABLE "generated_documents" DROP CONSTRAINT IF EXISTS "generated_documents_user_id_fkey";
ALTER TABLE "generated_documents"
  ADD CONSTRAINT "generated_documents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ModuleRecords ──
CREATE TABLE IF NOT EXISTS "module_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "data" JSONB,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "module_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "module_records_user_id_idx" ON "module_records"("user_id");
CREATE INDEX IF NOT EXISTS "module_records_user_id_module_idx" ON "module_records"("user_id", "module");

ALTER TABLE "module_records" DROP CONSTRAINT IF EXISTS "module_records_user_id_fkey";
ALTER TABLE "module_records"
  ADD CONSTRAINT "module_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
