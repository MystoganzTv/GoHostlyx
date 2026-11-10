// Turns a caught error into a message that is safe to show to users.
// Validation errors we throw ourselves are meant for users and pass through;
// database and other internal errors are logged and replaced by the fallback.
export function clientErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const internal =
    // node-postgres errors carry an SQLSTATE code and a severity.
    ("code" in error && typeof (error as { code?: unknown }).code === "string") ||
    "severity" in error ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|relation .* does not exist|syntax error|violates .* constraint|Unexpected token|Cannot read properties/i.test(
      error.message,
    );

  if (internal) {
    console.error("[api]", error);
    return fallback;
  }

  return error.message;
}
