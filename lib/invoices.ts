import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "./db";
import { listBusinesses } from "./businesses";
import { saveAttachmentFromBuffer } from "./attachments";
import { createTask } from "./tasks";
import { listEntries, markEntriesBilled } from "./timeEntries";
import { getInvoiceSettings } from "./invoiceSettings";
import { InvoicePdf } from "./pdf/InvoicePdf";
import type { Invoice } from "./types";

const storageRoot = path.join(process.cwd(), "data", "invoices");

export function listInvoices(): Invoice[] {
  return db.prepare("SELECT * FROM invoices ORDER BY invoice_number DESC").all() as Invoice[];
}

export function getInvoiceById(id: string): Invoice | null {
  return (db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as Invoice | undefined) ?? null;
}

export function resolveInvoicePdfPath(invoice: Invoice): string | null {
  if (!invoice.pdf_storage_path) return null;
  return path.join(storageRoot, invoice.pdf_storage_path);
}

function getDefaultApprovalBusinessId(): string {
  const businesses = listBusinesses();
  const preferred = businesses.find((b) => b.name === "Personal / Executive Support");
  return (preferred ?? businesses[0]).id;
}

export class NoUnbilledHoursError extends Error {
  constructor() {
    super("No unbilled, completed hours found for this period.");
  }
}

export async function generateInvoice(periodStart: string | null, periodEnd: string | null): Promise<Invoice> {
  const candidates = listEntries({
    unbilledOnly: true,
    from: periodStart ?? undefined,
    to: periodEnd ?? undefined,
  }).filter((e) => e.end_time !== null);

  if (candidates.length === 0) throw new NoUnbilledHoursError();

  const totalHours = candidates.reduce((sum, e) => sum + e.hours, 0);
  const settings = getInvoiceSettings();
  const hourlyRate = settings.hourly_rate ?? 0;
  const totalAmount = totalHours * hourlyRate;

  const dates = candidates.map((e) => e.work_date).sort();
  const actualPeriodStart = periodStart ?? dates[0];
  const actualPeriodEnd = periodEnd ?? dates[dates.length - 1];

  const maxNumber = db.prepare("SELECT COALESCE(MAX(invoice_number), 0) as m FROM invoices").get() as { m: number };
  const invoiceNumber = maxNumber.m + 1;

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO invoices (id, invoice_number, period_start, period_end, total_hours, hourly_rate, total_amount, status, created_at)
     VALUES (@id, @invoiceNumber, @periodStart, @periodEnd, @totalHours, @hourlyRate, @totalAmount, 'draft', @now)`
  ).run({
    id,
    invoiceNumber,
    periodStart: actualPeriodStart,
    periodEnd: actualPeriodEnd,
    totalHours,
    hourlyRate,
    totalAmount,
    now,
  });

  markEntriesBilled(
    candidates.map((e) => e.id),
    id
  );

  fs.mkdirSync(storageRoot, { recursive: true });
  const pdfBuffer = await renderToBuffer(
    InvoicePdf({
      invoiceNumber,
      periodStart: actualPeriodStart,
      periodEnd: actualPeriodEnd,
      entries: candidates,
      hourlyRate,
      totalHours,
      totalAmount,
      settings,
      createdAt: now,
    })
  );
  const pdfFileName = `invoice-${invoiceNumber}.pdf`;
  fs.writeFileSync(path.join(storageRoot, pdfFileName), pdfBuffer);
  db.prepare("UPDATE invoices SET pdf_storage_path = ? WHERE id = ?").run(pdfFileName, id);

  const task = createTask({
    title: `Approve & pay Invoice #${invoiceNumber} — ${actualPeriodStart} to ${actualPeriodEnd}`,
    businessId: getDefaultApprovalBusinessId(),
    assignee: "nate",
    basePriority: "medium",
    notes: `Total: $${totalAmount.toFixed(2)} for ${totalHours.toFixed(2)} hours. Invoice attached below.`,
  });
  db.prepare("UPDATE invoices SET approval_task_id = ? WHERE id = ?").run(task.id, id);
  saveAttachmentFromBuffer(task.id, "Invoices", pdfFileName, pdfBuffer);

  return getInvoiceById(id)!;
}

export function markInvoicePaid(id: string): Invoice | null {
  db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(id);
  return getInvoiceById(id);
}
