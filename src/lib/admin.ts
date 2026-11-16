// The owner account is always an admin with a permanent Pro plan, regardless of
// environment configuration. ADMIN_EMAILS (comma-separated) can add more admins.
export const ownerEmail = "enrique.padron853@gmail.com";

const adminEmails = new Set(
  [ownerEmail, ...(process.env.ADMIN_EMAILS ?? "").split(",")]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminOwnerEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized) && adminEmails.has(normalized as string);
}
