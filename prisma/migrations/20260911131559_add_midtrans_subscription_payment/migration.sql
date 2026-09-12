/*
  Warnings:

  - A unique constraint covering the columns `[midtransOrderId]` on the table `user_subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user_subscriptions" ADD COLUMN     "midtransOrderId" TEXT,
ADD COLUMN     "midtransRedirectUrl" TEXT,
ADD COLUMN     "midtransSnapToken" TEXT,
ADD COLUMN     "paymentStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_midtransOrderId_key" ON "user_subscriptions"("midtransOrderId");
