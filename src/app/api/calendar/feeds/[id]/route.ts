import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { disconnectIcalFeed } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const feedId = Number((await params).id);

    if (!Number.isFinite(feedId) || feedId <= 0) {
      return await localizedJson({ error: "Invalid feed id." }, { status: 400 });
    }

    await disconnectIcalFeed({
      ownerEmail,
      feedId,
    });

    return await localizedJson({
      message: "Feed disconnected.",
    });
  } catch (error) {
    return await localizedJson(
      {
        error: clientErrorMessage(error, "The iCal feed could not be disconnected."),
      },
      { status: 400 },
    );
  }
}
