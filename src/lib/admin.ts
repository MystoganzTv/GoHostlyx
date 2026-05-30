export const adminOwnerEmail = "enrique.padron853@gmail.com";

export function isAdminOwnerEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === adminOwnerEmail;
}
