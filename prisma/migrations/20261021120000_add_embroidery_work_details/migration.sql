ALTER TABLE "order_items"
ADD COLUMN "size" TEXT,
ADD COLUMN "color" TEXT;

ALTER TABLE "order_item_logos"
ADD COLUMN "placement" TEXT;
