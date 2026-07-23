import { db } from "./db";
import type { InvoiceSettings, UpdateInvoiceSettingsInput } from "./types";

const SINGLETON_ID = "singleton";

export function getInvoiceSettings(): InvoiceSettings {
  const row = db.prepare("SELECT * FROM invoice_settings WHERE id = ?").get(SINGLETON_ID) as InvoiceSettings | undefined;
  if (row) return row;
  db.prepare(
    "INSERT INTO invoice_settings (id, full_name, bank_details, hourly_rate, payment_terms) VALUES (?, NULL, NULL, NULL, NULL)"
  ).run(SINGLETON_ID);
  return db.prepare("SELECT * FROM invoice_settings WHERE id = ?").get(SINGLETON_ID) as InvoiceSettings;
}

export function updateInvoiceSettings(input: UpdateInvoiceSettingsInput): InvoiceSettings {
  getInvoiceSettings(); // ensure the row exists

  const fields: string[] = [];
  const params: Record<string, unknown> = { id: SINGLETON_ID };
  const map: Record<string, unknown> = {
    full_name: input.fullName,
    bank_details: input.bankDetails,
    hourly_rate: input.hourlyRate,
    payment_terms: input.paymentTerms,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = @${col}`);
      params[col] = val;
    }
  }
  if (fields.length > 0) {
    db.prepare(`UPDATE invoice_settings SET ${fields.join(", ")} WHERE id = @id`).run(params);
  }
  return getInvoiceSettings();
}
