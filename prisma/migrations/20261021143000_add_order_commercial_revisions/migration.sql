CREATE TABLE "order_commercial_revisions" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_commercial_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_commercial_revisions_orderId_revision_key"
ON "order_commercial_revisions"("orderId", "revision");
CREATE INDEX "order_commercial_revisions_orderId_createdAt_idx"
ON "order_commercial_revisions"("orderId", "createdAt");

ALTER TABLE "order_commercial_revisions"
ADD CONSTRAINT "order_commercial_revisions_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_commercial_revisions"
ADD CONSTRAINT "order_commercial_revisions_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
