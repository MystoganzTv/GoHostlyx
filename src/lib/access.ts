import { NextResponse } from "next/server";
import { localizedJson } from "@/lib/server-messages";
import { redirect } from "next/navigation";
import { requireUserEmail } from "@/lib/auth";
import { getSubscriptionState } from "@/lib/db";
import { canAccessDashboard } from "@/lib/subscription";

/**
 * Server pages: send users whose trial or plan has lapsed back to the main
 * dashboard, which renders the upgrade screen.
 */
export async function requireDashboardAccess(ownerEmail: string) {
  const subscription = await getSubscriptionState(ownerEmail);

  if (!canAccessDashboard(subscription)) {
    redirect("/dashboard");
  }

  return subscription;
}

type ApiAccess = { ownerEmail: string; response?: undefined } | { ownerEmail?: undefined; response: NextResponse };

/**
 * API routes that read or change workspace data: require a signed-in user with
 * an active trial or paid plan.
 */
export async function requireApiAccess(): Promise<ApiAccess> {
  const ownerEmail = await requireUserEmail();

  if (!ownerEmail) {
    return { response: await localizedJson({ error: "Unauthorized" }, { status: 401 }) };
  }

  const subscription = await getSubscriptionState(ownerEmail);

  if (!canAccessDashboard(subscription)) {
    return {
      response: await localizedJson(
        { error: "Your trial has ended. Choose a plan to keep using GoHostlyx." },
        { status: 402 },
      ),
    };
  }

  return { ownerEmail };
}
