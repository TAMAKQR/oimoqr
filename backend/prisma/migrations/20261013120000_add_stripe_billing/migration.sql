-- Add the Stripe customer reference at account level.
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;

-- Track which system owns each restaurant-level entitlement so a terminal
-- Stripe reconciliation cannot accidentally cancel a later manual grant.
ALTER TABLE "Subscription" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- Map local plans to Stripe recurring Prices. Stripe remains the source of
-- truth for charged amounts; these fields are display and lookup metadata.
ALTER TABLE "PricingTier"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'usd',
  ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'month',
  ADD COLUMN "stripePriceId" TEXT;

CREATE TABLE "BillingSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pricingTierId" TEXT,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripePriceId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "stripeCreatedAt" TIMESTAMP(3),
  "pastDueSince" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "stripeCreatedAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeBillingIssue" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripePriceId" TEXT,
  "reason" TEXT NOT NULL,
  "details" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "graceEndsAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "StripeBillingIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "PricingTier_stripePriceId_key" ON "PricingTier"("stripePriceId");
CREATE UNIQUE INDEX "BillingSubscription_userId_key" ON "BillingSubscription"("userId");
CREATE UNIQUE INDEX "BillingSubscription_stripeSubscriptionId_key" ON "BillingSubscription"("stripeSubscriptionId");
CREATE INDEX "BillingSubscription_status_idx" ON "BillingSubscription"("status");
CREATE INDEX "BillingSubscription_pricingTierId_idx" ON "BillingSubscription"("pricingTierId");
CREATE UNIQUE INDEX "StripeBillingIssue_stripeSubscriptionId_key" ON "StripeBillingIssue"("stripeSubscriptionId");
CREATE INDEX "StripeBillingIssue_status_lastSeenAt_idx" ON "StripeBillingIssue"("status", "lastSeenAt");
CREATE INDEX "StripeBillingIssue_userId_idx" ON "StripeBillingIssue"("userId");

ALTER TABLE "BillingSubscription"
  ADD CONSTRAINT "BillingSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingSubscription"
  ADD CONSTRAINT "BillingSubscription_pricingTierId_fkey"
  FOREIGN KEY ("pricingTierId") REFERENCES "PricingTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StripeBillingIssue"
  ADD CONSTRAINT "StripeBillingIssue_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
