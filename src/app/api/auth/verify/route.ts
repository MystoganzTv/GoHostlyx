import { NextResponse } from "next/server";
import { getAuthUserByEmail, markAuthUserVerified } from "@/lib/db";
import { hashVerificationCode } from "@/lib/email-verification";
import { normalizeAuthEmail } from "@/lib/password";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = normalizeAuthEmail(String(formData.get("email") ?? ""));
    const code = String(formData.get("code") ?? "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    // Throttle code guesses hard: a 6-digit code must not be brute-forceable
    // within its 10-minute lifetime. Limit per email and per IP.
    const ip = getClientIp(request.headers);
    const [byEmail, byIp] = await Promise.all([
      rateLimit({ key: `verify:email:${email}`, limit: 8, windowSec: 600 }),
      rateLimit({ key: `verify:ip:${ip}`, limit: 30, windowSec: 600 }),
    ]);

    if (!byEmail.success || !byIp.success) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429 },
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the 6-digit verification code." },
        { status: 400 },
      );
    }

    const authUser = await getAuthUserByEmail(email);

    if (!authUser) {
      return NextResponse.json(
        { error: "We could not find a pending account for that email." },
        { status: 404 },
      );
    }

    if (authUser.isVerified) {
      return NextResponse.json({
        message: "Your email is already verified. You can sign in now.",
      });
    }

    if (!authUser.verificationCodeHash || !authUser.verificationExpiresAt) {
      return NextResponse.json(
        { error: "This account does not have an active verification code." },
        { status: 400 },
      );
    }

    if (new Date(authUser.verificationExpiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "That verification code has expired. Request a new one." },
        { status: 400 },
      );
    }

    if (authUser.verificationCodeHash !== hashVerificationCode(code)) {
      return NextResponse.json(
        { error: "That verification code is incorrect." },
        { status: 400 },
      );
    }

    await markAuthUserVerified({ email });

    return NextResponse.json({
      message: "Email verified. Signing you in now.",
      verified: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The verification could not be completed.",
      },
      { status: 400 },
    );
  }
}
