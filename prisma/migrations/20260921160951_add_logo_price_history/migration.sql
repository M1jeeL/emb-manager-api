-- CreateTable
CREATE TABLE "logo_price_history" (
    "id" TEXT NOT NULL,
    "logoId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logo_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logo_price_history_logoId_createdAt_idx" ON "logo_price_history"("logoId", "createdAt");

-- AddForeignKey
ALTER TABLE "logo_price_history" ADD CONSTRAINT "logo_price_history_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "logos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
