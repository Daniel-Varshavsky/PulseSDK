-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN     "minAppVersion" TEXT;

-- CreateTable
CREATE TABLE "Exposure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT NOT NULL,
    "appVersion" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrashReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exposure_userId_variantId_key" ON "Exposure"("userId", "variantId");

-- AddForeignKey
ALTER TABLE "Exposure" ADD CONSTRAINT "Exposure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exposure" ADD CONSTRAINT "Exposure_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashReport" ADD CONSTRAINT "CrashReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
