"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { X } from "lucide-react";
import { fetchInvoiceEntries, markInvoicePaidClient } from "@/lib/client/api";
import type { Invoice, InvoiceSettings, TimeEntry } from "@/lib/types";

export function InvoiceReceipt({
  invoice,
  settings,
  isAdmin,
  onClose,
  onMarkedPaid,
}: {
  invoice: Invoice;
  settings: InvoiceSettings;
  isAdmin: boolean;
  onClose: () => void;
  onMarkedPaid: (invoice: Invoice) => Promise<void>;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { entries } = await fetchInvoiceEntries(invoice.id);
      if (!cancelled) {
        setEntries(entries);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  async function handleMarkPaid() {
    setMarking(true);
    try {
      const { invoice: updated } = await markInvoicePaidClient(invoice.id);
      await onMarkedPaid(updated);
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-500">Invoice</h2>
          <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Invoice</p>
              <p className="text-2xl font-semibold text-zinc-900">#{invoice.invoice_number}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                invoice.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {invoice.status}
            </span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-4 border-y border-dashed border-zinc-200 py-4 text-sm">
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-zinc-400">From</p>
              <p className="font-medium text-zinc-900">{settings.full_name || "—"}</p>
              <p className="whitespace-pre-line text-xs text-zinc-500">{settings.bank_details || "—"}</p>
            </div>
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-zinc-400">Period</p>
              <p className="text-zinc-900">
                {format(parseISO(invoice.period_start), "MMM d")} – {format(parseISO(invoice.period_end), "MMM d, yyyy")}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="mb-5 text-xs text-zinc-400">Loading entries…</p>
          ) : (
            <div className="mb-5">
              <div className="flex justify-between border-b border-zinc-100 pb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <span>Date</span>
                <span>Hours</span>
              </div>
              {entries.map((e) => (
                <div key={e.id} className="flex justify-between border-b border-zinc-50 py-1.5 text-sm">
                  <span className="text-zinc-700">{format(parseISO(e.work_date), "MMM d, yyyy")}</span>
                  <span className="tabular-nums text-zinc-700">{e.hours.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1 rounded-xl bg-zinc-50 p-4 text-sm">
            <div className="flex justify-between text-zinc-500">
              <span>Hours worked (period cutoff)</span>
              <span className="tabular-nums">{invoice.total_hours.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Rate</span>
              <span className="tabular-nums">${invoice.hourly_rate.toFixed(2)}/hr</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-zinc-200 pt-2 text-xs text-zinc-400">
              <span>
                {invoice.total_hours.toFixed(2)} hrs × ${invoice.hourly_rate.toFixed(2)}/hr
              </span>
              <span className="tabular-nums">${invoice.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-900">
              <span>Total due</span>
              <span className="tabular-nums">${invoice.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {settings.payment_terms && <p className="mt-4 text-xs text-zinc-400">{settings.payment_terms}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100">
            Close
          </button>
          {isAdmin && invoice.status !== "paid" && (
            <button
              onClick={handleMarkPaid}
              disabled={marking}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {marking ? "Marking…" : "Mark paid"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
