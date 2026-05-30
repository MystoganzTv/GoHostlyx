# Hostlyx

Accounting dashboard for a short-term rental business built with Next.js, Tailwind CSS, Recharts, Google login, and Postgres-ready persistence.

## Features

- Google sign-in with optional email allowlist
- Excel import for `Bookings` and `Expenses`
- Manual booking and expense entry
- Year, month, and channel filters with remembered selections
- KPI cards, charts, and activity views
- Per-user data separation so each Google account sees only its own records
- Netlify DB / Postgres-ready storage for production, SQLite fallback for local development

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in:

- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` if you want Postgres locally
- `ADMIN_EMAILS` if you want to restrict access
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_PORTFOLIO`

4. Start the app:

```bash
npm run dev
```

## Google Auth Setup

Create Google OAuth credentials and add these callback URLs:

- `http://localhost:3000/api/auth/callback/google`
- `https://hostlyx1.netlify.app/api/auth/callback/google`

Use those values in:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Persistence

- Local development without `DATABASE_URL` uses SQLite in `/data/hostlyx.sqlite`
- Production can use either `DATABASE_URL` or Netlify DB's `NETLIFY_DATABASE_URL`
- This repo is already compatible with Netlify DB / Neon and will use that connection automatically when available

## Netlify Deployment

This project includes `netlify.toml` with the build command.

Set these environment variables in Netlify:

- `NEXTAUTH_URL=https://hostlyx1.netlify.app`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` if you are bringing your own Postgres
- `ADMIN_EMAILS` if needed
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_PORTFOLIO`

If you use Netlify DB, Netlify will provision and manage `NETLIFY_DATABASE_URL` for you automatically.

## Stripe Billing

Hostlyx uses Stripe Checkout for paid upgrades and a webhook to sync active plans back into the app.

Configure these endpoints in Stripe:

- Success and cancel return path: `https://hostlyx1.netlify.app/pricing`
- Webhook endpoint: `https://hostlyx1.netlify.app/api/stripe/webhook`

Recommended Stripe webhook events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Then deploy with:

```bash
npm run build
```

or with Netlify CLI:

```bash
npx netlify deploy --prod
```

## GitHub

Suggested first push flow:

```bash
git init
git add .
git commit -m "Initial Hostlyx app"
```

Then create a GitHub repo and connect it to Netlify.
