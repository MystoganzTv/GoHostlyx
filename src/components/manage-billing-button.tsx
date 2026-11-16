"use client";

import { useState, useTransition } from "react";

export function ManageBillingButton({
  label,
  errorLabel,
  returnPath = "/pricing",
}: {
  label: string;
  errorLabel: string;
  returnPath?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            void (async () => {
              try {
                const response = await fetch("/api/subscription/portal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ returnPath }),
                });
                const payload = (await response.json()) as { url?: string; error?: string };

                if (!response.ok || !payload.url) {
                  setError(payload.error ?? errorLabel);
                  return;
                }

                window.location.assign(payload.url);
              } catch {
                setError(errorLabel);
              }
            })();
          });
        }}
        className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] disabled:opacity-60"
      >
        {label}
      </button>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
