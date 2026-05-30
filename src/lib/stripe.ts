import Stripe from "stripe";
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/types";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const stripePriceIds: Record<Exclude<SubscriptionPlan, "trial">, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? "",
  pro: process.env.STRIPE_PRICE_PRO ?? "",
  portfolio: process.env.STRIPE_PRICE_PORTFOLIO ?? "",
};

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!stripeSecretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey);
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  return stripeWebhookSecret;
}

export function hasStripeBillingConfig() {
  return Boolean(
    stripeSecretKey &&
      stripeWebhookSecret &&
      stripePriceIds.starter &&
      stripePriceIds.pro &&
      stripePriceIds.portfolio,
  );
}

export function getStripePriceIdForPlan(plan: SubscriptionPlan) {
  if (plan === "trial") {
    return null;
  }

  return stripePriceIds[plan] || null;
}

export function getPlanFromStripePriceId(priceId: string | null | undefined): SubscriptionPlan {
  if (!priceId) {
    return "trial";
  }

  if (priceId === stripePriceIds.starter) {
    return "starter";
  }

  if (priceId === stripePriceIds.pro) {
    return "pro";
  }

  if (priceId === stripePriceIds.portfolio) {
    return "portfolio";
  }

  return "trial";
}

export function getBaseAppUrl() {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export function buildAppUrl(pathname: string) {
  return new URL(pathname, getBaseAppUrl()).toString();
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "active" || status === "trialing" || status === "past_due") {
    return "active";
  }

  return "expired";
}
