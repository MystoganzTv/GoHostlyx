import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { getAuthSession, requireUserEmail } from "@/lib/auth";
import {
  getSubscriptionState,
  updateSubscriptionPlan,
  updateSubscriptionStripeReferences,
} from "@/lib/db";
import { normalizeSubscriptionPlan } from "@/lib/subscription";
import {
  buildAppUrl,
  getStripeClient,
  getStripePriceIdForPlan,
  hasStripeBillingConfig,
} from "@/lib/stripe";

export const runtime = "nodejs";

function sanitizeReturnPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/pricing";
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return await localizedJson({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAuthSession();
    const payload = (await request.json()) as { plan?: string; returnPath?: string };
    const plan = normalizeSubscriptionPlan(payload.plan);
    const returnPath = sanitizeReturnPath(payload.returnPath);

    if (plan === "trial") {
      return await localizedJson(
        { error: "Choose a paid plan to continue." },
        { status: 400 },
      );
    }

    if (!hasStripeBillingConfig()) {
      if (process.env.NODE_ENV !== "production") {
        await updateSubscriptionPlan({ ownerEmail, plan });

        return await localizedJson({
          redirectTo: returnPath,
          mode: "local",
        });
      }

      return await localizedJson(
        { error: "Stripe billing is not configured yet." },
        { status: 500 },
      );
    }

    const stripe = getStripeClient();
    const priceId = getStripePriceIdForPlan(plan);

    if (!stripe || !priceId) {
      return await localizedJson(
        { error: "Stripe billing is not configured yet." },
        { status: 500 },
      );
    }

    const subscription = await getSubscriptionState(ownerEmail);

    // A customer with a live paid subscription must change plans through the
    // Stripe Customer Portal. Creating another Checkout session here would open
    // a second, concurrent subscription and bill the customer twice.
    if (
      subscription.status === "active" &&
      subscription.plan !== "trial" &&
      subscription.stripeCustomerId &&
      subscription.stripeSubscriptionId
    ) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: buildAppUrl(returnPath),
      });

      return await localizedJson({ url: portalSession.url, mode: "portal" });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: subscription.stripeCustomerId ?? undefined,
      customer_email: subscription.stripeCustomerId ? undefined : ownerEmail,
      allow_promotion_codes: true,
      client_reference_id: ownerEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        ownerEmail,
        plan,
      },
      subscription_data: {
        metadata: {
          ownerEmail,
          plan,
        },
      },
      success_url: buildAppUrl(`${returnPath}${returnPath.includes("?") ? "&" : "?"}billing=success`),
      cancel_url: buildAppUrl(`${returnPath}${returnPath.includes("?") ? "&" : "?"}billing=cancelled`),
    });

    if (typeof checkoutSession.customer === "string") {
      await updateSubscriptionStripeReferences({
        ownerEmail,
        stripeCustomerId: checkoutSession.customer,
      });
    }

    if (!checkoutSession.url) {
      return await localizedJson(
        { error: "Stripe checkout could not be created." },
        { status: 500 },
      );
    }

    return await localizedJson({
      url: checkoutSession.url,
      email: session?.user?.email ?? ownerEmail,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The subscription checkout could not be created."),
      },
      { status: 400 },
    );
  }
}
