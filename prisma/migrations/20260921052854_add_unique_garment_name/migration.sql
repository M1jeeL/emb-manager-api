/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,name]` on the table `garments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "garments_organizationId_name_key" ON "garments"("organizationId", "name");
