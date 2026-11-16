import { requireUserEmail } from "@/lib/auth";
import { buildWorkspaceExport } from "@/lib/data-export";
import { getBookings, getExpenses, getImportSummaries, getPropertyDefinitions } from "@/lib/db";
import { localizedJson } from "@/lib/server-messages";

export const runtime = "nodejs";

// Exporting stays available after a trial ends: the data belongs to the user.
export async function GET() {
  const ownerEmail = await requireUserEmail();

  if (!ownerEmail) {
    return localizedJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [bookings, expenses, properties, imports] = await Promise.all([
      getBookings(ownerEmail),
      getExpenses(ownerEmail),
      getPropertyDefinitions(ownerEmail),
      getImportSummaries(ownerEmail),
    ]);
    const file = buildWorkspaceExport({ bookings, expenses, properties, imports });
    const date = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="GoHostlyx export ${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export]", error);
    return localizedJson({ error: "The export could not be created." }, { status: 500 });
  }
}
