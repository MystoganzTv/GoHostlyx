import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
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
      return await localizedJson({ error: "Invalid expense id." }, { status: 400 });
    }

    const formData = await request.formData();
    const expense = normalizeManualExpense(formData);
    const updated = await updateExpenseRecord({
      ownerEmail,
      expenseId,
      expense,
    });

    if (!updated) {
      return await localizedJson({ error: "Expense not found." }, { status: 404 });
    }

    return await localizedJson({
      message: `Expense "${expense.description}" updated successfully.`,
    });
  } catch (error) {
    return await localizedJson(
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
      return await localizedJson({ error: "Invalid expense id." }, { status: 400 });
    }

    const deleted = await deleteExpenseRecord({
      ownerEmail,
      expenseId,
    });

    if (!deleted) {
      return await localizedJson({ error: "Expense not found." }, { status: 404 });
    }

    return await localizedJson({
      message: "Expense deleted successfully.",
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The expense could not be deleted."),
      },
      { status: 400 },
    );
  }
}
