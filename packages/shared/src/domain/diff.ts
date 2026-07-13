import type { FieldChange } from "../types/case";

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Old→new pairs for the named fields, skipping anything that didn't actually
 * change — an audit trail full of "reviewNote: null → null" is noise, and the
 * point of the log is signal (R10).
 */
export function diffFields<T extends object>(
  before: T,
  after: T,
  fields: readonly (keyof T)[],
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of fields) {
    const oldValue = serialize(before[field]);
    const newValue = serialize(after[field]);
    if (oldValue === newValue) continue;

    changes.push({ field: String(field), oldValue, newValue });
  }

  return changes;
}
