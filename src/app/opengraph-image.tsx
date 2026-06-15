import { ImageResponse } from "next/og";

// Social share image used for both Open Graph and Twitter cards.
export const runtime = "edge";
export const alt = "GoHostlyx — Short-Term Rental Accounting Dashboard";
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
          padding: "72px",
          background:
            "linear-gradient(135deg, #07111c 0%, #091320 45%, #0d1b2c 100%)",
          color: "#e7edf5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(180deg, #6fd4c7 0%, #58c4b6 100%)",
              color: "#061714",
              fontSize: "44px",
              fontWeight: 700,
            }}
          >
            H
          </div>
          <div style={{ fontSize: "34px", fontWeight: 600, color: "#d8fbf5" }}>
            GoHostlyx
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "68px",
              fontWeight: 700,
              lineHeight: 1.05,
              maxWidth: "920px",
              letterSpacing: "-0.02em",
            }}
          >
            How much does your short-term rental actually leave you?
          </div>
          <div style={{ fontSize: "30px", color: "#9aa8bd", maxWidth: "820px" }}>
            Revenue, expenses and taxes turned into one clear number: your real profit.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "9999px",
              background: "#58c4b6",
            }}
          />
          <div style={{ fontSize: "26px", color: "#94a3b8" }}>
            gohostlyx.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
