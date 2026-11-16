import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { requireApiAccess } from "@/lib/access";
import { getPropertyDefinitions, insertManualExpense } from "@/lib/db";
import { normalizeManualExpense } from "@/lib/manual-entry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess();

    if (access.response) {
      return access.response;
    }

    const { ownerEmail } = access;

    const properties = await getPropertyDefinitions(ownerEmail);

    if (properties.length === 0) {
      return await localizedJson(
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

    return await localizedJson({
      message: `Expense "${expense.description}" added successfully.`,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The expense could not be saved."),
      },
      { status: 400 },
    );
  }
}
