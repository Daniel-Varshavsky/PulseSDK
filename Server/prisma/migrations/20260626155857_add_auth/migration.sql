/*
  Warnings:

  - You are about to drop the column `ownerId` on the `App` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `Experiment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppMemberRole" AS ENUM ('OWNER', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "AppMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- AlterTable
ALTER TABLE "App" DROP COLUMN "ownerId";

-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN     "createdById" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppMember" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "role" "AppMemberRole" NOT NULL DEFAULT 'COLLABORATOR',
    "status" "AppMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "AppMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_googleId_key" ON "Account"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "AppMember_accountId_appId_key" ON "AppMember"("accountId", "appId");

-- AddForeignKey
ALTER TABLE "AppMember" ADD CONSTRAINT "AppMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppMember" ADD CONSTRAINT "AppMember_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
