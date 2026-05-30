import type { BookingStatusState } from "@/lib/booking-status";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeChannelLabel(channel: string) {
  const normalized = channel.trim().toLowerCase();

  if (normalized.includes("airbnb")) {
    return {
      label: "airbnb",
      className:
        "border-rose-400/20 bg-rose-400/[0.08] text-rose-200 shadow-[0_10px_24px_rgba(251,113,133,0.10)]",
    };
  }

  if (normalized.includes("vrbo")) {
    return {
      label: "vrbo",
      className:
        "border-violet-400/20 bg-violet-400/[0.08] text-violet-200 shadow-[0_10px_24px_rgba(167,139,250,0.10)]",
    };
  }

  if (normalized.includes("booking")) {
    return {
      label: "booking",
      className:
        "border-sky-400/20 bg-sky-400/[0.08] text-sky-200 shadow-[0_10px_24px_rgba(56,189,248,0.10)]",
    };
  }

  if (normalized.includes("direct")) {
    return {
      label: "direct",
      className:
        "border-teal-400/18 bg-teal-400/[0.08] text-teal-200 shadow-[0_10px_24px_rgba(45,212,191,0.08)]",
    };
  }

  return {
    label: channel.trim() || "other",
    className:
      "border-slate-300/14 bg-white/[0.04] text-slate-300 shadow-[0_10px_24px_rgba(148,163,184,0.06)]",
  };
}

function getStatusClassName(tone: BookingStatusState["tone"]) {
  if (tone === "active") {
    return "border-teal-300/24 bg-teal-300/[0.08] text-teal-100 shadow-[0_10px_24px_rgba(45,212,191,0.08)]";
  }

  if (tone === "success") {
    return "border-emerald-300/24 bg-emerald-300/[0.08] text-emerald-100 shadow-[0_10px_24px_rgba(74,222,128,0.08)]";
  }

  if (tone === "danger") {
    return "border-rose-400/22 bg-rose-400/[0.08] text-rose-100 shadow-[0_10px_24px_rgba(251,113,133,0.08)]";
  }

  if (tone === "neutral") {
    return "border-slate-300/16 bg-white/[0.04] text-slate-200 shadow-[0_10px_24px_rgba(148,163,184,0.05)]";
  }

  return "border-amber-300/24 bg-amber-300/[0.08] text-amber-100 shadow-[0_10px_24px_rgba(251,191,36,0.08)]";
}

export function BookingChannelBadge({
  channel,
  className,
}: {
  channel: string;
  className?: string;
}) {
  const resolved = normalizeChannelLabel(channel);

  return (
    <span
      className={joinClasses(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold lowercase tracking-[0.08em]",
        resolved.className,
        className,
      )}
    >
      {resolved.label}
    </span>
  );
}

export function BookingStatusBadge({
  status,
  className,
}: {
  status: BookingStatusState;
  className?: string;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em]",
        getStatusClassName(status.tone),
        className,
      )}
    >
      {status.label}
    </span>
  );
}
