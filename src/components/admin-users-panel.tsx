"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminUserSummary, SubscriptionPlan } from "@/lib/types";

const paidPlans: SubscriptionPlan[] = ["starter", "pro", "portfolio"];

function subscriptionToneClassName(plan: AdminUserSummary["subscription"]["plan"], status: AdminUserSummary["subscription"]["status"]) {
  if (status === "expired") {
    return "border-rose-300/16 bg-rose-400/10 text-rose-100";
  }

  if (plan === "portfolio") {
    return "border-emerald-300/16 bg-emerald-400/10 text-emerald-100";
  }

  if (plan === "pro") {
    return "border-cyan-300/16 bg-cyan-400/10 text-cyan-100";
  }

  if (plan === "starter") {
    return "border-white/10 bg-white/[0.05] text-white";
  }

  return "border-amber-300/16 bg-amber-400/10 text-amber-50";
}

function formatSubscriptionLabel(user: AdminUserSummary) {
  if (user.subscription.status === "expired") {
    return "Access off";
  }

  if (user.subscription.status === "trialing") {
    return "Trial";
  }

  return user.subscription.plan === "portfolio"
    ? "Portfolio"
    : user.subscription.plan === "pro"
      ? "Pro"
      : "Starter";
}

export function AdminUsersPanel({
  users,
}: {
  users: AdminUserSummary[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(key: string, action: () => Promise<void>) {
    setError(null);
    setPendingKey(key);

    startTransition(() => {
      void (async () => {
        try {
          await action();
          router.refresh();
        } catch (nextError) {
          setError(nextError instanceof Error ? nextError.message : "The admin action could not be completed.");
        } finally {
          setPendingKey(null);
        }
      })();
    });
  }

  async function updatePlan(ownerEmail: string, plan: SubscriptionPlan) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ownerEmail,
        action: "set-plan",
        plan,
      }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "The plan could not be updated.");
    }
  }

  async function revokeAccess(ownerEmail: string) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ownerEmail,
        action: "revoke",
      }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Access could not be revoked.");
    }
  }

  async function deleteUser(ownerEmail: string) {
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ownerEmail,
      }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "The user could not be deleted.");
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-[22px] border border-rose-300/16 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {users.map((user) => {
        const rowBusy = isPending && pendingKey?.startsWith(user.ownerEmail);

        return (
          <section key={user.ownerEmail} className="workspace-card rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--workspace-text)]">
                    {user.businessName}
                  </h2>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${subscriptionToneClassName(user.subscription.plan, user.subscription.status)}`}
                  >
                    {formatSubscriptionLabel(user)}
                  </span>
                  {user.isAdmin ? (
                    <span className="rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                      Primary admin
                    </span>
                  ) : null}
                </div>

                <p className="text-sm text-[var(--workspace-muted)]">{user.ownerEmail}</p>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="workspace-soft-card rounded-[20px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Properties</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">{user.propertiesCount}</p>
                  </div>
                  <div className="workspace-soft-card rounded-[20px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Imports</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">{user.importsCount}</p>
                  </div>
                  <div className="workspace-soft-card rounded-[20px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Bookings</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">{user.bookingsCount}</p>
                  </div>
                  <div className="workspace-soft-card rounded-[20px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">Expenses</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--workspace-text)]">{user.expensesCount}</p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 xl:w-[360px]">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                    Access control
                  </p>
                  {user.isAdmin ? (
                    <p className="mt-3 text-sm leading-6 text-[var(--workspace-muted)]">
                      Your admin workspace can still move between Starter, Pro, and Portfolio here. Only revoke and delete stay locked.
                    </p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {paidPlans.map((plan) => (
                      <button
                        key={plan}
                        type="button"
                        disabled={rowBusy}
                        onClick={() => runAction(`${user.ownerEmail}-${plan}`, () => updatePlan(user.ownerEmail, plan))}
                        className={`rounded-2xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          user.subscription.status === "active" && user.subscription.plan === plan
                            ? "workspace-button-primary"
                            : "workspace-button-secondary"
                        }`}
                      >
                        {plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Portfolio"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      disabled={rowBusy || user.isAdmin}
                      onClick={() => runAction(`${user.ownerEmail}-revoke`, () => revokeAccess(user.ownerEmail))}
                      className="rounded-2xl border border-amber-300/16 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Revoke paid access
                    </button>
                    <button
                      type="button"
                      disabled={rowBusy || user.isAdmin}
                      onClick={() => {
                        if (!window.confirm(`Delete ${user.ownerEmail}? This removes their data and access.`)) {
                          return;
                        }

                        runAction(`${user.ownerEmail}-delete`, () => deleteUser(user.ownerEmail));
                      }}
                      className="rounded-2xl border border-rose-300/16 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Delete user
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
