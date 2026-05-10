-- AlterTable
ALTER TABLE "User" ADD COLUMN "country" TEXT,
ADD COLUMN "stateProvince" TEXT,
ADD COLUMN "city" TEXT;

-- CreateIndex
CREATE INDEX "User_country_stateProvince_idx" ON "User"("country", "stateProvince");
