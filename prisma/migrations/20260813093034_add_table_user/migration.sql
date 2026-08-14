-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('JOB_SEEKER', 'COMPANY_ADMIN', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'PROCESS', 'INTERVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionName" AS ENUM ('STANDARD', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "UserSubscriptionStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'JOB_SEEKER',
    "birthDate" TIMESTAMP(3),
    "gender" "Gender",
    "lastEducation" TEXT,
    "address" TEXT,
    "avatar" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profileContent" TEXT NOT NULL,
    "logo" TEXT,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_postings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "banner" TEXT,
    "category" TEXT NOT NULL,
    "cityLocation" TEXT NOT NULL,
    "salaryMin" DECIMAL(15,2),
    "salaryMax" DECIMAL(15,2),
    "tags" JSONB,
    "deadline" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvFile" TEXT NOT NULL,
    "expectedSalary" DECIMAL(15,2),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_selection_tests" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_selection_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant_test_results" (
    "id" SERIAL NOT NULL,
    "jobApplicationId" INTEGER NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicant_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" SERIAL NOT NULL,
    "jobApplicationId" INTEGER NOT NULL,
    "interviewDate" TIMESTAMP(3) NOT NULL,
    "locationOrLink" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "name" "SubscriptionName" NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "featuresAccess" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "paymentProof" TEXT,
    "status" "UserSubscriptionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_reviews" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "jobTitleHeld" TEXT NOT NULL,
    "salaryEstimate" DECIMAL(15,2),
    "ratingCulture" INTEGER NOT NULL,
    "ratingWorkLife" INTEGER NOT NULL,
    "ratingFacility" INTEGER NOT NULL,
    "ratingCareer" INTEGER NOT NULL,
    "reviewText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_assessments" (
    "id" SERIAL NOT NULL,
    "skillName" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_assessments" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillName" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "certificateCode" TEXT,
    "badgeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_userId_key" ON "companies"("userId");

-- CreateIndex
CREATE INDEX "job_postings_companyId_idx" ON "job_postings"("companyId");

-- CreateIndex
CREATE INDEX "job_postings_isPublished_deadline_idx" ON "job_postings"("isPublished", "deadline");

-- CreateIndex
CREATE INDEX "job_applications_userId_idx" ON "job_applications"("userId");

-- CreateIndex
CREATE INDEX "job_applications_status_idx" ON "job_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_jobId_userId_key" ON "job_applications"("jobId", "userId");

-- CreateIndex
CREATE INDEX "pre_selection_tests_jobId_idx" ON "pre_selection_tests"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_test_results_jobApplicationId_key" ON "applicant_test_results"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_jobApplicationId_key" ON "interviews"("jobApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_name_key" ON "subscriptions"("name");

-- CreateIndex
CREATE INDEX "user_subscriptions_userId_idx" ON "user_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "user_subscriptions_subscriptionId_idx" ON "user_subscriptions"("subscriptionId");

-- CreateIndex
CREATE INDEX "user_subscriptions_status_endDate_idx" ON "user_subscriptions"("status", "endDate");

-- CreateIndex
CREATE INDEX "company_reviews_companyId_idx" ON "company_reviews"("companyId");

-- CreateIndex
CREATE INDEX "company_reviews_userId_idx" ON "company_reviews"("userId");

-- CreateIndex
CREATE INDEX "skill_assessments_skillName_idx" ON "skill_assessments"("skillName");

-- CreateIndex
CREATE UNIQUE INDEX "user_assessments_certificateCode_key" ON "user_assessments"("certificateCode");

-- CreateIndex
CREATE INDEX "user_assessments_userId_idx" ON "user_assessments"("userId");

-- CreateIndex
CREATE INDEX "user_assessments_skillName_idx" ON "user_assessments"("skillName");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pre_selection_tests" ADD CONSTRAINT "pre_selection_tests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_test_results" ADD CONSTRAINT "applicant_test_results_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_assessments" ADD CONSTRAINT "user_assessments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
