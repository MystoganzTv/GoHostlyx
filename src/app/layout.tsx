import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import { getRequestLocale } from "@/lib/server-locale";
import "./globals.css";

const defaultSiteUrl = "https://gohostlyx.vercel.app";
const siteUrl = process.env.NEXTAUTH_URL ?? defaultSiteUrl;

// Same family as OnRoad Books: narrow and legible at the small sizes a dense
// financial UI needs.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "GoHostlyx | Short-Term Rental Accounting Dashboard",
  description:
    "Upload short-term rental booking and expense workbooks, normalize the data, and explore revenue, payout, and profitability in one clean dashboard.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "GoHostlyx | Short-Term Rental Accounting Dashboard",
    description:
      "Upload short-term rental booking and expense workbooks, normalize the data, and explore revenue, payout, and profitability in one clean dashboard.",
    url: siteUrl,
    siteName: "GoHostlyx",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GoHostlyx | Short-Term Rental Accounting Dashboard",
    description:
      "Upload short-term rental booking and expense workbooks, normalize the data, and explore revenue, payout, and profitability in one clean dashboard.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={locale}
      className={`${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
