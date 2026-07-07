-- AlterTable
ALTER TABLE "FeedbackResponse" ADD COLUMN     "comment" TEXT;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "choices" JSONB;
