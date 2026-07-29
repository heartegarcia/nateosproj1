import { db } from "./db";
import type { InvoiceSettings, UpdateInvoiceSettingsInput } from "./types";

const SINGLETON_ID = "singleton";

export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  const row = await db
    .prepare("SELECT * FROM invoice_settings WHERE id = ?")
    .get<InvoiceSettings>(SINGLETON_ID);
  if (row) return row;

  await db
    .prepare(
      `INSERT INTO invoice_settings (id, full_name, bank_details, hourly_rate, payment_terms)
       VALUES (?, NULL, NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING`
    )
    .run(SINGLETON_ID);
  return (await db
    .prepare("SELECT * FROM invoice_settings WHERE id = ?")
    .get<InvoiceSettings>(SINGLETON_ID))!;
}

export async function updateInvoiceSettings(input: UpdateInvoiceSettingsInput): Promise<InvoiceSettings> {
  await getInvoiceSettings(); // ensure the row exists

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
    await db.prepare(`UPDATE invoice_settings SET ${fields.join(", ")} WHERE id = @id`).run(params);
  }
  return getInvoiceSettings();
}
