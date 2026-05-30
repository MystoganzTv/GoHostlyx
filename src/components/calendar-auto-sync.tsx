"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function CalendarAutoSync({
  enabled,
  force,
}: {
  enabled: boolean;
  force?: boolean;
}) {
  const router = useRouter();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    let isCancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/calendar/feeds/sync-due${force ? "?force=1" : ""}`, {
          method: "POST",
        });

        if (!response.ok || isCancelled) {
          return;
        }

        const payload = (await response.json()) as {
          attempted?: number;
          synced?: number;
        };

        if (!isCancelled && (payload.attempted ?? 0) > 0) {
          router.refresh();
        }
      } catch {
        // Background sync should stay quiet if the provider is slow or unavailable.
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [enabled, force, router]);

  return null;
}
