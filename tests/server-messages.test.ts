import { describe, expect, it } from "vitest";
import { localizeMessage } from "@/lib/server-messages";

describe("localizeMessage", () => {
  it("leaves English untouched", () => {
    expect(localizeMessage("That property already exists.", "en")).toBe("That property already exists.");
  });

  it("translates exact and templated messages to Spanish", () => {
    expect(localizeMessage("That property already exists.", "es")).toBe("Esa propiedad ya existe.");
    expect(localizeMessage('Property renamed to "Ocean Villa".', "es")).toBe('Propiedad renombrada a "Ocean Villa".');
    expect(localizeMessage("Imported 12 bookings and 3 expenses into Ocean Villa.", "es")).toBe(
      "Se importaron 12 reservas y 3 gastos en Ocean Villa.",
    );
    expect(localizeMessage("Synced 1 event just now.", "es")).toBe("1 evento sincronizado ahora mismo.");
  });

  it("falls back to the original text when there is no translation", () => {
    expect(localizeMessage("Something new.", "es")).toBe("Something new.");
  });
});
