CREATE TABLE "company_follows" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_follows_userId_companyId_key"
ON "company_follows"("userId", "companyId");

CREATE INDEX "company_follows_userId_createdAt_idx"
ON "company_follows"("userId", "createdAt");

CREATE INDEX "company_follows_companyId_idx"
ON "company_follows"("companyId");

ALTER TABLE "company_follows"
ADD CONSTRAINT "company_follows_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_follows"
ADD CONSTRAINT "company_follows_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
