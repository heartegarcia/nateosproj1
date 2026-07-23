"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Play, Settings2, Square, Trash2, X } from "lucide-react";
import {
  clockInClient,
  clockOutClient,
  createTimeEntryClient,
  deleteTimeEntryClient,
  fetchInvoiceSettings,
  fetchInvoices,
  fetchRunningEntry,
  fetchTimeEntries,
  generateInvoiceClient,
  updateInvoiceSettingsClient,
  updateTimeEntryClient,
} from "@/lib/client/api";
import { pacificDateISO, pacificTimeHM } from "@/lib/client/pacificTime";
import { getCurrentPeriod, listRecentPeriods } from "@/lib/payPeriods";
import { InvoiceReceipt } from "@/components/InvoiceReceipt";
import type { Invoice, InvoiceSettings, Role, TimeEntry } from "@/lib/types";

function fmtHM(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, "h:mm a");
}

export function TimesheetClient({ role }: { role: Role }) {
  const today = pacificDateISO();
  const isAdmin = role === "admin";

  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  async function refresh() {
    const [runningRes, entriesRes, invoicesRes, settingsRes] = await Promise.all([
      fetchRunningEntry(),
      fetchTimeEntries(),
      fetchInvoices(),
      fetchInvoiceSettings(),
    ]);
    setRunning(runningRes.entry);
    setEntries(entriesRes.entries);
    setInvoices(invoicesRes.invoices);
    setSettings(settingsRes.settings);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [running]);

  const period = getCurrentPeriod(today);

  const hoursToday = useMemo(() => entries.filter((e) => e.work_date === today).reduce((s, e) => s + e.hours, 0), [
    entries,
    today,
  ]);
  const hoursThisPeriod = useMemo(
    () => entries.filter((e) => e.work_date >= period.start && e.work_date <= period.end).reduce((s, e) => s + e.hours, 0),
    [entries, period]
  );
  const unbilledEntries = useMemo(() => entries.filter((e) => !e.invoice_id && e.end_time), [entries]);
  const hoursSinceLastInvoice = useMemo(() => unbilledEntries.reduce((s, e) => s + e.hours, 0), [unbilledEntries]);
  const rate = settings?.hourly_rate ?? 0;
  const unbilledTotal = hoursSinceLastInvoice * rate;

  async function handleClockIn() {
    await clockInClient(pacificDateISO(), pacificTimeHM());
    await refresh();
  }

  async function handleClockOut() {
    await clockOutClient(pacificTimeHM());
    await refresh();
  }

  async function handleDeleteEntry(id: string) {
    await deleteTimeEntryClient(id);
    await refresh();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Genie&rsquo;s Timesheet</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Current pay period: {format(parseISO(period.start), "MMM d")} – {format(parseISO(period.end), "MMM d, yyyy")}{" "}
            <span className="text-zinc-300">(PST/PDT)</span>
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-300"
            >
              <Settings2 size={14} /> Settings
            </button>
            {running ? (
              <button
                onClick={handleClockOut}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Square size={14} /> Time out
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                <Play size={14} /> Time in
              </button>
            )}
          </div>
        )}
      </div>

      {running && (
        <p className="mb-4 text-xs font-medium text-emerald-600">
          Clocked in since {fmtHM(running.start_time)} PT ({(() => {
            void tick;
            const hrs = computeElapsedHours(running.start_time);
            return `${hrs.toFixed(1)}h so far`;
          })()}
          )
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Hours today" value={hoursToday.toFixed(1)} />
        <Tile label="Hours this period" value={hoursThisPeriod.toFixed(1)} />
        <Tile label="Since last invoice" value={hoursSinceLastInvoice.toFixed(1)} />
        <Tile label="Unbilled total" value={`$${unbilledTotal.toFixed(2)}`} accent />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : (
        <>
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Time entries</p>
              {isAdmin && (
                <button
                  onClick={() => setAddingEntry(true)}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
                >
                  + Add manual entry
                </button>
              )}
            </div>
            <EntriesTable entries={entries.slice(0, 30)} isAdmin={isAdmin} onDelete={handleDeleteEntry} onChanged={refresh} />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Invoices</p>
              {isAdmin && (
                <button
                  onClick={() => setInvoiceModalOpen(true)}
                  disabled={unbilledEntries.length === 0}
                  className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Generate invoice
                </button>
              )}
            </div>
            <InvoicesTable invoices={invoices} onView={setViewingInvoice} />
          </div>
        </>
      )}

      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(s) => {
            setSettings(s);
            setSettingsOpen(false);
          }}
        />
      )}

      {addingEntry && (
        <AddEntryModal
          today={today}
          onClose={() => setAddingEntry(false)}
          onCreated={async () => {
            setAddingEntry(false);
            await refresh();
          }}
        />
      )}

      {invoiceModalOpen && (
        <GenerateInvoiceModal
          today={today}
          unbilledEntries={unbilledEntries}
          rate={rate}
          onClose={() => setInvoiceModalOpen(false)}
          onGenerated={async () => {
            setInvoiceModalOpen(false);
            await refresh();
          }}
        />
      )}

      {viewingInvoice && settings && (
        <InvoiceReceipt
          invoice={viewingInvoice}
          settings={settings}
          isAdmin={isAdmin}
          onClose={() => setViewingInvoice(null)}
          onMarkedPaid={async (updated) => {
            setViewingInvoice(updated);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function computeElapsedHours(startTime: string): number {
  const now = pacificTimeHM();
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = now.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return Math.max(0, minutes) / 60;
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className={`text-2xl font-semibold tabular-nums ${accent ? "text-emerald-600" : "text-zinc-900"}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-zinc-500">{label}</div>
    </div>
  );
}

function EntriesTable({
  entries,
  isAdmin,
  onDelete,
  onChanged,
}: {
  entries: TimeEntry[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
        No time entries yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50">
            <th className="border border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-500">Date</th>
            <th className="border border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-500">Start</th>
            <th className="border border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-500">End</th>
            <th className="border border-zinc-200 px-3 py-2 text-right text-xs font-semibold text-zinc-500">Hours</th>
            {isAdmin && <th className="border border-zinc-200 px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) =>
            editingId === e.id ? (
              <EditEntryRow
                key={e.id}
                entry={e}
                onCancel={() => setEditingId(null)}
                onSaved={async () => {
                  setEditingId(null);
                  await onChanged();
                }}
              />
            ) : (
              <tr key={e.id} className={e.end_time ? "" : "bg-emerald-50/50"}>
                <td className="border border-zinc-200 px-3 py-2">{format(parseISO(e.work_date), "MMM d, yyyy")}</td>
                <td className="border border-zinc-200 px-3 py-2">{fmtHM(e.start_time)}</td>
                <td className="border border-zinc-200 px-3 py-2">{e.end_time ? fmtHM(e.end_time) : "Running…"}</td>
                <td className="border border-zinc-200 px-3 py-2 text-right tabular-nums">{e.hours.toFixed(2)}</td>
                {isAdmin && (
                  <td className="border border-zinc-200 px-3 py-2">
                    {!e.invoice_id && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingId(e.id)} className="text-xs text-zinc-400 hover:text-zinc-700">
                          Edit
                        </button>
                        <button onClick={() => onDelete(e.id)} className="text-zinc-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditEntryRow({ entry, onCancel, onSaved }: { entry: TimeEntry; onCancel: () => void; onSaved: () => void }) {
  const [workDate, setWorkDate] = useState(entry.work_date);
  const [startTime, setStartTime] = useState(entry.start_time);
  const [endTime, setEndTime] = useState(entry.end_time ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateTimeEntryClient(entry.id, { workDate, startTime, endTime: endTime || null });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td className="border border-zinc-200 px-2 py-1.5">
        <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className="input-select text-xs" />
      </td>
      <td className="border border-zinc-200 px-2 py-1.5">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-select text-xs" />
      </td>
      <td className="border border-zinc-200 px-2 py-1.5">
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-select text-xs" />
      </td>
      <td className="border border-zinc-200 px-2 py-1.5" colSpan={2}>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            Save
          </button>
          <button onClick={onCancel} className="text-xs text-zinc-400 hover:text-zinc-700">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddEntryModal({ today, onClose, onCreated }: { today: string; onClose: () => void; onCreated: () => void }) {
  const [workDate, setWorkDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createTimeEntryClient({ workDate, startTime, endTime });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-24" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Add manual entry</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className="input-select" />
          <span />
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-select" />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-select" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add entry"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InvoicesTable({ invoices, onView }: { invoices: Invoice[]; onView: (invoice: Invoice) => void }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-10 text-center text-sm text-zinc-400">
        No invoices yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <ul className="divide-y divide-zinc-100">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">Invoice #{inv.invoice_number}</p>
              <p className="text-xs text-zinc-400">
                {format(parseISO(inv.period_start), "MMM d")} – {format(parseISO(inv.period_end), "MMM d, yyyy")} ·{" "}
                {inv.total_hours.toFixed(2)}h · ${inv.total_amount.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {inv.status}
              </span>
              <button onClick={() => onView(inv)} className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
                View invoice
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GenerateInvoiceModal({
  today,
  unbilledEntries,
  rate,
  onClose,
  onGenerated,
}: {
  today: string;
  unbilledEntries: TimeEntry[];
  rate: number;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const periods = useMemo(() => listRecentPeriods(today, 6), [today]);
  const [mode, setMode] = useState<"all" | "period">("all");
  const [periodIndex, setPeriodIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosenPeriod = mode === "period" ? periods[periodIndex] : null;
  const previewEntries = chosenPeriod
    ? unbilledEntries.filter((e) => e.work_date >= chosenPeriod.start && e.work_date <= chosenPeriod.end)
    : unbilledEntries;
  const previewHours = previewEntries.reduce((s, e) => s + e.hours, 0);
  const previewAmount = previewHours * rate;

  async function handleGenerate() {
    setError(null);
    setSaving(true);
    try {
      await generateInvoiceClient(chosenPeriod?.start ?? null, chosenPeriod?.end ?? null);
      onGenerated();
    } catch {
      setError("Couldn't generate the invoice. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Generate invoice</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 flex rounded-lg border border-zinc-200 p-0.5">
          <button
            onClick={() => setMode("all")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === "all" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            All unbilled hours
          </button>
          <button
            onClick={() => setMode("period")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
              mode === "period" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"
            }`}
          >
            Specific period
          </button>
        </div>

        {mode === "period" && (
          <select
            value={periodIndex}
            onChange={(e) => setPeriodIndex(Number(e.target.value))}
            className="input-select mb-3"
          >
            {periods.map((p, i) => (
              <option key={p.start} value={i}>
                {format(parseISO(p.start), "MMM d")} – {format(parseISO(p.end), "MMM d, yyyy")}
              </option>
            ))}
          </select>
        )}

        <div className="mb-4 space-y-1 rounded-lg bg-zinc-50 p-3 text-sm">
          <p>{previewEntries.length} entries</p>
          <p>{previewHours.toFixed(2)} hours (period cutoff)</p>
          <p className="text-xs text-zinc-400">
            {previewHours.toFixed(2)} hrs × ${rate.toFixed(2)}/hr
          </p>
          <p className="font-semibold">${previewAmount.toFixed(2)} total</p>
        </div>

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={saving || previewEntries.length === 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  settings,
  onClose,
  onSaved,
}: {
  settings: InvoiceSettings;
  onClose: () => void;
  onSaved: (settings: InvoiceSettings) => void;
}) {
  const [fullName, setFullName] = useState(settings.full_name ?? "");
  const [bankDetails, setBankDetails] = useState(settings.bank_details ?? "");
  const [hourlyRate, setHourlyRate] = useState(String(settings.hourly_rate ?? ""));
  const [paymentTerms, setPaymentTerms] = useState(settings.payment_terms ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const { settings: updated } = await updateInvoiceSettingsClient({
        fullName,
        bankDetails,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        paymentTerms,
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Invoice settings</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <textarea
            value={bankDetails}
            onChange={(e) => setBankDetails(e.target.value)}
            placeholder="Bank details"
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <input
            type="number"
            step="0.01"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder="Hourly rate"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Payment terms, e.g. Due within 5 days"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
