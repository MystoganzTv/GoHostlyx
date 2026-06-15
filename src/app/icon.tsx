import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at top, rgba(255,255,255,0.12), transparent 42%), linear-gradient(180deg, #132236 0%, #08111d 100%)",
          borderRadius: 18,
          border: "1px solid rgba(88,196,182,0.32)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            height: 46,
            borderRadius: 16,
            background:
              "linear-gradient(180deg, rgba(88,196,182,0.24) 0%, rgba(8,17,29,0.18) 100%)",
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 64 64"
            fill="none"
          >
            <path
              d="M13 30L32 15L51 30"
              stroke="rgba(216,251,245,0.96)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18 30V46C18 48.2 19.8 50 22 50H42C44.2 50 46 48.2 46 46V30"
              stroke="rgba(216,251,245,0.9)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="23" y="40" width="5" height="8" rx="1.6" fill="rgba(88,196,182,0.98)" />
            <rect x="29.5" y="36" width="5" height="12" rx="1.6" fill="rgba(88,196,182,0.98)" />
            <rect x="36" y="31.5" width="5" height="16.5" rx="1.6" fill="rgba(216,251,245,0.96)" />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
