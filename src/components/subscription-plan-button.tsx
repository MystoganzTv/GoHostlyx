"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionPlan } from "@/lib/types";

export function SubscriptionPlanButton({
  plan,
  currentPlan,
  className,
  redirectTo = "/dashboard",
  labels,
}: {
  plan: SubscriptionPlan;
  currentPlan: SubscriptionPlan;
  className: string;
  redirectTo?: string;
  labels?: Partial<{
    currentPlan: string;
    starter: string;
    pro: string;
    portfolio: string;
    loading: string;
    error: string;
  }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCurrentPlan = plan === currentPlan;
  const label =
    isCurrentPlan
      ? (labels?.currentPlan ?? "Current plan")
      : plan === "starter"
        ? (labels?.starter ?? "Choose Starter")
        : plan === "pro"
          ? (labels?.pro ?? "Choose Pro")
          : (labels?.portfolio ?? "Choose Portfolio");

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={isPending || isCurrentPlan}
        onClick={() => {
          setError(null);

          startTransition(() => {
            void (async () => {
              try {
                const response = await fetch("/api/subscription", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ plan, returnPath: redirectTo }),
                });
                const payload = (await response.json()) as {
                  error?: string;
                  url?: string;
                  redirectTo?: string;
                };

                if (!response.ok) {
                  setError(payload.error ?? labels?.error ?? "The plan could not be updated.");
                  return;
                }

                if (payload.url) {
                  window.location.assign(payload.url);
                  return;
                }

                if (payload.redirectTo) {
                  router.push(payload.redirectTo);
                  router.refresh();
                  return;
                }

                router.push(redirectTo);
                router.refresh();
              } catch {
                setError(labels?.error ?? "The plan could not be updated.");
              }
            })();
          });
        }}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {isPending ? (labels?.loading ?? "Updating plan...") : label}
      </button>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
