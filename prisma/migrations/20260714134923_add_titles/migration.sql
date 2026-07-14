-- AlterTable
ALTER TABLE "Badge" ADD COLUMN     "unlocksTitle" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "equippedTitle" TEXT,
ADD COLUMN     "unlockedTitles" TEXT[] DEFAULT ARRAY[]::TEXT[];
