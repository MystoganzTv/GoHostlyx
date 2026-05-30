"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { getDateFnsLocale } from "@/lib/i18n";

const calendarMonthOptions = [
  { value: 0, label: "January", shortLabel: "Jan" },
  { value: 1, label: "February", shortLabel: "Feb" },
  { value: 2, label: "March", shortLabel: "Mar" },
  { value: 3, label: "April", shortLabel: "Apr" },
  { value: 4, label: "May", shortLabel: "May" },
  { value: 5, label: "June", shortLabel: "Jun" },
  { value: 6, label: "July", shortLabel: "Jul" },
  { value: 7, label: "August", shortLabel: "Aug" },
  { value: 8, label: "September", shortLabel: "Sep" },
  { value: 9, label: "October", shortLabel: "Oct" },
  { value: 10, label: "November", shortLabel: "Nov" },
  { value: 11, label: "December", shortLabel: "Dec" },
];

function buildCalendarDays(month: Date) {
  const calendarStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days: Date[] = [];

  let current = calendarStart;

  while (current <= calendarEnd) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
}

function normalizeDateValue(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function WorkspaceDateField({
  name,
  label,
  defaultValue,
  value,
  onChange,
  placeholder = "Select date",
  required = false,
  compact = false,
  className = "",
  hideLabel = false,
}: {
  name?: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  compact?: boolean;
  className?: string;
  hideLabel?: boolean;
}) {
  const { locale } = useLocale();
  const isSpanish = locale === "es";
  const dateFnsLocale = getDateFnsLocale(locale);
  const normalizedDefaultValue = normalizeDateValue(defaultValue);
  const normalizedControlledValue = normalizeDateValue(value);
  const [internalValue, setInternalValue] = useState(normalizedDefaultValue);
  const currentValue = value !== undefined ? normalizedControlledValue : internalValue;
  const initialMonthValue = normalizedControlledValue || normalizedDefaultValue;
  const initialMonth = initialMonthValue ? parseISO(initialMonthValue) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(initialMonth));
  const [isOpen, setIsOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<"month" | "year" | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const monthOptions = calendarMonthOptions.map((month) => ({
    ...month,
    label: format(new Date(2024, month.value, 1), "MMMM", { locale: dateFnsLocale }),
    shortLabel: format(new Date(2024, month.value, 1), "MMM", { locale: dateFnsLocale }),
  }));

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

  const selectedDate = currentValue ? parseISO(currentValue) : null;
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const visibleYear = getYear(visibleMonth);
    const selectedYear = selectedDate ? getYear(selectedDate) : visibleYear;
    const startYear = Math.min(currentYear - 12, visibleYear - 8, selectedYear - 4);
    const endYear = Math.max(currentYear + 3, visibleYear + 4, selectedYear + 2);
    const years: number[] = [];

    for (let year = endYear; year >= startYear; year -= 1) {
      years.push(year);
    }

    return years;
  }, [selectedDate, visibleMonth]);

  function chooseDate(nextDate: Date) {
    const nextValue = format(nextDate, "yyyy-MM-dd");
    if (value !== undefined) {
      onChange?.(nextValue);
    } else {
      setInternalValue(nextValue);
    }
    setVisibleMonth(startOfMonth(nextDate));
    setActivePicker(null);
    setIsOpen(false);
  }

  function clearDate() {
    if (value !== undefined) {
      onChange?.("");
    } else {
      setInternalValue("");
    }
    setActivePicker(null);
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative space-y-2 ${className}`}>
      {!hideLabel ? (
        <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          {label}
        </label>
      ) : null}
      {name ? <input type="hidden" name={name} value={currentValue} required={required} /> : null}

      <button
        type="button"
        onClick={() => {
          setIsOpen((current) => {
            const nextOpen = !current;

            if (nextOpen) {
              setVisibleMonth(startOfMonth(currentValue ? parseISO(currentValue) : new Date()));
            }

            if (!nextOpen) {
              setActivePicker(null);
            }

            return nextOpen;
          });
        }}
        className={`input-surface flex w-full items-center justify-between rounded-2xl text-left text-sm ${
          compact ? "min-w-[170px] px-4 py-3" : "px-4 py-3"
        }`}
      >
        <span className={currentValue ? "text-[var(--workspace-text)]" : "text-[var(--workspace-muted)]"}>
          {selectedDate
            ? format(selectedDate, isSpanish ? "d MMM yyyy" : "MMM d, yyyy", {
                locale: dateFnsLocale,
              })
            : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 text-[var(--workspace-muted)]" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,28,46,0.98)_0%,rgba(10,19,31,0.98)_100%)] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.48)]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setActivePicker(null);
                setVisibleMonth((current) => subMonths(current, 1));
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
              aria-label={isSpanish ? "Mes anterior" : "Previous month"}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={isSpanish ? "Seleccionar mes" : "Select month"}
                onClick={() => setActivePicker((current) => (current === "month" ? null : "month"))}
                className={`rounded-2xl border px-3 py-2 text-sm font-semibold text-white outline-none transition ${
                  activePicker === "month"
                    ? "border-[var(--workspace-accent)]/45 bg-[var(--workspace-accent)]/12"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {format(visibleMonth, "MMMM", { locale: dateFnsLocale })}
              </button>
              <button
                type="button"
                aria-label={isSpanish ? "Seleccionar año" : "Select year"}
                onClick={() => setActivePicker((current) => (current === "year" ? null : "year"))}
                className={`rounded-2xl border px-3 py-2 text-sm font-semibold text-white outline-none transition ${
                  activePicker === "year"
                    ? "border-[var(--workspace-accent)]/45 bg-[var(--workspace-accent)]/12"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {format(visibleMonth, "yyyy")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setActivePicker(null);
                setVisibleMonth((current) => addMonths(current, 1));
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
              aria-label={isSpanish ? "Mes siguiente" : "Next month"}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {activePicker === "month" ? (
            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.025] p-3">
              <div className="grid grid-cols-3 gap-2">
                {monthOptions.map((month) => {
                  const isActive = month.value === getMonth(visibleMonth);

                  return (
                    <button
                      key={month.value}
                      type="button"
                      onClick={() => {
                        setVisibleMonth(new Date(getYear(visibleMonth), month.value, 1));
                        setActivePicker(null);
                      }}
                      title={month.label}
                      className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-[var(--workspace-accent)] text-slate-950 shadow-[0_12px_30px_rgba(88,196,182,0.28)]"
                          : "bg-white/[0.03] text-[var(--workspace-text)] hover:bg-white/[0.08]"
                      }`}
                    >
                      {month.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : activePicker === "year" ? (
            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.025] p-3">
              <div className="grid max-h-[228px] grid-cols-3 gap-2 overflow-y-auto pr-1">
                {yearOptions.map((year) => {
                  const isActive = year === getYear(visibleMonth);

                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        setVisibleMonth(new Date(year, getMonth(visibleMonth), 1));
                        setActivePicker(null);
                      }}
                      className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-[var(--workspace-accent)] text-slate-950 shadow-[0_12px_30px_rgba(88,196,182,0.28)]"
                          : "bg-white/[0.03] text-[var(--workspace-text)] hover:bg-white/[0.08]"
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)]">
                {(isSpanish
                  ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
                  : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const currentMonth = isSameMonth(day, visibleMonth);
                  const today = isToday(day);

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => chooseDate(day)}
                      className={`flex h-10 items-center justify-center rounded-2xl text-sm transition ${
                        selected
                          ? "bg-[var(--workspace-accent)] text-slate-950 shadow-[0_12px_30px_rgba(88,196,182,0.28)]"
                          : currentMonth
                            ? "bg-white/[0.03] text-[var(--workspace-text)] hover:bg-white/[0.08]"
                            : "bg-transparent text-slate-600 hover:bg-white/[0.04]"
                      } ${today && !selected ? "ring-1 ring-[var(--workspace-accent)]/40" : ""}`}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <button
              type="button"
              onClick={clearDate}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--workspace-muted)] transition hover:text-white"
            >
              {isSpanish ? "Limpiar" : "Clear"}
            </button>
            <button
              type="button"
              onClick={() => chooseDate(new Date())}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/[0.08]"
            >
              {isSpanish ? "Hoy" : "Today"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
