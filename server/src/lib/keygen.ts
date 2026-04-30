import { v4 as uuidv4 } from "uuid";

/**
 * Generates a license key in the format: XXXX-XXXX-XXXX-XXXX-XXXX
 * Each segment is 4 uppercase alphanumeric chars.
 */
export function generateLicenseKey(): string {
  const raw = uuidv4().replace(/-/g, "").toUpperCase();
  // Split into 5 groups of 4 → XX-XXXX-XXXX-XXXX-XXXX
  const segments = [];
  for (let i = 0; i < 20; i += 4) {
    segments.push(raw.slice(i, i + 4));
  }
  return segments.join("-");
}
