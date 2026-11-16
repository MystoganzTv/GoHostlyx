import { localizedJson } from "@/lib/server-messages";
import { requireUserEmail } from "@/lib/auth";
import { getSubscriptionState } from "@/lib/db";
import { buildAppUrl, getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

// Opens the Stripe Customer Portal so subscribers can change plan, cancel,
// or update their payment method.
export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return await localizedJson({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = getStripeClient();

    if (!stripe) {
      return await localizedJson({ error: "Stripe billing is not configured yet." }, { status: 500 });
    }

    const subscription = await getSubscriptionState(ownerEmail);

    if (!subscription.stripeCustomerId) {
      return await localizedJson(
        { error: "There is no billing account for this workspace yet." },
        { status: 400 },
      );
    }

    const payload = (await request.json().catch(() => ({}))) as { returnPath?: string };
    const returnPath =
      payload.returnPath && payload.returnPath.startsWith("/") && !payload.returnPath.startsWith("//")
        ? payload.returnPath
        : "/pricing";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: buildAppUrl(returnPath),
    });

    return await localizedJson({ url: portalSession.url });
  } catch (error) {
    console.error("[billing-portal]", error);
    return await localizedJson(
      { error: "The billing portal could not be opened." },
      { status: 500 },
    );
  }
}
