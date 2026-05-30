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
              d="M14 30L32 16L50 30"
              stroke="rgba(216,251,245,0.96)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19 29V45C19 47.2 20.8 49 23 49H41C43.2 49 45 47.2 45 45V29"
              stroke="rgba(88,196,182,0.98)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M27 49V39C27 37.3 28.3 36 30 36H34C35.7 36 37 37.3 37 39V49"
              stroke="rgba(216,251,245,0.9)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M32 24L36 28L32 32L28 28L32 24Z"
              stroke="rgba(216,251,245,0.9)"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path
              d="M47 15L48.1 18.1L51.2 19.2L48.1 20.3L47 23.4L45.9 20.3L42.8 19.2L45.9 18.1L47 15Z"
              fill="rgba(216,251,245,0.96)"
            />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
