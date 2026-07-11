-- DropForeignKey
ALTER TABLE "ExperimentResult" DROP CONSTRAINT "ExperimentResult_experimentId_fkey";

-- DropForeignKey
ALTER TABLE "ExperimentResult" DROP CONSTRAINT "ExperimentResult_variantId_fkey";

-- AlterTable
ALTER TABLE "Experiment" DROP COLUMN "targetVersion",
DROP COLUMN "trafficSplit";

-- DropTable
DROP TABLE "ExperimentResult";

