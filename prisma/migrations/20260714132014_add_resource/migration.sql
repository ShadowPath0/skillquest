-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "skillTag" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resource_domainId_skillTag_key" ON "Resource"("domainId", "skillTag");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
