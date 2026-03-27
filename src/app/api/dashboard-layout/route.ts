import { NextResponse } from "next/server";
import { requireUserEmail } from "@/lib/auth";
import {
  dashboardWidgetLayoutKey,
  normalizeWidgetLayoutState,
} from "@/lib/dashboard-widget-layout";
import { getDashboardLayoutState, upsertDashboardLayoutState } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const layoutState = await getDashboardLayoutState(
      ownerEmail,
      dashboardWidgetLayoutKey,
    );

    return NextResponse.json({
      layoutState: normalizeWidgetLayoutState(layoutState),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The widget layout could not be loaded.",
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const ownerEmail = await requireUserEmail();

    if (!ownerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const layoutState = normalizeWidgetLayoutState(body?.layoutState);

    await upsertDashboardLayoutState({
      ownerEmail,
      layoutKey: dashboardWidgetLayoutKey,
      layoutState,
    });

    return NextResponse.json({
      message: "Widget layout saved.",
      layoutState,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The widget layout could not be saved.",
      },
      { status: 400 },
    );
  }
}
