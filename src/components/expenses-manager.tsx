"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Trash2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { PropertyUnitFieldGroup } from "@/components/property-unit-field-group";
import { WorkspaceDateField } from "@/components/workspace-date-field";
import { formatCurrency, formatDateLabel } from "@/lib/format";
import type { CurrencyCode, ExpenseRecord, PropertyDefinition } from "@/lib/types";
import { Modal } from "@/components/modal";

function inputClassName() {
  return "input-surface w-full rounded-2xl px-4 py-3 text-sm";
}

export function ExpensesManager({
  expenses,
  currencyCode,
  properties,
}: {
  expenses: ExpenseRecord[];
  currencyCode: CurrencyCode;
  properties: PropertyDefinition[];
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingExpense?.id) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/expenses/${editingExpense.id}`, {
            method: "PATCH",
            body: formData,
          });

          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? (isSpanish ? "No se pudo actualizar el gasto." : "The expense could not be updated."));
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "Gasto actualizado." : "Expense updated."));
          setEditingExpense(null);
          router.refresh();
        } catch {
          setError(isSpanish ? "No se pudo actualizar el gasto." : "The expense could not be updated.");
        }
      })();
    });
  }

  function confirmDeleteExpense() {
    if (!expenseToDelete?.id) {
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/expenses/${expenseToDelete.id}`, {
            method: "DELETE",
          });

          const payload = (await response.json()) as { error?: string; message?: string };

          if (!response.ok) {
            setError(payload.error ?? (isSpanish ? "No se pudo eliminar el gasto." : "The expense could not be deleted."));
            return;
          }

          setMessage(payload.message ?? (isSpanish ? "Gasto eliminado." : "Expense deleted."));
          setExpenseToDelete(null);
          router.refresh();
        } catch {
          setError(isSpanish ? "No se pudo eliminar el gasto." : "The expense could not be deleted.");
        }
      })();
    });
  }

  return (
    <>
      <div className="space-y-4">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-rose-500">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-medium">{isSpanish ? "Propiedad" : "Property"}</th>
                <th className="pb-3 pr-4 font-medium">{isSpanish ? "Fecha" : "Date"}</th>
                <th className="pb-3 pr-4 font-medium">{isSpanish ? "Categoría" : "Category"}</th>
                <th className="pb-3 pr-4 font-medium">{isSpanish ? "Descripción" : "Description"}</th>
                <th className="pb-3 pr-4 font-medium">{isSpanish ? "Importe" : "Amount"}</th>
                <th className="pb-3 font-medium">{isSpanish ? "Acciones" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id ?? `${expense.date}-${expense.description}`} className="border-t border-[var(--workspace-border)] text-[var(--workspace-muted)]">
                  <td className="py-4 pr-4">
                    <div>
                      <p className="font-medium text-[var(--workspace-text)]">{expense.propertyName}</p>
                      <p className="mt-1 text-xs text-slate-400">{expense.unitName || (isSpanish ? "Listing principal" : "Primary listing")}</p>
                    </div>
                  </td>
                  <td className="py-4 pr-4">{formatDateLabel(expense.date, locale)}</td>
                  <td className="py-4 pr-4">{expense.category}</td>
                  <td className="py-4 pr-4">
                    <div>
                      <p className="font-medium text-[var(--workspace-text)]">{expense.description}</p>
                      {expense.note ? <p className="mt-1 text-xs text-slate-400">{expense.note}</p> : null}
                    </div>
                  </td>
                  <td className="py-4 pr-4">{formatCurrency(expense.amount, false, currencyCode)}</td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingExpense(expense)}
                        className="workspace-button-secondary inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        {isSpanish ? "Editar" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseToDelete(expense)}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isSpanish ? "Eliminar" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(editingExpense)}
        title={editingExpense ? `Edit ${editingExpense.description}` : "Edit expense"}
        onClose={() => setEditingExpense(null)}
      >
        {editingExpense ? (
          <form key={editingExpense.id ?? editingExpense.date} onSubmit={submitUpdate} className="grid gap-4 sm:grid-cols-2">
            <PropertyUnitFieldGroup
              properties={properties}
              initialPropertyName={editingExpense.propertyName}
              initialUnitName={editingExpense.unitName}
            />
            <WorkspaceDateField name="date" label="Date" defaultValue={editingExpense.date} required />
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Amount</span>
              <input className={inputClassName()} type="number" min="0.01" step="0.01" name="amount" defaultValue={editingExpense.amount} required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Category</span>
              <input className={inputClassName()} name="category" defaultValue={editingExpense.category} required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Description</span>
              <input className={inputClassName()} name="description" defaultValue={editingExpense.description} required />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Note</span>
              <textarea className={`${inputClassName()} min-h-[108px] resize-y`} name="note" defaultValue={editingExpense.note} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="workspace-button-primary inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving expense..." : "Save expense"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(expenseToDelete)}
        title={expenseToDelete ? `Delete ${expenseToDelete.description}?` : "Delete expense"}
        onClose={() => setExpenseToDelete(null)}
      >
        {expenseToDelete ? (
          <div className="space-y-5">
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
              This will remove the expense <span className="font-semibold text-rose-900">&ldquo;{expenseToDelete.description}&rdquo;</span> from your workspace.
              The action cannot be undone from the app.
            </div>

            <div className="workspace-soft-card grid gap-3 rounded-[22px] p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Property</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {expenseToDelete.propertyName}
                  {expenseToDelete.unitName ? ` • ${expenseToDelete.unitName}` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Amount</p>
                <p className="mt-1 text-sm text-[var(--workspace-text)]">
                  {formatCurrency(expenseToDelete.amount, false, currencyCode)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="workspace-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteExpense}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Deleting expense..." : "Delete expense"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
