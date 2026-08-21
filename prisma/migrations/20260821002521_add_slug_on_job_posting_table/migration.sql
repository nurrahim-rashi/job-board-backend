/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `job_postings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `job_postings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "job_postings_slug_key" ON "job_postings"("slug");
