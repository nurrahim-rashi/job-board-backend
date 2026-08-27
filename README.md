# Polaris API

Polaris is a location-aware job board that connects job seekers with thoughtful companies. It supports job discovery, applications, pre-selection tests, interviews, subscriptions, company reviews, and skill assessments in one platform.

## Technology

- Node.js, Express, and TypeScript
- PostgreSQL with Prisma ORM
- JWT, Node.js `scrypt`, and Zod validation
- Resend API for transactional email delivery
- Vitest and Supertest for integration tests

## Getting Started

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

The API runs on `http://localhost:8000` by default.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Secret used to sign and verify access tokens. |
| `FRONTEND_URL` | Allowed CORS origin and email-link destination. |
| `EMAIL_FROM` | Verified sender address for Resend. |
| `RESEND_API_KEY` | Resend API key for verification and password-reset emails. |

When Resend is not configured outside production, Polaris logs a local email preview instead of sending an email.

## Main Capabilities

- Email/password registration for job seekers and company administrators.
- One-time email verification and password-reset links with a one-hour expiry.
- Protected profile management, password changes, and JPG/PNG avatar uploads up to 1 MB.
- Published job discovery sorted by newest entries or by proximity within a 50 km radius.
- Job applications, pre-selection testing, interview scheduling, subscriptions, reviews, and developer-managed skill assessments.

## API Overview

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Creates a job seeker or company admin account. |
| `POST` | `/auth/login` | Starts an authenticated JWT session. |
| `GET` | `/auth/me` | Returns the active user profile. |
| `GET` | `/auth/dashboard-overview` | Returns live dashboard counters for the active user. |
| `PATCH` | `/auth/profile` | Updates personal or company profile data. |
| `PUT` | `/auth/avatar` | Uploads a JPEG or PNG avatar up to 1 MB. |
| `GET` | `/jobs?limit=5` | Returns the newest published jobs. |
| `GET` | `/jobs?latitude=-6.2&longitude=106.8` | Returns nearby published jobs in a 50 km radius. |
| `GET` | `/jobs?city=Jakarta` | Returns published jobs for a manually selected city. |
| `POST` | `/reviews/:companyId` | Creates a company review. |
| `GET` | `/assessment/discovery` | Lists available skill assessments. |

Protected endpoints require:

```http
Authorization: Bearer <access-token>
```

## Authentication Notes

1. Zod validates input before database operations.
2. Passwords are stored as salted `scrypt` hashes, never plaintext.
3. Verification and reset tokens are random values whose SHA-256 hashes are stored with expiration times.
4. A consumed token is cleared immediately, making every link one-time use.
5. JWTs only contain identity and role claims; fresh profile data is always read from PostgreSQL.

## Database ERD

The diagram below is generated from [`prisma/schema.prisma`](./prisma/schema.prisma). After changing a Prisma model, run:

```bash
npm run docs:erd
```

<!-- ERD:START -->
```mermaid
erDiagram
  User ||--o| Company : user
  Company ||--o{ JobPosting : company
  JobPosting ||--o{ JobApplication : job
  User ||--o{ JobApplication : user
  JobPosting ||--o{ PreSelectionTest : job
  JobPosting ||--o{ ApplicantTestResult : job
  User ||--o{ ApplicantTestResult : user
  JobApplication ||--o| ApplicantTestResult : jobApplication
  ApplicantTestResult ||--o{ ApplicantTestAnswer : testResult
  PreSelectionTest ||--o{ ApplicantTestAnswer : question
  JobApplication ||--o| Interview : jobApplication
  User ||--o{ UserSubscription : user
  Subscription ||--o{ UserSubscription : subscription
  Company ||--o{ CompanyReview : company
  User ||--o{ CompanyReview : user
  SkillAssessment ||--o{ SkillAssessmentQuestion : assessment
  User ||--o{ SkillAssessmentResult : user
  SkillAssessment ||--o{ SkillAssessmentResult : assessment

  User {
    int id PK
    string name
    string email UK
    string authProvider
    string role
    datetime birthDate
    string gender
    string lastEducation
    string address
    string city
    string province
    string avatar
    datetime emailVerifiedAt
    datetime emailVerificationExpiresAt
    datetime createdAt
    datetime updatedAt
  }

  Company {
    int id PK
    int userId UK FK
    string companyName
    string phone
    string profileContent
    string logo
    string city
    datetime createdAt
    datetime updatedAt
  }

  JobPosting {
    int id PK
    int companyId FK
    string title
    string description
    string banner
    string category
    string cityLocation
    string latitude
    string longitude
    int salaryMin
    int salaryMax
    boolean hasPreSelectionTest
    int testDurationMinutes
    json tags
    string slug UK
    datetime deadline
    boolean isPublished
    datetime deletedAt
    datetime createdAt
    datetime updatedAt
  }

  JobApplication {
    int id PK
    int jobId FK
    int userId FK
    string cvFile
    int expectedSalary
    string status
    string rejectionReason
    datetime createdAt
    datetime updatedAt
  }

  PreSelectionTest {
    int id PK
    int jobId FK
    string question
    json options
    string correctAnswer
    datetime createdAt
    datetime updatedAt
  }

  ApplicantTestResult {
    int id PK
    int jobId FK
    int userId FK
    int jobApplicationId UK FK
    int score
    datetime startedAt
    datetime submittedAt
    datetime createdAt
    datetime updatedAt
  }

  ApplicantTestAnswer {
    int id PK
    int testResultId FK
    int questionId FK
    string selectedAnswer
    boolean isCorrect
    datetime createdAt
  }

  Interview {
    int id PK
    int jobApplicationId UK FK
    datetime interviewDate
    string locationOrLink
    string notes
    string status
    datetime reminderSentAt
    datetime createdAt
    datetime updatedAt
  }

  Subscription {
    int id PK
    string name UK
    int price
    int durationDays
    json featuresAccess
    datetime createdAt
    datetime updatedAt
  }

  UserSubscription {
    int id PK
    int userId FK
    int subscriptionId FK
    string paymentProof
    string status
    datetime startDate
    datetime endDate
    datetime createdAt
    datetime updatedAt
  }

  CompanyReview {
    int id PK
    int companyId FK
    int userId FK
    string jobTitleHeld
    int salaryEstimate
    int ratingCulture
    int ratingWorkLife
    int ratingFacility
    int ratingCareer
    string reviewText
    datetime createdAt
    datetime updatedAt
  }

  SkillAssessment {
    int id PK
    string skillName UK
    string title
    string description
    int passingScore
    int durationMinutes
    int questionCount
    datetime createdAt
    datetime updatedAt
  }

  SkillAssessmentQuestion {
    int id PK
    int assessmentId FK
    string question
    json options
    string correctAnswer
    int questionOrder
    datetime createdAt
    datetime updatedAt
  }

  SkillAssessmentResult {
    int id PK
    int userId FK
    int assessmentId FK
    int score
    boolean isPassed
    datetime startedAt
    datetime completedAt
    string certificateCode UK
    string badgeName
    datetime createdAt
    datetime updatedAt
  }
```
<!-- ERD:END -->

## Testing

```bash
npm run test
npm run test:run
```

Tests load `.env.test` and use `DATABASE_URL_TEST`. Never point test variables at a development or production database.
