import type {
  SubscriptionPlan,
  SubscriptionState,
  SubscriptionStatus,
} from "./types";

export const subscriptionPlans: SubscriptionPlan[] = ["starter", "pro", "portfolio"];
export const trialLengthDays = 7;

export function isPaidPlan(plan: SubscriptionPlan) {
  return plan === "starter" || plan === "pro" || plan === "portfolio";
}

export function normalizeSubscriptionPlan(value: string | undefined): SubscriptionPlan {
  if (value === "starter" || value === "pro" || value === "portfolio") {
    return value;
  }

  return "trial";
}

export function normalizeSubscriptionStatus(value: string | undefined): SubscriptionStatus {
  if (value === "active" || value === "expired") {
    return value;
  }

  return "trialing";
}

export function getTrialEndDate(startedAt: string) {
  const start = new Date(startedAt);
  const result = Number.isNaN(start.getTime()) ? new Date() : start;
  result.setDate(result.getDate() + trialLengthDays);
  return result.toISOString();
}

export function getTrialDaysLeft(subscription: SubscriptionState) {
  if (subscription.status !== "trialing") {
    return 0;
  }

  const now = Date.now();
  const trialEndsAt = new Date(subscription.trialEndsAt).getTime();

  if (!Number.isFinite(trialEndsAt) || trialEndsAt <= now) {
    return 0;
  }

  return Math.max(1, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)));
}

export function canAccessDashboard(subscription: SubscriptionState) {
  return subscription.status === "trialing" || subscription.status === "active";
}

export function canAccessInsights(subscription: SubscriptionState) {
  return (
    subscription.status === "trialing" ||
    (subscription.status === "active" &&
      (subscription.plan === "pro" || subscription.plan === "portfolio"))
  );
}

export function canAccessReports(subscription: SubscriptionState) {
  return canAccessInsights(subscription);
}

export function getSubscriptionBadge(subscription: SubscriptionState) {
  if (subscription.status === "trialing") {
    const daysLeft = getTrialDaysLeft(subscription);
    return {
      label: "Trial",
      detail: daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Ends today",
      tone: "trial" as const,
    };
  }

  if (subscription.status === "expired") {
    return {
      label: "Trial",
      detail: "0 days left",
      tone: "expired" as const,
    };
  }

  return {
    label:
      subscription.plan === "portfolio"
        ? "Portfolio"
        : subscription.plan === "pro"
          ? "Pro"
          : "Starter",
    detail: "Active plan",
    tone: subscription.plan,
  };
}

export function getUpgradeTarget(subscription: SubscriptionState) {
  if (subscription.status === "trialing" || subscription.status === "expired") {
    return "starter";
  }

  if (subscription.plan === "starter") {
    return "pro";
  }

  if (subscription.plan === "pro") {
    return "portfolio";
  }

  return "portfolio";
}

export function getPlanLabel(plan: SubscriptionPlan) {
  if (plan === "portfolio") {
    return "Portfolio";
  }

  if (plan === "pro") {
    return "Pro";
  }

  if (plan === "starter") {
    return "Starter";
  }

  return "Trial";
}
