import { clientErrorMessage } from "@/lib/client-error";
import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/access";
import { deleteExpenseRecord, updateExpenseRecord } from "@/lib/db";
import { normalizeManualExpense } from "@/lib/manual-entry";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const expenseId = Number((await params).id);

    if (!Number.isFinite(expenseId) || expenseId <= 0) {
      return NextResponse.json({ error: "Invalid expense id." }, { status: 400 });
    }

    const formData = await request.formData();
    const expense = normalizeManualExpense(formData);
    const updated = await updateExpenseRecord({
      ownerEmail,
      expenseId,
      expense,
    });

    if (!updated) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: `Expense "${expense.description}" updated successfully.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          clientErrorMessage(error, "The expense could not be updated."),
      },
      { status: 400 },
    );
  }
}

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

    const expenseId = Number((await params).id);

    if (!Number.isFinite(expenseId) || expenseId <= 0) {
      return NextResponse.json({ error: "Invalid expense id." }, { status: 400 });
    }

    const deleted = await deleteExpenseRecord({
      ownerEmail,
      expenseId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Expense not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: "Expense deleted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          clientErrorMessage(error, "The expense could not be deleted."),
      },
      { status: 400 },
    );
  }
}
