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

export async function listInvoices(): Promise<Invoice[]> {
  return db.prepare("SELECT * FROM invoices ORDER BY invoice_number DESC").all<Invoice>();
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  return (await db.prepare("SELECT * FROM invoices WHERE id = ?").get<Invoice>(id)) ?? null;
}

export function resolveInvoicePdfPath(invoice: Invoice): string | null {
  if (!invoice.pdf_storage_path) return null;
  return path.join(storageRoot, invoice.pdf_storage_path);
}

async function getDefaultApprovalBusinessId(): Promise<string> {
  const businesses = await listBusinesses();
  const preferred = businesses.find((b) => b.name === "Personal / Executive Support");
  return (preferred ?? businesses[0]).id;
}

export class NoUnbilledHoursError extends Error {
  constructor() {
    super("No unbilled, completed hours found for this period.");
  }
}

export async function generateInvoice(periodStart: string | null, periodEnd: string | null): Promise<Invoice> {
  const candidates = (
    await listEntries({
      unbilledOnly: true,
      from: periodStart ?? undefined,
      to: periodEnd ?? undefined,
    })
  ).filter((e) => e.end_time !== null);

  if (candidates.length === 0) throw new NoUnbilledHoursError();

  const totalHours = candidates.reduce((sum, e) => sum + e.hours, 0);
  const settings = await getInvoiceSettings();
  const hourlyRate = settings.hourly_rate ?? 0;
  const totalAmount = totalHours * hourlyRate;

  const dates = candidates.map((e) => e.work_date).sort();
  const actualPeriodStart = periodStart ?? dates[0];
  const actualPeriodEnd = periodEnd ?? dates[dates.length - 1];

  // ::int cast — Postgres returns MAX()/COUNT() over integers as bigint, which the
  // driver would otherwise hand back as a string.
  const maxNumber = await db
    .prepare("SELECT COALESCE(MAX(invoice_number), 0)::int as m FROM invoices")
    .get<{ m: number }>();
  const invoiceNumber = (maxNumber?.m ?? 0) + 1;

  const id = randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO invoices (id, invoice_number, period_start, period_end, total_hours, hourly_rate, total_amount, status, created_at)
       VALUES (@id, @invoiceNumber, @periodStart, @periodEnd, @totalHours, @hourlyRate, @totalAmount, 'draft', @now)`
    )
    .run({
      id,
      invoiceNumber,
      periodStart: actualPeriodStart,
      periodEnd: actualPeriodEnd,
      totalHours,
      hourlyRate,
      totalAmount,
      now,
    });

  await markEntriesBilled(
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
  await db.prepare("UPDATE invoices SET pdf_storage_path = ? WHERE id = ?").run(pdfFileName, id);

  const businessId = await getDefaultApprovalBusinessId();
  const task = await createTask({
    title: `Approve & pay Invoice #${invoiceNumber} — ${actualPeriodStart} to ${actualPeriodEnd}`,
    businessId,
    assignee: "nate",
    basePriority: "medium",
    notes: `Total: $${totalAmount.toFixed(2)} for ${totalHours.toFixed(2)} hours. Invoice attached below.`,
  });
  await db.prepare("UPDATE invoices SET approval_task_id = ? WHERE id = ?").run(task.id, id);
  await saveAttachmentFromBuffer(task.id, "Invoices", pdfFileName, pdfBuffer);

  return (await getInvoiceById(id))!;
}

export async function markInvoicePaid(id: string): Promise<Invoice | null> {
  await db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(id);
  return getInvoiceById(id);
}
