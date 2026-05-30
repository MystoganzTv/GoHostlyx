import { NextResponse } from "next/server";
import { getAuthUserByEmail, markAuthUserVerified } from "@/lib/db";
import { hashVerificationCode } from "@/lib/email-verification";
import { normalizeAuthEmail } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = normalizeAuthEmail(String(formData.get("email") ?? ""));
    const code = String(formData.get("code") ?? "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
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
