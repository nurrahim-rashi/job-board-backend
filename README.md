# Polaris API

Polaris API powers authentication, profiles, worldwide job discovery, applications, hiring workflows, quality scores, subscriptions, company reviews, CV generation, and skill assessments for the Polaris platform.

## Production

- API: [https://job-board-backend-sage.vercel.app](https://job-board-backend-sage.vercel.app)
- Health check: [https://job-board-backend-sage.vercel.app/health](https://job-board-backend-sage.vercel.app/health)
- Frontend: [https://www.polarisjobs.my.id](https://www.polarisjobs.my.id)
- Runtime: Vercel Node.js serverless function
- Database: PostgreSQL on Neon

`index.ts` exports the Express application for Vercel. It only opens a local HTTP listener when `VERCEL` is not present, preventing background jobs from starting on every serverless invocation.

## Stack

- Node.js, Express 5, and TypeScript
- PostgreSQL with Prisma 7
- JWT authentication and role-based middleware
- Zod request validation
- Google Auth Library for Google ID-token verification
- Resend for transactional email
- Midtrans Snap for subscription payments
- Cloudinary for optional hosted job-banner uploads
- Vitest and Supertest

## Requirements

- Node.js 22
- npm
- PostgreSQL

## Local Setup

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma generate
npm run db:seed:subscriptions
npm run dev
```

The API listens on `http://localhost:8000` unless `PORT` is changed. The subscription seed is required for Polaris Plus and Polaris Pro to appear on the pricing page.

Keep `NODE_ENV` unset or `development` in a local `.env`. `http://localhost:5173` is only added to the CORS allow-list outside production, so a local `.env` carrying `NODE_ENV=production` makes the browser block every request from the local frontend, which looks like a broken feature rather than a CORS failure.

When pulling new changes that contain migrations, run:

```bash
npm install
npx prisma migrate dev
npx prisma generate
```

`prisma migrate dev` is only for local development. Never use it against production.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | Long random secret used to sign access tokens. |
| `FRONTEND_URL` | Yes | Allowed CORS origin and destination for verification/certificate links. |
| `PORT` | No | HTTP port; defaults to `8000`. |
| `GOOGLE_CLIENT_ID` | For Google Sign-In | OAuth Web Client ID; must match the frontend value. |
| `RESEND_API_KEY` | Production email | Resend API key. Missing local credentials fall back to console previews. |
| `EMAIL_FROM` | Production email | Verified Resend sender, such as `Polaris <noreply@example.com>`. |
| `GEOCODING_USER_AGENT` | Recommended | Identifies Polaris to Nominatim and location providers. It must carry a **real** contact address: OSM rejects a placeholder contact with HTTP 403, which silently disables every geocoding fallback. A value that looks like a placeholder is stripped back to the bare product string before the request is sent. |
| `PHOTON_API_URL` | No | Worldwide location-search provider; defaults to `https://photon.komoot.io`. |
| `CLOUDINARY_URL` | Required in production | Standard `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` connection URL. Use this or the three variables below. |
| `CLOUDINARY_CLOUD_NAME` | Required in production* | Cloudinary account name. Local development falls back to disk. |
| `CLOUDINARY_API_KEY` | Required in production* | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Required in production* | Cloudinary API secret. |
| `MIDTRANS_SERVER_KEY` | For payments | Midtrans server key. |
| `MIDTRANS_CLIENT_KEY` | For payments | Midtrans client key. |
| `MIDTRANS_IS_PRODUCTION` | No | Use `true` for production; otherwise sandbox mode is used. |
| `INTERVIEW_TIMEZONE` | No | Interview email/reminder timezone; defaults to `Asia/Jakarta`. |
| `SUBSCRIPTION_TIMEZONE` | No | Subscription reminder timezone; defaults to `Asia/Jakarta`. |
| `CRON_SECRET` | Required in production | Shared secret Vercel Cron sends as `Authorization: Bearer …`; without it `/cron/*` answers 503. |
| `NODE_ENV` | No | Set to `production` in production. |

Never commit real secrets or production credentials.

## Production Deployment

Create the backend Vercel project with **Root Directory** set to `job-board-backend`. Configure these variables for the Production environment:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=use-a-long-random-production-secret
NODE_ENV=production
FRONTEND_URL=https://www.polarisjobs.my.id
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
RESEND_API_KEY=re_...
EMAIL_FROM=Polaris <noreply@your-verified-domain.com>
GEOCODING_USER_AGENT=PolarisJobBoard/1.0 (your-contact-email@example.com)
PHOTON_API_URL=https://photon.komoot.io
INTERVIEW_TIMEZONE=Asia/Jakarta
SUBSCRIPTION_TIMEZONE=Asia/Jakarta
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
MIDTRANS_IS_PRODUCTION=true
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Only `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and the integrations actually used by the environment are required to boot their corresponding features. Email verification needs Resend, Google login needs `GOOGLE_CLIENT_ID`, payments need Midtrans, and hosted media needs Cloudinary.

After configuring or changing a Vercel environment variable, redeploy the backend. Existing deployments do not receive new environment values.

### Production database setup

Run migrations from a trusted terminal with `DATABASE_URL` pointing to the production database:

```bash
npm install
npm run db:migrate:deploy
npm run db:seed:subscriptions
```

Use `db:migrate:deploy`, not `prisma migrate dev`, in production. The subscription seed is idempotent and creates or updates Polaris Plus and Polaris Pro. Migrations only create/update schema; they do not copy development jobs, companies, or users into a new production database.

Verify deployment after the production build completes:

```text
GET /
GET /health
GET /jobs?limit=1
GET /companies?limit=1
GET /subscriptions
GET /regions/countries
```

`/` and `/health` should return HTTP 200. Empty `data` arrays mean the API and database are reachable but the production database has not been populated yet. `FUNCTION_INVOCATION_FAILED` means Express did not finish booting; inspect Vercel Function logs and confirm `DATABASE_URL` is available to the Production deployment.

## Authentication

Polaris supports:

- Job-seeker and company-admin registration with email/password
- Google Sign-In and automatic Google job-seeker registration
- One-time email verification links with a one-hour expiry
- One-time forgot/reset-password links
- Profile, avatar, company-logo, and company-banner management
- `JOB_SEEKER`, `COMPANY_ADMIN`, and `DEVELOPER` access control

Google Identity Services sends a credential to `POST /auth/google`. The API verifies its signature, audience, expiry, and verified email using `GOOGLE_CLIENT_ID`; a Google client secret is not used.

Protected requests use:

```http
Authorization: Bearer <access-token>
```

## API Groups

| Prefix | Purpose |
| --- | --- |
| `/auth` | Registration, login, Google auth, verification, password reset, profile and media. |
| `/jobs` | Public job discovery/details, applications, and applicant pre-selection-test actions. |
| `/job-posting` | Company job management, applicants, interviews, and test management. |
| `/applications` | Current job seeker's application lists and details. |
| `/companies` | Public company directory and company details. |
| `/profiles` | Public applicant/company-admin profiles and quality data. |
| `/regions` | Countries, states, cities, Indonesian regions, and worldwide search. |
| `/exchange-rates` | Daily foreign-exchange table used by the job-detail salary converter. |
| `/assessment` | Skill discovery, attempts, results, badges, certificates, and developer management. |
| `/subscriptions` | Public plans, purchases, payment notifications, and developer management. |
| `/reviews` | Company reviews and aggregated Stories data. |
| `/analytics` | Company/developer analytics. |
| `/cv` | Subscriber CV generation. |

### Representative Endpoints

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/auth/register` | Public |
| `POST` | `/auth/login` | Public |
| `POST` | `/auth/google` | Public |
| `GET` | `/auth/me` | Authenticated |
| `PATCH` | `/auth/profile` | Authenticated |
| `PUT` / `DELETE` | `/auth/avatar` | Authenticated |
| `PUT` / `DELETE` | `/auth/company-media/:field` | Company admin |
| `GET` | `/jobs` | Public |
| `GET` | `/jobs/:slug` | Public |
| `POST` | `/jobs/:slug/applications` | Verified job seeker |
| `GET` | `/applications/me/page` | Job seeker |
| `POST` | `/job-posting` | Company admin |
| `PATCH` | `/job-posting/:slug/publish` | Owning company admin |
| `GET` | `/job-posting/:slug/applicants` | Owning company admin |
| `POST` | `/job-posting/:slug/interviews` | Owning company admin |
| `GET` | `/regions/search?q=Bandung` | Public |
| `GET` | `/exchange-rates?base=USD` | Public |
| `GET` | `/reviews/stories` | Public |
| `POST` | `/reviews/:companyId` | Authenticated eligible reviewer |
| `GET` | `/assessment/certificates/verify/:certificateCode` | Public |
| `POST` | `/subscriptions/purchase` | Authenticated job seeker |
| `POST` | `/cv/generate` | Eligible subscriber |

## Location and Geocoding

The API acts as the frontend's location gateway:

- `wilayah.id` supplies Indonesian provinces and regencies.
- Photon supplies worldwide city/state/country type-to-search.
- Nominatim backs Photon up for both forward search and reverse geocoding.
- CountriesNow supplies country/state/city lists with a fallback country provider.
- Nominatim geocodes job locations for nearest-job sorting.

Responses are cached in memory and provider calls are rate-limited. Published jobs without coordinates are backfilled in small batches when location-aware searches run.

`GET /regions/search` tries Photon first and falls back to Nominatim when Photon errors or returns nothing. Empty results are never cached, so one upstream outage cannot pin an empty list in place for a day. If the endpoint answers `200` with an empty `data` array for an obviously valid query such as `Jakarta`, both providers were unreachable from the host: check outbound network access and `GEOCODING_USER_AGENT` before looking at the query.

## Currency Conversion

`GET /exchange-rates?base=USD` returns `{ base, rates, fetchedAt }`, where `rates` maps a currency code to the amount of that currency per one unit of `base`. The job-detail salary converter fetches this once per job and converts locally, so changing the target currency costs no further requests.

- Primary provider: `open.er-api.com` (no key, ~166 currencies).
- Fallback provider: `api.frankfurter.dev` (ECB, ~30 major currencies).
- The USD table is cached in memory for an hour, concurrent requests share one upstream call, and a stale table is served rather than failing when both providers are down.

Rates are always fetched against USD and cross-divided to the requested base. Asking an upstream for a weak base directly returns too few significant digits to convert a salary with: `1 IDR = 0.000056 USD` loses roughly four digits of precision compared with dividing into the USD table.

An unknown currency code returns `404`; a malformed one returns `400`.

## Uploads

- Avatars: JPEG/PNG/WEBP, maximum 3 MB.
- Company logo/banner: JPEG/PNG/WEBP, maximum 5 MB.
- Job banners: multipart upload, maximum 2 MB; Cloudinary when configured, local storage otherwise.
- Application CV: PDF upload through the application endpoint.

Local media is served from `/uploads`.

## Applications and Quality Data

Application records snapshot education at submission time so later profile changes do not rewrite historical applications. The application flow supports expected-salary requests, pre-selection tests, interviews, accepted/rejected outcomes, and profile experience creation after a hire.

Public profiles and company pages expose calculated quality scores and metric breakdowns. Missing metrics are returned as unavailable instead of artificially lowering a score, while completeness remains part of the score. Company reviews feed both company profiles and the public Stories page.

## Subscriptions

Database enum values remain `STANDARD` and `PROFESSIONAL`; the frontend presents them as **Polaris Plus** and **Polaris Pro**. The seed creates:

- `STANDARD`: IDR 25,000/month, CV Generator, two skill assessments
- `PROFESSIONAL`: IDR 100,000/month, CV Generator, unlimited assessments, priority review

Midtrans notifications update payment/subscription state. A scheduled job expires ended subscriptions hourly, and another sends expiry reminders daily.

## Scheduled Jobs

- Interview reminders: daily at 08:00 in `INTERVIEW_TIMEZONE`
- Subscription expiry reminders: daily at 08:00 in `SUBSCRIPTION_TIMEZONE`
- Subscription expiration: hourly

These in-process schedules run with the long-lived local Node server. Vercel Functions are ephemeral, so `node-cron` never fires in a serverless invocation.

Interview reminders therefore also have an HTTP trigger for production:

| Endpoint | Vercel Cron schedule | Runs |
| --- | --- | --- |
| `GET /cron/interview-reminder` | `0 1 * * *` (01:00 UTC = 08:00 in `Asia/Jakarta`) | `sendInterviewRemindersService` |

The schedule lives in `vercel.json`. Vercel sends `Authorization: Bearer $CRON_SECRET` on each invocation, and `middlewares/cron.middleware.ts` rejects anything else with 401; if `CRON_SECRET` is unset the endpoint answers 503 rather than running unprotected. Set the variable in the Vercel project and redeploy.

Vercel's Hobby plan allows two cron jobs at daily granularity. The two subscription schedules still have no HTTP trigger, so on production they do not run; give them the same treatment if the plan allows it, or run a separate worker.

To test locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:8000/cron/interview-reminder
```

## Database and ERD

After changing `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name describe_the_change
npx prisma generate
npm run docs:erd
```

The generated diagram is stored at [`docs/erd.svg`](./docs/erd.svg).

## Testing

Copy `.env.test.example` to `.env.test` and point it at a dedicated disposable database:

```env
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/polaris_test
JWT_SECRET_TEST=replace-with-a-test-secret
NODE_ENV=test
RESEND_API_KEY=
EMAIL_FROM=
```

The last three lines matter. `lib/prisma.ts` and `app.ts` both call `import "dotenv/config"`, so `.env` is loaded inside the test run as well, and dotenv never overwrites a variable that is already set. Without those overrides a live `RESEND_API_KEY` in `.env` would make the registration and verification tests post real mail to Resend.

Then create the database and run the suite:

```bash
createdb polaris_test
DATABASE_URL="$DATABASE_URL_TEST" npx prisma migrate deploy
npm run test:run
```

`vitest.config.ts` excludes `dist/`. Without that exclusion a previous `npm run build` leaves a compiled copy of every test behind and vitest runs the whole integration suite twice, once against stale code.

Never point `DATABASE_URL_TEST` at development or production data.

`vitest.config.ts` copies `DATABASE_URL_TEST` into `DATABASE_URL` before the suite boots. If `.env.test` is missing or empty, every integration test fails with a Prisma `Invalid URL` error; the unit tests that do not touch the database still pass, which makes the cause easy to misread.
