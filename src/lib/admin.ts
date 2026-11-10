// Admin accounts come from the ADMIN_EMAILS environment variable
// (comma-separated). Nothing is hard-coded so the repository stays free of
// personal data.
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminOwnerEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized) && adminEmails.includes(normalized as string);
}
