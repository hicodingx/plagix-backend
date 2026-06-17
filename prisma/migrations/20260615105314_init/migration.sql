-- CreateEnum
CREATE TYPE "ScrapingStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "scraping_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootUrl" TEXT NOT NULL,
    "status" "ScrapingStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastRunAt" TIMESTAMP(3),
    "collectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraping_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collected_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "university" TEXT,
    "publicationDate" TIMESTAMP(3),
    "content" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collected_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collected_documents_signature_key" ON "collected_documents"("signature");

-- AddForeignKey
ALTER TABLE "collected_documents" ADD CONSTRAINT "collected_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "scraping_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
