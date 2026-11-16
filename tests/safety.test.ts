import { describe, expect, it, vi } from "vitest";
import { isAdminOwnerEmail } from "@/lib/admin";
import { clientErrorMessage } from "@/lib/client-error";

describe("owner account", () => {
  it("is always an admin, regardless of case or spacing", () => {
    expect(isAdminOwnerEmail("enrique.padron853@gmail.com")).toBe(true);
    expect(isAdminOwnerEmail("  Enrique.Padron853@Gmail.com ")).toBe(true);
  });

  it("does not make other accounts admins", () => {
    expect(isAdminOwnerEmail("someone@example.com")).toBe(false);
    expect(isAdminOwnerEmail("")).toBe(false);
    expect(isAdminOwnerEmail(null)).toBe(false);
  });
});

describe("clientErrorMessage", () => {
  it("passes validation messages through", () => {
    expect(clientErrorMessage(new Error("Enter a valid check-in date."), "fallback")).toBe("Enter a valid check-in date.");
  });

  it("hides database errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dbError = Object.assign(new Error('duplicate key value violates unique constraint "x"'), { code: "23505" });
    expect(clientErrorMessage(dbError, "Could not save.")).toBe("Could not save.");
    expect(clientErrorMessage(new Error("connect ECONNREFUSED 10.0.0.1:5432"), "Could not save.")).toBe("Could not save.");
    spy.mockRestore();
  });

  it("uses the fallback for non-errors", () => {
    expect(clientErrorMessage("boom", "Could not save.")).toBe("Could not save.");
  });
});
