# Job Board API

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL`.
2. Run `npm ci`.
3. Generate Prisma Client with `npx prisma generate`.
4. Start the API with `npm run dev`.

## Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Creates a `JOB_SEEKER` account and returns a JWT session. |
| `POST` | `/auth/login` | Validates email and password, then returns a JWT session. |
| `GET` | `/auth/me` | Returns the user represented by the Bearer token. |
| `POST` | `/auth/logout` | Validates the token and completes a client-side logout. |

`POST /auth/register` accepts `name`, `email`, and `password`. `POST /auth/login` accepts `email` and `password`. Passwords are stored using Node.js `scrypt`; API responses never include the password.

JWT logout is stateless: the frontend removes the stored token and user data after calling `/auth/logout`. Tokens expire after seven days. Add a token denylist or refresh-token table if server-side token revocation is required.
