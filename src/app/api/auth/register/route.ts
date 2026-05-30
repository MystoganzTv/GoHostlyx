import { NextResponse } from "next/server";
import { getAuthUserByEmail, upsertPendingAuthUser } from "@/lib/db";
import { isEmailAllowed } from "@/lib/auth";
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
  sendVerificationEmail,
} from "@/lib/email-verification";
import { hashPassword, isValidPassword, normalizeAuthEmail } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = normalizeAuthEmail(String(formData.get("email") ?? ""));
    const password = String(formData.get("password") ?? "");

    if (!fullName) {
      return NextResponse.json(
        { error: "Enter your full name to create the account." },
        { status: 400 },
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: "Use a password with at least 8 characters." },
        { status: 400 },
      );
    }

    if (!isEmailAllowed(email)) {
      return NextResponse.json(
        { error: "This email is not approved for this Hostlyx workspace." },
        { status: 403 },
      );
    }

    const existingUser = await getAuthUserByEmail(email);

    if (existingUser?.isVerified) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = getVerificationExpiry();

    await upsertPendingAuthUser({
      email,
      fullName,
      passwordHash: hashPassword(password),
      verificationCodeHash: hashVerificationCode(verificationCode),
      verificationExpiresAt,
    });
    await sendVerificationEmail({
      email,
      fullName,
      code: verificationCode,
    });

    return NextResponse.json({
      message: "We sent a verification code to your email. Enter it to finish creating your account.",
      requiresVerification: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The account could not be created.",
      },
      { status: 400 },
    );
  }
}
