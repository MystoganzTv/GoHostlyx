import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";

export type DashboardWidgetId =
  | "net-profit"
  | "revenue-pulse"
  | "expense-pressure"
  | "revenue-vs-expenses"
  | "bookings"
  | "channels"
  | "recent-bookings"
  | "recent-expenses";

export type DashboardWidgetPresetId =
  | "executive"
  | "finance"
  | "operations"
  | "custom";

export type DashboardWidgetLayoutState = {
  presetId: DashboardWidgetPresetId;
  hiddenIds: DashboardWidgetId[];
  layouts: DashboardGridLayouts;
};

export type DashboardGridLayouts = ResponsiveLayouts;
type DashboardLayoutItem = LayoutItem & { i: DashboardWidgetId };

export type DashboardWidgetCatalogItem = {
  id: DashboardWidgetId;
  title: string;
  subtitle: string;
  minW?: number;
  minH?: number;
};

export const dashboardWidgetLayoutKey = "widget-lab";

export const dashboardWidgetCatalog: DashboardWidgetCatalogItem[] = [
  {
    id: "net-profit",
    title: "Net Profit",
    subtitle: "What the business keeps after payout and expenses.",
    minW: 4,
    minH: 5,
  },
  {
    id: "revenue-pulse",
    title: "Revenue pulse",
    subtitle: "Last 6 months, top-line movement.",
    minW: 3,
    minH: 4,
  },
  {
    id: "expense-pressure",
    title: "Expense pressure",
    subtitle: "Where cost is clustering right now.",
    minW: 4,
    minH: 5,
  },
  {
    id: "revenue-vs-expenses",
    title: "Revenue vs expenses",
    subtitle: "Quick monthly balance read.",
    minW: 4,
    minH: 4,
  },
  {
    id: "bookings",
    title: "Bookings",
    subtitle: "Operational throughput.",
    minW: 3,
    minH: 5,
  },
  {
    id: "channels",
    title: "Channels",
    subtitle: "Who is driving the business.",
    minW: 3,
    minH: 5,
  },
  {
    id: "recent-bookings",
    title: "Recent bookings",
    subtitle: "Latest revenue-producing stays.",
    minW: 5,
    minH: 7,
  },
  {
    id: "recent-expenses",
    title: "Recent expenses",
    subtitle: "Latest money-out activity.",
    minW: 5,
    minH: 7,
  },
];

const widgetIdSet = new Set<DashboardWidgetId>(
  dashboardWidgetCatalog.map((widget) => widget.id),
);

const baseExecutiveLayouts: DashboardGridLayouts = {
  lg: [
    { i: "net-profit", x: 0, y: 0, w: 4, h: 7 },
    { i: "revenue-pulse", x: 4, y: 0, w: 4, h: 4 },
    { i: "expense-pressure", x: 8, y: 0, w: 4, h: 7 },
    { i: "revenue-vs-expenses", x: 4, y: 4, w: 4, h: 3 },
    { i: "bookings", x: 0, y: 7, w: 4, h: 5 },
    { i: "channels", x: 4, y: 7, w: 4, h: 5 },
    { i: "recent-bookings", x: 0, y: 12, w: 7, h: 7 },
    { i: "recent-expenses", x: 7, y: 12, w: 5, h: 7 },
  ],
  md: [
    { i: "net-profit", x: 0, y: 0, w: 6, h: 6 },
    { i: "revenue-pulse", x: 6, y: 0, w: 6, h: 4 },
    { i: "expense-pressure", x: 0, y: 6, w: 6, h: 6 },
    { i: "revenue-vs-expenses", x: 6, y: 4, w: 6, h: 4 },
    { i: "bookings", x: 0, y: 12, w: 6, h: 5 },
    { i: "channels", x: 6, y: 12, w: 6, h: 5 },
    { i: "recent-bookings", x: 0, y: 17, w: 12, h: 7 },
    { i: "recent-expenses", x: 0, y: 24, w: 12, h: 7 },
  ],
  sm: [
    { i: "net-profit", x: 0, y: 0, w: 4, h: 6 },
    { i: "revenue-pulse", x: 0, y: 5, w: 4, h: 4 },
    { i: "expense-pressure", x: 0, y: 9, w: 4, h: 5 },
    { i: "revenue-vs-expenses", x: 0, y: 14, w: 4, h: 4 },
    { i: "bookings", x: 0, y: 18, w: 4, h: 5 },
    { i: "channels", x: 0, y: 23, w: 4, h: 5 },
    { i: "recent-bookings", x: 0, y: 28, w: 4, h: 7 },
    { i: "recent-expenses", x: 0, y: 35, w: 4, h: 7 },
  ],
};

const presetLayouts: Record<Exclude<DashboardWidgetPresetId, "custom">, DashboardGridLayouts> = {
  executive: baseExecutiveLayouts,
  finance: {
    lg: [
      { i: "net-profit", x: 0, y: 0, w: 4, h: 7 },
      { i: "expense-pressure", x: 8, y: 0, w: 4, h: 7 },
      { i: "revenue-vs-expenses", x: 9, y: 0, w: 3, h: 4 },
      { i: "revenue-pulse", x: 9, y: 4, w: 3, h: 4 },
      { i: "channels", x: 0, y: 7, w: 4, h: 5 },
      { i: "bookings", x: 4, y: 7, w: 4, h: 5 },
      { i: "recent-bookings", x: 0, y: 12, w: 7, h: 7 },
      { i: "recent-expenses", x: 7, y: 12, w: 5, h: 7 },
    ],
    md: baseExecutiveLayouts.md,
    sm: baseExecutiveLayouts.sm,
  },
  operations: {
    lg: [
      { i: "recent-bookings", x: 0, y: 0, w: 7, h: 7 },
      { i: "recent-expenses", x: 7, y: 0, w: 5, h: 7 },
      { i: "bookings", x: 0, y: 7, w: 4, h: 5 },
      { i: "channels", x: 4, y: 7, w: 4, h: 5 },
      { i: "net-profit", x: 8, y: 7, w: 4, h: 5 },
      { i: "revenue-pulse", x: 0, y: 12, w: 4, h: 4 },
      { i: "revenue-vs-expenses", x: 4, y: 12, w: 4, h: 4 },
      { i: "expense-pressure", x: 8, y: 12, w: 4, h: 5 },
    ],
    md: baseExecutiveLayouts.md,
    sm: baseExecutiveLayouts.sm,
  },
};

function cloneLayouts(layouts: DashboardGridLayouts): DashboardGridLayouts {
  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, items]) => [
      breakpoint,
      (items ?? []).map((item) => ({ ...item })),
    ]),
  );
}

function withCatalogConstraints(layouts: DashboardGridLayouts): DashboardGridLayouts {
  return Object.fromEntries(
    Object.entries(layouts).map(([breakpoint, items]) => [
      breakpoint,
      (items ?? []).map((item) => {
        const widget = dashboardWidgetCatalog.find(
          (catalogItem) => catalogItem.id === item.i,
        );

        return {
          ...item,
          w: Math.max(item.w, widget?.minW ?? item.minW ?? item.w),
          h: Math.max(item.h, widget?.minH ?? item.minH ?? item.h),
          minW: widget?.minW ?? item.minW,
          minH: widget?.minH ?? item.minH,
        };
      }),
    ]),
  );
}

export function buildPresetWidgetLayout(
  presetId: Exclude<DashboardWidgetPresetId, "custom"> = "executive",
): DashboardWidgetLayoutState {
  return {
    presetId,
    hiddenIds: [],
    layouts: withCatalogConstraints(cloneLayouts(presetLayouts[presetId])),
  };
}

function isValidWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && widgetIdSet.has(value as DashboardWidgetId);
}

function normalizeHiddenIds(hiddenIds: unknown): DashboardWidgetId[] {
  if (!Array.isArray(hiddenIds)) {
    return [];
  }

  return hiddenIds.filter(isValidWidgetId);
}

function normalizeLayoutEntry(entry: unknown): DashboardLayoutItem | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const layoutEntry = entry as LayoutItem;

  if (!isValidWidgetId(layoutEntry.i)) {
    return null;
  }

  return {
    i: layoutEntry.i,
    x: Number.isFinite(layoutEntry.x) ? layoutEntry.x : 0,
    y: Number.isFinite(layoutEntry.y) ? layoutEntry.y : 0,
    w: Number.isFinite(layoutEntry.w) ? layoutEntry.w : 3,
    h: Number.isFinite(layoutEntry.h) ? layoutEntry.h : 3,
    minW: Number.isFinite(layoutEntry.minW) ? layoutEntry.minW : undefined,
    minH: Number.isFinite(layoutEntry.minH) ? layoutEntry.minH : undefined,
  } satisfies DashboardLayoutItem;
}

function normalizeLayouts(rawLayouts: unknown, fallbackPresetId: Exclude<DashboardWidgetPresetId, "custom">) {
  const fallback = buildPresetWidgetLayout(fallbackPresetId).layouts;

  if (!rawLayouts || typeof rawLayouts !== "object") {
    return fallback;
  }

  const typedLayouts = rawLayouts as DashboardGridLayouts;
  const normalized: DashboardGridLayouts = {};

  for (const [breakpoint, fallbackItems] of Object.entries(fallback)) {
    const candidate = typedLayouts[breakpoint];
    const safeFallbackItems = fallbackItems ?? [];

    if (!Array.isArray(candidate)) {
      normalized[breakpoint] = safeFallbackItems.map((item) => ({ ...item }));
      continue;
    }

    const validItems = candidate
      .map(normalizeLayoutEntry)
      .filter((item): item is DashboardLayoutItem => item !== null);

    const existingIds = new Set<DashboardWidgetId>(
      validItems.map((item) => item.i),
    );
    const missingItems = safeFallbackItems
      .filter((item) => !existingIds.has(item.i as DashboardWidgetId))
      .map((item) => ({ ...item }));

    normalized[breakpoint] = [...validItems, ...missingItems];
  }

  return withCatalogConstraints(normalized);
}

export function normalizeWidgetLayoutState(
  rawValue: unknown,
  fallbackPresetId: Exclude<DashboardWidgetPresetId, "custom"> = "executive",
): DashboardWidgetLayoutState {
  if (!rawValue || typeof rawValue !== "object") {
    return buildPresetWidgetLayout(fallbackPresetId);
  }

  const candidate = rawValue as Partial<DashboardWidgetLayoutState>;
  const presetId =
    candidate.presetId === "executive" ||
    candidate.presetId === "finance" ||
    candidate.presetId === "operations" ||
    candidate.presetId === "custom"
      ? candidate.presetId
      : fallbackPresetId;

  const basePresetId = presetId === "custom" ? fallbackPresetId : presetId;

  return {
    presetId,
    hiddenIds: normalizeHiddenIds(candidate.hiddenIds),
    layouts: normalizeLayouts(candidate.layouts, basePresetId),
  };
}

export function mergeUpdatedLayouts(
  currentState: DashboardWidgetLayoutState,
  nextLayouts: DashboardGridLayouts,
): DashboardWidgetLayoutState {
  const mergedLayouts: DashboardGridLayouts = {};

  for (const [breakpoint, currentItems] of Object.entries(currentState.layouts)) {
    const safeCurrentItems = currentItems ?? [];
    const updatedItems = (nextLayouts[breakpoint] ?? []).map(normalizeLayoutEntry).filter(
      (item): item is DashboardLayoutItem => item !== null,
    );
    const updatedIds = new Set(updatedItems.map((item) => item.i));
    const preservedItems = safeCurrentItems.filter(
      (item) => !updatedIds.has(item.i as DashboardWidgetId),
    );

    mergedLayouts[breakpoint] = [...updatedItems, ...preservedItems];
  }

  return {
    presetId: "custom",
    hiddenIds: [...currentState.hiddenIds],
    layouts: normalizeLayouts(mergedLayouts, "executive"),
  };
}
