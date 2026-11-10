import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  findOwnerEmailByStripeCustomerId,
  getSubscriptionState,
  syncSubscriptionFromStripe,
  updateSubscriptionStripeReferences,
} from "@/lib/db";
import { normalizeSubscriptionPlan } from "@/lib/subscription";
import {
  getPlanFromStripePriceId,
  getStripeClient,
  getStripeWebhookSecret,
  mapStripeSubscriptionStatus,
} from "@/lib/stripe";

export const runtime = "nodejs";

function getOwnerEmailFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const ownerEmail = metadata?.ownerEmail?.trim().toLowerCase();
  return ownerEmail || null;
}

// The price is the source of truth: plan changes made in the Customer Portal
// or the Stripe dashboard update the price but not the checkout metadata.
function getPlanFromSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const pricePlan = getPlanFromStripePriceId(priceId);

  if (pricePlan !== "trial") {
    return pricePlan;
  }

  return normalizeSubscriptionPlan(subscription.metadata?.plan);
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  const signature = request.headers.get("stripe-signature");

  if (!stripe || !webhookSecret || !signature) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ownerEmail = getOwnerEmailFromMetadata(session.metadata);

        if (ownerEmail) {
          await updateSubscriptionStripeReferences({
            ownerEmail,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
            stripeSubscriptionId:
              typeof session.subscription === "string" ? session.subscription : null,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const ownerEmail =
          getOwnerEmailFromMetadata(subscription.metadata) ??
          (customerId ? await findOwnerEmailByStripeCustomerId(customerId) : null);

        if (!ownerEmail) {
          break;
        }

        const plan = getPlanFromSubscription(subscription);
        const priceId = subscription.items.data[0]?.price?.id ?? null;

        if (plan === "trial") {
          break;
        }

        const status =
          event.type === "customer.subscription.deleted"
            ? "expired"
            : mapStripeSubscriptionStatus(subscription.status);
        const current = await getSubscriptionState(ownerEmail);

        // Ignore events about a subscription other than the one on file unless
        // they activate access. Otherwise cancelling an old subscription would
        // revoke access from a customer who is paying for a newer one.
        if (
          current.stripeSubscriptionId &&
          current.stripeSubscriptionId !== subscription.id &&
          status !== "active"
        ) {
          break;
        }

        await syncSubscriptionFromStripe({
          ownerEmail,
          plan,
          status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook]", event.type, error);
    return NextResponse.json({ error: "Stripe webhook processing failed." }, { status: 500 });
  }
}
