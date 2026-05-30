import { NextResponse } from "next/server";
import { isAdminOwnerEmail } from "@/lib/admin";
import { requireUserEmail } from "@/lib/auth";
import { deleteManagedUser, revokeSubscriptionAccess, updateSubscriptionPlan } from "@/lib/db";
import { normalizeSubscriptionPlan } from "@/lib/subscription";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail || !isAdminOwnerEmail(ownerEmail)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as {
      ownerEmail?: string;
      action?: string;
      plan?: string;
    };
    const targetEmail = payload.ownerEmail?.trim().toLowerCase();

    if (!targetEmail) {
      return NextResponse.json({ error: "Choose a user first." }, { status: 400 });
    }

    if (isAdminOwnerEmail(targetEmail) && payload.action !== "set-plan") {
      return NextResponse.json({ error: "The primary admin account cannot lose access." }, { status: 400 });
    }

    if (payload.action === "revoke") {
      await revokeSubscriptionAccess(targetEmail);

      return NextResponse.json({ message: "Access revoked." });
    }

    const plan = normalizeSubscriptionPlan(payload.plan);

    if (plan === "trial") {
      return NextResponse.json({ error: "Choose Starter, Pro, or Portfolio." }, { status: 400 });
    }

    await updateSubscriptionPlan({
      ownerEmail: targetEmail,
      plan,
    });

    return NextResponse.json({ message: `Updated subscription to ${plan}.` });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The admin action could not be completed.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail || !isAdminOwnerEmail(ownerEmail)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { ownerEmail?: string };
    const targetEmail = payload.ownerEmail?.trim().toLowerCase();

    if (!targetEmail) {
      return NextResponse.json({ error: "Choose a user first." }, { status: 400 });
    }

    await deleteManagedUser(targetEmail);

    return NextResponse.json({ message: "User deleted." });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The user could not be deleted.",
      },
      { status: 400 },
    );
  }
}
