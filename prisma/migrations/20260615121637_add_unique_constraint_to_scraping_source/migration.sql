/*
  Warnings:

  - A unique constraint covering the columns `[rootUrl]` on the table `scraping_sources` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "scraping_sources_rootUrl_key" ON "scraping_sources"("rootUrl");
