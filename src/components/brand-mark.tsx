import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <rect width="48" height="48" rx="14" fill="#162341" />
      <path
        d="M30 13H22a9 9 0 0 0-9 9v3a9 9 0 0 0 9 9h3a9 9 0 0 0 9-9v-1h-9"
        stroke="#fdfdff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M35 10v9m-4.5-4.5h9" stroke="#a8bfff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
