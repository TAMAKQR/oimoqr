CREATE TABLE "OrderFinikPayment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'FINIK',
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
  CONSTRAINT "OrderFinikPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderFinikPayment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrderFinikPayment_orderId_key"
  ON "OrderFinikPayment"("orderId");
CREATE UNIQUE INDEX "OrderFinikPayment_verificationToken_key"
  ON "OrderFinikPayment"("verificationToken");
CREATE UNIQUE INDEX "OrderFinikPayment_providerTransactionId_key"
  ON "OrderFinikPayment"("providerTransactionId");
CREATE UNIQUE INDEX "OrderFinikPayment_providerOperationId_key"
  ON "OrderFinikPayment"("providerOperationId");
CREATE INDEX "OrderFinikPayment_orderId_status_createdAt_idx"
  ON "OrderFinikPayment"("orderId", "status", "createdAt");
CREATE INDEX "OrderFinikPayment_status_expiresAt_idx"
  ON "OrderFinikPayment"("status", "expiresAt");
