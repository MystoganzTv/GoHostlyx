import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import { getPropertyDefinitions, insertManualExpense } from "@/lib/db";
import { normalizeManualExpense } from "@/lib/manual-entry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const properties = await getPropertyDefinitions(ownerEmail);

    if (properties.length === 0) {
      return NextResponse.json(
        { error: "Create your first property before adding expenses." },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const expense = normalizeManualExpense(formData);
    await insertManualExpense({
      ownerEmail,
      expense,
    });

    return NextResponse.json({
      message: `Expense "${expense.description}" added successfully.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The expense could not be saved.",
      },
      { status: 400 },
    );
  }
}
