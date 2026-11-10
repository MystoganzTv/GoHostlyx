import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

export const runtime = "edge";
export const alt = "GoHostlyx — See what your rentals earn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 84px",
          background: "#f6f7fb",
          color: "#131b32",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 700 }}>
          <BrandMark width={64} height={64} />
          GoHostlyx
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.045em", maxWidth: 880, lineHeight: 1.02 }}>
            See what your rentals earn.
          </div>
          <div style={{ fontSize: 31, color: "#4f5a72" }}>
            Bookings, expenses and profit in one place.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, color: "#2449c5" }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#4669e2" }} />
          FINANCES FOR SHORT-TERM RENTALS
        </div>
      </div>
    ),
    size,
  );
}
