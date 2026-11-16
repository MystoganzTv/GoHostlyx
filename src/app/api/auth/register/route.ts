import { clientErrorMessage } from "@/lib/client-error";
import { localizedJson } from "@/lib/server-messages";
import { getAuthUserByEmail, upsertPendingAuthUser } from "@/lib/db";
import { isEmailAllowed } from "@/lib/auth";
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
  sendVerificationEmail,
} from "@/lib/email-verification";
import { hashPassword, isValidPassword, normalizeAuthEmail } from "@/lib/password";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request.headers);
    const limit = await rateLimit({ key: `register:ip:${ip}`, limit: 5, windowSec: 3600 });

    if (!limit.success) {
      return await localizedJson(
        { error: "Too many sign-up attempts. Please try again later." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = normalizeAuthEmail(String(formData.get("email") ?? ""));
    const password = String(formData.get("password") ?? "");

    if (!fullName) {
      return await localizedJson(
        { error: "Enter your full name to create the account." },
        { status: 400 },
      );
    }

    if (!email || !email.includes("@")) {
      return await localizedJson(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (!isValidPassword(password)) {
      return await localizedJson(
        { error: "Use a password with at least 8 characters." },
        { status: 400 },
      );
    }

    if (!isEmailAllowed(email)) {
      return await localizedJson(
        { error: "This email is not approved for this GoHostlyx workspace." },
        { status: 403 },
      );
    }

    const existingUser = await getAuthUserByEmail(email);

    if (existingUser?.isVerified) {
      return await localizedJson(
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

    return await localizedJson({
      message: "We sent a verification code to your email. Enter it to finish creating your account.",
      requiresVerification: true,
    });
  } catch (error) {
    return await localizedJson(
      {
        error:
          clientErrorMessage(error, "The account could not be created."),
      },
      { status: 400 },
    );
  }
}
