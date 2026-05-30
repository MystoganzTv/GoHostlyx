import { NextResponse } from "next/server";
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
  if (!value || !value.startsWith("/")) {
    return "/pricing";
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getAuthSession();
    const payload = (await request.json()) as { plan?: string; returnPath?: string };
    const plan = normalizeSubscriptionPlan(payload.plan);
    const returnPath = sanitizeReturnPath(payload.returnPath);

    if (plan === "trial") {
      return NextResponse.json(
        { error: "Choose a paid plan to continue." },
        { status: 400 },
      );
    }

    if (!hasStripeBillingConfig()) {
      if (process.env.NODE_ENV !== "production") {
        await updateSubscriptionPlan({ ownerEmail, plan });

        return NextResponse.json({
          redirectTo: returnPath,
          mode: "local",
        });
      }

      return NextResponse.json(
        { error: "Stripe billing is not configured yet." },
        { status: 500 },
      );
    }

    const stripe = getStripeClient();
    const priceId = getStripePriceIdForPlan(plan);

    if (!stripe || !priceId) {
      return NextResponse.json(
        { error: "Stripe billing is not configured yet." },
        { status: 500 },
      );
    }

    const subscription = await getSubscriptionState(ownerEmail);

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
      return NextResponse.json(
        { error: "Stripe checkout could not be created." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: checkoutSession.url,
      email: session?.user?.email ?? ownerEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The subscription checkout could not be created.",
      },
      { status: 400 },
    );
  }
}
