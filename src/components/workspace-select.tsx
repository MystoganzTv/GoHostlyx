"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type WorkspaceSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function WorkspaceSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  name,
  required = false,
  disabled = false,
  helper,
  compact = false,
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: WorkspaceSelectOption[];
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  compact?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <div ref={rootRef} className={`relative space-y-2 ${className}`}>
      {label ? (
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          {label}
        </span>
      ) : null}

      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`input-surface flex w-full items-center justify-between gap-3 rounded-2xl text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "min-w-[150px] px-4 py-3 text-sm font-medium" : "px-4 py-3 text-sm"
        }`}
      >
        <div className="min-w-0">
          <p className={selectedOption ? "truncate text-[var(--workspace-text)]" : "truncate text-[var(--workspace-muted)]"}>
            {selectedOption?.label ?? placeholder}
          </p>
          {!compact && selectedOption?.description ? (
            <p className="mt-1 truncate text-xs text-[var(--workspace-muted)]">
              {selectedOption.description}
            </p>
          ) : null}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--workspace-muted)] transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}

      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,28,46,0.98)_0%,rgba(10,19,31,0.98)_100%)] p-2 shadow-[0_24px_60px_rgba(2,6,23,0.48)]">
          <div className="max-h-72 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-start justify-between gap-3 rounded-[18px] px-3 py-3 text-left transition ${
                    isSelected
                      ? "bg-[var(--workspace-accent-soft)] text-[var(--workspace-text)]"
                      : "text-[var(--workspace-text)] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{option.label}</p>
                    {option.description ? (
                      <p className="mt-1 text-xs text-[var(--workspace-muted)]">
                        {option.description}
                      </p>
                    ) : null}
                  </div>
                  {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-accent)]" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
