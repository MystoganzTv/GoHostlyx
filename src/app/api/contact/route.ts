import { NextResponse } from "next/server";

type ContactPayload = {
  name?: string;
  email?: string;
  topic?: string;
  workspace?: string;
  message?: string;
  company?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ContactPayload | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.company) {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const topic = body.topic?.trim() ?? "General";
  const workspace = body.workspace?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email, and message are required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (message.length < 10) {
    return NextResponse.json(
      { error: "Add a little more detail so we can help properly." },
      { status: 400 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const contactRecipient = process.env.CONTACT_FORM_TO_EMAIL ?? "hello@hostlyx.com";
  const fromEmail = process.env.CONTACT_FORM_FROM_EMAIL ?? "Hostlyx <onboarding@resend.dev>";

  if (!resendApiKey) {
    return NextResponse.json(
      {
        error:
          "Contact email is not configured yet. Please write directly to hello@hostlyx.com for now.",
      },
      { status: 503 },
    );
  }

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin-bottom: 16px;">New Hostlyx contact request</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
      <p><strong>Workspace:</strong> ${escapeHtml(workspace || "Not provided")}</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  const text = [
    "New Hostlyx contact request",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Topic: ${topic}`,
    `Workspace: ${workspace || "Not provided"}`,
    "",
    message,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [contactRecipient],
      reply_to: email,
      subject: `Hostlyx contact: ${topic}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("Contact form delivery failed", errorText);
    return NextResponse.json(
      {
        error:
          "Hostlyx could not send your message right now. Please try again or email hello@hostlyx.com directly.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
