# Job Board API

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL`.
2. Run `npm ci`.
3. Apply migration with `npx prisma migrate dev`.
4. Generate Prisma Client with `npx prisma generate`.
5. Start the API with `npm run dev`.

## Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Creates a job seeker or company admin account and sends verification email. |
| `POST` | `/auth/login` | Validates email and password, then returns a JWT session. |
| `GET` | `/auth/me` | Returns the user represented by the Bearer token. |
| `PATCH` | `/auth/profile` | Updates personal data and company profile content for company admins. |
| `PUT` | `/auth/avatar` | Uploads a JPEG/PNG avatar, maximum 1 MB, using the raw file body. |
| `POST` | `/auth/verify-email` | Consumes a one-time, one-hour verification token. |
| `POST` | `/auth/resend-verification` | Replaces an unverified account's verification token. |
| `POST` | `/auth/forgot-password` | Sends a password-reset link without revealing account existence. |
| `POST` | `/auth/reset-password` | Consumes a one-time, one-hour reset token. |
| `POST` | `/auth/change-password` | Changes password for an authenticated email-password user. |
| `POST` | `/auth/logout` | Validates the token and completes a client-side logout. |

`POST /auth/register` accepts `name`, `email`, `password`, and `role`. A `COMPANY_ADMIN` also sends `companyName`, `phone`, and `city`. Passwords are stored using Node.js `scrypt`; API responses never include the password.

## Authentication design (for presentation)

1. **Registration validates input before database access.** Zod rejects invalid emails, short passwords, and incomplete company registrations. A unique database email constraint and service-level lookup protect against duplicate emails.
2. **Passwords are never stored as plaintext.** `utils/password.ts` derives a slow `scrypt` hash with a random salt; login compares the derived hash using timing-safe comparison.
3. **Email links are one-time and expire in one hour.** The server generates a cryptographically random token, stores only its SHA-256 hash plus expiry, and clears both fields after successful use. A database leak therefore cannot be used directly as a verification/reset link.
4. **The API returns a short user object plus JWT.** The JWT only contains `id` and `role`, while `/auth/me` fetches fresh profile information. The password and token hashes are never selected in responses.
5. **Protected actions check identity and verification.** Frontend blocks the Apply action until sign-in and shows an email-verification message for unverified users. Backend protected profile routes require `Authorization: Bearer <token>`.
6. **Email changes revoke verification.** Updating the email sets `emailVerifiedAt` to `null`, generates a new verification link, and retains no previous usable token.
7. **Avatar validation is server-side.** `/auth/avatar` only accepts raw `image/jpeg` or `image/png`, rejects content larger than 1 MB, writes a random filename, and saves the relative path in the profile.

For actual delivery, configure `RESEND_API_KEY` and a verified `EMAIL_FROM`. Without these in non-production, the API logs an email preview with the link for local development. Google/Facebook login requires OAuth credentials and redirect URIs from the chosen provider; the schema is prepared with `AuthProvider`, but no provider credentials are committed to source control.

JWT logout is stateless: the frontend removes the stored token and user data after calling `/auth/logout`. Tokens expire after seven days. Add a token denylist or refresh-token table if server-side token revocation is required.
