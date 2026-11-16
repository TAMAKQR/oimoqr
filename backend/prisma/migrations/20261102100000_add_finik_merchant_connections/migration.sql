-- CreateTable
CREATE TABLE "FinikMerchantConnection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mode" TEXT NOT NULL DEFAULT 'beta',
    "merchantName" TEXT,
    "accountId" TEXT,
    "apiKeyEncrypted" TEXT,
    "privateKeyEncrypted" TEXT,
    "publicKeyPem" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "lastTestedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinikMerchantConnection_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrderFinikPayment"
ADD COLUMN "finikConnectionId" TEXT,
ADD COLUMN "merchantAccountId" TEXT,
ADD COLUMN "credentialVersion" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "FinikMerchantConnection_ownerId_key" ON "FinikMerchantConnection"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FinikMerchantConnection_mode_accountId_key" ON "FinikMerchantConnection"("mode", "accountId");

-- CreateIndex
CREATE INDEX "FinikMerchantConnection_status_idx" ON "FinikMerchantConnection"("status");

-- CreateIndex
CREATE INDEX "OrderFinikPayment_finikConnectionId_idx" ON "OrderFinikPayment"("finikConnectionId");

-- AddForeignKey
ALTER TABLE "FinikMerchantConnection" ADD CONSTRAINT "FinikMerchantConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFinikPayment" ADD CONSTRAINT "OrderFinikPayment_finikConnectionId_fkey" FOREIGN KEY ("finikConnectionId") REFERENCES "FinikMerchantConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
