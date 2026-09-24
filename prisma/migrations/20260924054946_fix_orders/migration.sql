/*
  Warnings:

  - You are about to drop the column `placement` on the `order_item_logos` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `order_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "order_item_logos" DROP COLUMN "placement";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "unitPrice";
