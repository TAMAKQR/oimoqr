BEGIN;

-- Preserve any legacy billing rows while making the account billing schema
-- provider-neutral for Finik's one-time prepaid payments.
ALTER TABLE "User" RENAME COLUMN "stripeCustomerId" TO "billingCustomerId";
ALTER INDEX "User_stripeCustomerId_key" RENAME TO "User_billingCustomerId_key";

ALTER TABLE "PricingTier" RENAME COLUMN "stripePriceId" TO "externalPriceId";
ALTER INDEX "PricingTier_stripePriceId_key" RENAME TO "PricingTier_externalPriceId_key";
ALTER TABLE "PricingTier"
  ADD COLUMN "onlinePaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "currency" SET DEFAULT 'kgs';

ALTER TABLE "BillingSubscription"
  RENAME COLUMN "stripeSubscriptionId" TO "providerSubscriptionId";
ALTER TABLE "BillingSubscription"
  RENAME COLUMN "stripePriceId" TO "externalPriceId";
ALTER TABLE "BillingSubscription"
  RENAME COLUMN "stripeCreatedAt" TO "providerCreatedAt";
ALTER TABLE "BillingSubscription"
  ALTER COLUMN "providerSubscriptionId" DROP NOT NULL,
  ALTER COLUMN "externalPriceId" DROP NOT NULL,
  ADD COLUMN "provider" TEXT;
UPDATE "BillingSubscription" SET "provider" = 'STRIPE' WHERE "provider" IS NULL;
ALTER TABLE "BillingSubscription"
  ALTER COLUMN "provider" SET NOT NULL,
  ALTER COLUMN "provider" SET DEFAULT 'FINIK';
ALTER INDEX "BillingSubscription_stripeSubscriptionId_key"
  RENAME TO "BillingSubscription_providerSubscriptionId_key";

ALTER TABLE "StripeWebhookEvent" RENAME TO "BillingWebhookEvent";
ALTER TABLE "BillingWebhookEvent"
  RENAME CONSTRAINT "StripeWebhookEvent_pkey" TO "BillingWebhookEvent_pkey";
ALTER TABLE "BillingWebhookEvent"
  RENAME COLUMN "stripeCreatedAt" TO "providerCreatedAt";
ALTER TABLE "BillingWebhookEvent" ADD COLUMN "provider" TEXT;
UPDATE "BillingWebhookEvent" SET "provider" = 'STRIPE' WHERE "provider" IS NULL;
ALTER TABLE "BillingWebhookEvent"
  ALTER COLUMN "provider" SET NOT NULL,
  ALTER COLUMN "provider" SET DEFAULT 'FINIK';
ALTER TABLE "BillingWebhookEvent"
  ADD COLUMN "paymentId" TEXT,
  ADD COLUMN "providerTransactionId" TEXT,
  ADD COLUMN "providerOperationId" TEXT,
  ADD COLUMN "signature" TEXT,
  ADD COLUMN "apiTimestamp" TEXT,
  ADD COLUMN "payload" JSONB;
CREATE INDEX "BillingWebhookEvent_paymentId_idx"
  ON "BillingWebhookEvent"("paymentId");
CREATE INDEX "BillingWebhookEvent_providerTransactionId_idx"
  ON "BillingWebhookEvent"("providerTransactionId");

ALTER TABLE "StripeBillingIssue" RENAME TO "BillingIssue";
ALTER TABLE "BillingIssue"
  RENAME CONSTRAINT "StripeBillingIssue_pkey" TO "BillingIssue_pkey";
ALTER TABLE "BillingIssue"
  RENAME CONSTRAINT "StripeBillingIssue_userId_fkey" TO "BillingIssue_userId_fkey";
ALTER TABLE "BillingIssue"
  RENAME COLUMN "stripeSubscriptionId" TO "providerReferenceId";
ALTER TABLE "BillingIssue"
  RENAME COLUMN "stripePriceId" TO "externalPriceId";
ALTER TABLE "BillingIssue" ADD COLUMN "provider" TEXT;
UPDATE "BillingIssue" SET "provider" = 'STRIPE' WHERE "provider" IS NULL;
ALTER TABLE "BillingIssue"
  ALTER COLUMN "provider" SET NOT NULL,
  ALTER COLUMN "provider" SET DEFAULT 'FINIK';
ALTER INDEX "StripeBillingIssue_stripeSubscriptionId_key"
  RENAME TO "BillingIssue_providerReferenceId_key";
ALTER INDEX "StripeBillingIssue_status_lastSeenAt_idx"
  RENAME TO "BillingIssue_status_lastSeenAt_idx";
ALTER INDEX "StripeBillingIssue_userId_idx"
  RENAME TO "BillingIssue_userId_idx";

CREATE TABLE "BillingPayment" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'FINIK',
  "userId" TEXT NOT NULL,
  "pricingTierId" TEXT,
  "tierName" TEXT NOT NULL,
  "billingInterval" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KGS',
  "status" TEXT NOT NULL DEFAULT 'CREATING',
  "paymentUrl" TEXT,
  "verificationToken" TEXT NOT NULL,
  "providerTransactionId" TEXT,
  "providerOperationId" TEXT,
  "providerPayload" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPayment_providerTransactionId_key"
  ON "BillingPayment"("providerTransactionId");
CREATE UNIQUE INDEX "BillingPayment_verificationToken_key"
  ON "BillingPayment"("verificationToken");
CREATE UNIQUE INDEX "BillingPayment_providerOperationId_key"
  ON "BillingPayment"("providerOperationId");
CREATE INDEX "BillingPayment_userId_status_createdAt_idx"
  ON "BillingPayment"("userId", "status", "createdAt");
CREATE INDEX "BillingPayment_status_expiresAt_idx"
  ON "BillingPayment"("status", "expiresAt");
CREATE INDEX "BillingPayment_pricingTierId_idx"
  ON "BillingPayment"("pricingTierId");

ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_pricingTierId_fkey"
  FOREIGN KEY ("pricingTierId") REFERENCES "PricingTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
