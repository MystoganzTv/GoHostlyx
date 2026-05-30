import { createHash, randomInt } from "node:crypto";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function generateVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashVerificationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function getVerificationExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

export async function sendVerificationEmail({
  email,
  fullName,
  code,
}: {
  email: string;
  fullName: string;
  code: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.AUTH_VERIFICATION_FROM_EMAIL ?? "Hostlyx <onboarding@resend.dev>";

  if (!resendApiKey) {
    throw new Error(
      "Email verification is not configured yet. Add RESEND_API_KEY to enable account sign-up.",
    );
  }

  const safeName = escapeHtml(fullName || email);
  const safeCode = escapeHtml(code);

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6; background: #f8fafc; padding: 32px 16px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden;">
        <div style="padding: 28px 32px; background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%); border-bottom: 1px solid #e2e8f0;">
          <h1 style="margin: 0; font-size: 38px; line-height: 1.1; font-weight: 600; text-align: center;">Verify your email</h1>
        </div>
        <div style="padding: 32px;">
          <p style="margin-top: 0; font-size: 18px; font-weight: 500;">Hey ${safeName},</p>
          <p style="font-size: 18px; margin-bottom: 24px;">
            Welcome to Hostlyx. Please verify your email address to complete your registration.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px; text-align: center;">
            <p style="margin: 0; font-size: 18px;">Your verification code</p>
            <p style="margin: 18px 0 0; font-size: 52px; letter-spacing: 10px; color: #f97316; font-weight: 600;">${safeCode}</p>
          </div>
          <p style="margin: 28px 0 0; font-size: 17px;">
            This code will expire in <strong>10 minutes</strong>, so be sure to use it soon.
          </p>
          <p style="margin: 28px 0 0; font-size: 17px;">See you there,<br />The Hostlyx team</p>
        </div>
      </div>
    </div>
  `;

  const text = [
    "Verify your email",
    "",
    `Hey ${fullName || email},`,
    "",
    "Welcome to Hostlyx. Please verify your email address to complete your registration.",
    "",
    `Your verification code: ${code}`,
    "",
    "This code expires in 10 minutes.",
    "",
    "The Hostlyx team",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: "Verify your Hostlyx email",
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("Verification email failed", errorText);
    throw new Error("Hostlyx could not send the verification email right now.");
  }
}
