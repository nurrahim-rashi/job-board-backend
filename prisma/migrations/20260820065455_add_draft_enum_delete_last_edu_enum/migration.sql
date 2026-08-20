/*
  Warnings:

  - The `lastEducation` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "lastEducation",
ADD COLUMN     "lastEducation" TEXT;

-- DropEnum
DROP TYPE "LastEducation";
