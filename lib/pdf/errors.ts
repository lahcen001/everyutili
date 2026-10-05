/**
 * Turns a PDF library error into something a user can act on. pdf-lib throws EncryptedPDFError and
 * pdf.js throws PasswordException for password-protected files; both otherwise surface as raw
 * library messages.
 */
export function friendlyPdfError(error: unknown, fallback: string): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "EncryptedPDFError" || name === "PasswordException" || /encrypted|password/i.test(message)) {
    return "This PDF is password-protected. Remove the password first (for example by opening it and re-saving without one), then try again.";
  }
  if (/invalid pdf|failed to parse|no pdf header|bad xref/i.test(message)) {
    return "This file doesn't look like a valid PDF, or it is damaged.";
  }
  return message || fallback;
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
