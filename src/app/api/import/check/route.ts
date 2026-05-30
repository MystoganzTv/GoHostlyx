import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { getImportedWorkbookMatches } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as { hashes?: unknown };
    const hashes = Array.isArray(payload.hashes)
      ? payload.hashes.filter((value): value is string => typeof value === "string")
      : [];

    const matches = await getImportedWorkbookMatches(ownerEmail, hashes);

    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json(
      { error: "The duplicate check could not be completed." },
      { status: 400 },
    );
  }
}
