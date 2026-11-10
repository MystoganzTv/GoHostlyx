import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { isAdminOwnerEmail } from "@/lib/admin";
import { requireUserEmail } from "@/lib/auth";
import { deleteManagedUser, revokeSubscriptionAccess, updateSubscriptionPlan } from "@/lib/db";
import { normalizeSubscriptionPlan } from "@/lib/subscription";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail || !isAdminOwnerEmail(ownerEmail)) {
      return await localizedJson({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as {
      ownerEmail?: string;
      action?: string;
      plan?: string;
    };
    const targetEmail = payload.ownerEmail?.trim().toLowerCase();

    if (!targetEmail) {
      return await localizedJson({ error: "Choose a user first." }, { status: 400 });
    }

    if (isAdminOwnerEmail(targetEmail) && payload.action !== "set-plan") {
      return await localizedJson({ error: "The primary admin account cannot lose access." }, { status: 400 });
    }

    if (payload.action === "revoke") {
      await revokeSubscriptionAccess(targetEmail);

      return await localizedJson({ message: "Access revoked." });
    }

    const plan = normalizeSubscriptionPlan(payload.plan);

    if (plan === "trial") {
      return await localizedJson({ error: "Choose Starter, Pro, or Portfolio." }, { status: 400 });
    }

    await updateSubscriptionPlan({
      ownerEmail: targetEmail,
      plan,
    });

    return await localizedJson({ message: `Updated subscription to ${plan}.` });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The admin action could not be completed."),
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail || !isAdminOwnerEmail(ownerEmail)) {
      return await localizedJson({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { ownerEmail?: string };
    const targetEmail = payload.ownerEmail?.trim().toLowerCase();

    if (!targetEmail) {
      return await localizedJson({ error: "Choose a user first." }, { status: 400 });
    }

    await deleteManagedUser(targetEmail);

    return await localizedJson({ message: "User deleted." });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The user could not be deleted."),
      },
      { status: 400 },
    );
  }
}
