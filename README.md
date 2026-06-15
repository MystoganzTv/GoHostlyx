# GoHostlyx

**The financial command center for short-term rental operators.**

GoHostlyx turns scattered booking exports, expenses, payout statements, and
calendar feeds into one clear operating view. It helps hosts understand what
they actually keep after platform fees, operating costs, and estimated taxes.

[Live app](https://gohostlyx.vercel.app) · [Report an issue](https://github.com/MystoganzTv/GoHostlyx/issues)

## What It Does

- Imports Airbnb, Booking.com, generic Excel, and mixed workbooks
- Normalizes bookings, expenses, payout statements, and calendar events
- Detects duplicate or conflicting booking rows before import
- Tracks revenue, payouts, expenses, net profit, margins, occupancy, and ADR
- Reconciles expected booking payouts against imported channel statements
- Estimates taxes by market and reporting context
- Manages properties, listings, bookings, expenses, imports, and iCal feeds
- Generates client-ready financial summaries and PDF reports
- Supports English and Spanish workspaces
- Provides subscription billing through Stripe

## Product Areas

| Area | Purpose |
| --- | --- |
| Dashboard | Financial overview, key insights, and recent activity |
| Properties | Property and listing structure used across all records |
| Calendar | Operational bookings, closures, and iCal synchronization |
| Bookings & Expenses | Review, create, edit, and organize operating data |
| Payouts & Reconcile | Compare channel statements with expected payouts |
| Performance & Monthly | Analyze occupancy, ADR, seasonality, and profitability |
| Reports | Share and export financial summaries |
| Settings | Configure business defaults, markets, and tax assumptions |

## How Imports Work

1. Upload a booking export, expense workbook, or payout statement.
2. GoHostlyx detects the source and maps recognizable columns.
3. Rows are normalized, validated, deduplicated, and classified.
4. Clean rows can be imported immediately; uncertain rows are marked for review.
5. Imported data becomes available across the dashboard, calendar, reconciliation,
   and reports.

## Tech Stack

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4 and Recharts
- NextAuth with Google and email/password authentication
- PostgreSQL in production and SQLite for local development
- Stripe Checkout and subscription webhooks
- `xlsx` for workbook imports and `pdf-lib` for report exports
- Vercel for production deployment

## Local Development

Requirements:

- Node.js 20 or newer
- npm

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env.local
```

Configure the values you need in `.env.local`, then start the app:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXTAUTH_URL` | Production | Canonical authentication URL |
| `NEXTAUTH_SECRET` | Yes | Encrypts and signs authentication sessions |
| `GOOGLE_CLIENT_ID` | Optional | Enables Google authentication |
| `GOOGLE_CLIENT_SECRET` | Optional | Enables Google authentication |
| `ADMIN_EMAILS` | Optional | Comma-separated admin allowlist |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Billing | Stripe server API key |
| `STRIPE_WEBHOOK_SECRET` | Billing | Verifies Stripe webhook events |
| `STRIPE_PRICE_STARTER` | Billing | Stripe price ID for Starter |
| `STRIPE_PRICE_PRO` | Billing | Stripe price ID for Pro |
| `STRIPE_PRICE_PORTFOLIO` | Billing | Stripe price ID for Portfolio |
| `RESEND_API_KEY` | Email | Sends verification and contact emails |
| `AUTH_VERIFICATION_FROM_EMAIL` | Email | Verification sender identity |
| `CONTACT_FORM_TO_EMAIL` | Email | Contact form destination |
| `CONTACT_FORM_FROM_EMAIL` | Email | Contact form sender identity |

See [.env.example](.env.example) for a complete template.

## Authentication Setup

Create Google OAuth credentials with these callback URLs:

```text
http://localhost:3000/api/auth/callback/google
https://gohostlyx.vercel.app/api/auth/callback/google
```

Email/password authentication becomes available when `NEXTAUTH_SECRET` is set.
Google authentication additionally requires `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`.

## Persistence

- Local development without `DATABASE_URL` uses SQLite at `data/gohostlyx.sqlite`.
- Production uses PostgreSQL through `DATABASE_URL`.
- When no production database is configured, the application uses an in-memory
  fallback and data will not persist between deployments.

## Stripe Setup

Configure Stripe Checkout prices and subscribe the production webhook to:

```text
https://gohostlyx.vercel.app/api/stripe/webhook
```

Recommended webhook events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Quality Checks

```bash
npm run lint
npm run build
```

## Deployment

GoHostlyx is configured for Vercel:

```bash
npx vercel --prod
```

Production URL: [gohostlyx.vercel.app](https://gohostlyx.vercel.app)
