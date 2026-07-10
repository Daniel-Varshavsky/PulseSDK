-- AlterTable
ALTER TABLE "Experiment" ADD COLUMN     "feedbackType" "FeedbackType" NOT NULL DEFAULT 'STAR_RATING';

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "metadata" JSONB;
