import type {
  Business,
  CalendarEntryItem,
  CreateBusinessInput,
  CreateProjectFieldInput,
  CreateProjectInput,
  CreateSopLinkInput,
  CreateTaskInput,
  CreateTimeEntryInput,
  DailyReview,
  EntryAttachment,
  ExecutiveBriefing,
  Invoice,
  InvoiceSettings,
  Project,
  ProjectEntry,
  ProjectField,
  SearchResult,
  SocialSlot,
  SopCategory,
  SopDocument,
  Task,
  TaskAttachment,
  TaskFilters,
  TimeEntry,
  TimelineItem,
  UpdateDailyReviewInput,
  UpdateInvoiceSettingsInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateTimeEntryInput,
} from "@/lib/types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

async function uploadFile<T>(url: string, folder: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.set("folder", folder);
  formData.set("file", file);
  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function fetchTasks(filters: TaskFilters): Promise<{ tasks: Task[] }> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  return jsonFetch(`/api/tasks?${params.toString()}`);
}

export function createTaskClient(input: CreateTaskInput): Promise<{ task: Task }> {
  return jsonFetch("/api/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function updateTaskClient(id: string, input: UpdateTaskInput): Promise<{ task: Task }> {
  return jsonFetch(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTaskClient(id: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/tasks/${id}`, { method: "DELETE" });
}

export function fetchBusinesses(): Promise<{ businesses: Business[] }> {
  return jsonFetch("/api/businesses");
}

export function fetchProjects(businessId?: string): Promise<{ projects: Project[] }> {
  const qs = businessId ? `?businessId=${businessId}` : "";
  return jsonFetch(`/api/projects${qs}`);
}

export function createProjectClient(input: CreateProjectInput): Promise<{ project: Project }> {
  return jsonFetch("/api/projects", { method: "POST", body: JSON.stringify(input) });
}

export function fetchChildProjects(parentId: string): Promise<{ projects: Project[] }> {
  return jsonFetch(`/api/projects?parentId=${parentId}`);
}

export function deleteProjectClient(id: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/projects/${id}`, { method: "DELETE" });
}

export function fetchCalendarItems(): Promise<{ items: CalendarEntryItem[] }> {
  return jsonFetch(`/api/calendar-items`);
}

export function fetchAttachments(taskId: string): Promise<{ attachments: TaskAttachment[] }> {
  return jsonFetch(`/api/tasks/${taskId}/attachments`);
}

export function uploadAttachment(taskId: string, folder: string, file: File): Promise<{ attachment: TaskAttachment }> {
  return uploadFile(`/api/tasks/${taskId}/attachments`, folder, file);
}

export function deleteAttachment(taskId: string, attachmentId: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, { method: "DELETE" });
}

export function createBusinessClient(input: CreateBusinessInput): Promise<{ business: Business }> {
  return jsonFetch("/api/businesses", { method: "POST", body: JSON.stringify(input) });
}

export function fetchProjectFields(projectId: string): Promise<{ fields: ProjectField[] }> {
  return jsonFetch(`/api/projects/${projectId}/fields`);
}

export function createProjectFieldClient(
  projectId: string,
  input: CreateProjectFieldInput
): Promise<{ field: ProjectField }> {
  return jsonFetch(`/api/projects/${projectId}/fields`, { method: "POST", body: JSON.stringify(input) });
}

export function deleteProjectFieldClient(projectId: string, fieldId: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/projects/${projectId}/fields/${fieldId}`, { method: "DELETE" });
}

export function fetchProjectEntries(projectId: string): Promise<{ entries: ProjectEntry[] }> {
  return jsonFetch(`/api/projects/${projectId}/entries`);
}

export function createProjectEntryClient(projectId: string, title: string): Promise<{ entry: ProjectEntry }> {
  return jsonFetch(`/api/projects/${projectId}/entries`, { method: "POST", body: JSON.stringify({ title }) });
}

export function fetchEntry(entryId: string): Promise<{ entry: ProjectEntry }> {
  return jsonFetch(`/api/entries/${entryId}`);
}

export function updateEntryClient(
  entryId: string,
  input: { title?: string; values?: Record<string, string> }
): Promise<{ entry: ProjectEntry }> {
  return jsonFetch(`/api/entries/${entryId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteEntryClient(entryId: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/entries/${entryId}`, { method: "DELETE" });
}

export function fetchEntryAttachments(entryId: string): Promise<{ attachments: EntryAttachment[] }> {
  return jsonFetch(`/api/entries/${entryId}/attachments`);
}

export function uploadEntryAttachment(entryId: string, folder: string, file: File): Promise<{ attachment: EntryAttachment }> {
  return uploadFile(`/api/entries/${entryId}/attachments`, folder, file);
}

export function deleteEntryAttachment(entryId: string, attachmentId: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/entries/${entryId}/attachments/${attachmentId}`, { method: "DELETE" });
}

export function fetchTaskFolders(taskId: string): Promise<{ folders: string[] }> {
  return jsonFetch(`/api/tasks/${taskId}/folders`);
}

export function createTaskFolder(taskId: string, name: string): Promise<{ folders: string[] }> {
  return jsonFetch(`/api/tasks/${taskId}/folders`, { method: "POST", body: JSON.stringify({ name }) });
}

export function fetchEntryFolders(entryId: string): Promise<{ folders: string[] }> {
  return jsonFetch(`/api/entries/${entryId}/folders`);
}

export function createEntryFolder(entryId: string, name: string): Promise<{ folders: string[] }> {
  return jsonFetch(`/api/entries/${entryId}/folders`, { method: "POST", body: JSON.stringify({ name }) });
}

export function updateProjectViewModeClient(projectId: string, viewMode: "gallery" | "list"): Promise<{ project: Project }> {
  return jsonFetch(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ viewMode }) });
}

export function updateProjectClient(projectId: string, input: UpdateProjectInput): Promise<{ project: Project }> {
  return jsonFetch(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function fetchProjectTimeline(projectId: string): Promise<{ items: TimelineItem[] }> {
  return jsonFetch(`/api/projects/${projectId}/timeline`);
}

export function searchClient(query: string): Promise<{ results: SearchResult[] }> {
  return jsonFetch(`/api/search?q=${encodeURIComponent(query)}`);
}

export function fetchBriefing(today: string): Promise<{ briefing: ExecutiveBriefing }> {
  return jsonFetch(`/api/briefing?today=${today}`);
}

export function fetchReview(date: string): Promise<{ review: DailyReview | null }> {
  return jsonFetch(`/api/reviews?date=${date}`);
}

export function fetchReviewDates(): Promise<{ dates: string[] }> {
  return jsonFetch(`/api/reviews/dates`);
}

export function saveReviewClient(date: string, input: UpdateDailyReviewInput): Promise<{ review: DailyReview }> {
  return jsonFetch(`/api/reviews`, { method: "PATCH", body: JSON.stringify({ date, ...input }) });
}

export function fetchSopDocuments(): Promise<{ documents: SopDocument[] }> {
  return jsonFetch(`/api/sop-documents`);
}

export function createSopLinkClient(input: CreateSopLinkInput): Promise<{ document: SopDocument }> {
  return jsonFetch(`/api/sop-documents`, { method: "POST", body: JSON.stringify(input) });
}

export async function uploadSopFileClient(
  title: string,
  category: SopCategory,
  notes: string,
  file: File
): Promise<{ document: SopDocument }> {
  const formData = new FormData();
  formData.set("title", title);
  formData.set("category", category);
  formData.set("notes", notes);
  formData.set("file", file);
  const res = await fetch("/api/sop-documents", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function deleteSopDocumentClient(id: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/sop-documents/${id}`, { method: "DELETE" });
}

export function fetchTimeEntries(filters: { from?: string; to?: string; unbilledOnly?: boolean } = {}): Promise<{
  entries: TimeEntry[];
}> {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.unbilledOnly) params.set("unbilledOnly", "true");
  return jsonFetch(`/api/time-entries?${params.toString()}`);
}

export function fetchRunningEntry(): Promise<{ entry: TimeEntry | null }> {
  return jsonFetch(`/api/time-entries/running`);
}

export function clockInClient(workDate: string, startTime: string): Promise<{ entry: TimeEntry }> {
  return jsonFetch(`/api/time-entries/clock-in`, { method: "POST", body: JSON.stringify({ workDate, startTime }) });
}

export function clockOutClient(endTime: string): Promise<{ entry: TimeEntry }> {
  return jsonFetch(`/api/time-entries/clock-out`, { method: "POST", body: JSON.stringify({ endTime }) });
}

export function createTimeEntryClient(input: CreateTimeEntryInput): Promise<{ entry: TimeEntry }> {
  return jsonFetch(`/api/time-entries`, { method: "POST", body: JSON.stringify(input) });
}

export function updateTimeEntryClient(id: string, input: UpdateTimeEntryInput): Promise<{ entry: TimeEntry }> {
  return jsonFetch(`/api/time-entries/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteTimeEntryClient(id: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/time-entries/${id}`, { method: "DELETE" });
}

export function fetchInvoices(): Promise<{ invoices: Invoice[] }> {
  return jsonFetch(`/api/invoices`);
}

export function generateInvoiceClient(periodStart: string | null, periodEnd: string | null): Promise<{ invoice: Invoice }> {
  return jsonFetch(`/api/invoices`, { method: "POST", body: JSON.stringify({ periodStart, periodEnd }) });
}

export function markInvoicePaidClient(id: string): Promise<{ invoice: Invoice }> {
  return jsonFetch(`/api/invoices/${id}`, { method: "PATCH" });
}

export function fetchInvoiceEntries(id: string): Promise<{ entries: TimeEntry[] }> {
  return jsonFetch(`/api/invoices/${id}/entries`);
}

export function fetchInvoiceSettings(): Promise<{ settings: InvoiceSettings }> {
  return jsonFetch(`/api/invoice-settings`);
}

export function updateInvoiceSettingsClient(input: UpdateInvoiceSettingsInput): Promise<{ settings: InvoiceSettings }> {
  return jsonFetch(`/api/invoice-settings`, { method: "PATCH", body: JSON.stringify(input) });
}

export function fetchSocialSlots(from: string, to: string): Promise<{ slots: SocialSlot[] }> {
  return jsonFetch(`/api/social-content?from=${from}&to=${to}`);
}

export function upsertSocialSlotClient(
  date: string,
  stage: "concept" | "final",
  title?: string | null
): Promise<{ slot: SocialSlot }> {
  return jsonFetch(`/api/social-content`, { method: "POST", body: JSON.stringify({ date, stage, title }) });
}

export function setSocialDriveLinkClient(id: string, driveLink: string): Promise<{ slot: SocialSlot }> {
  return jsonFetch(`/api/social-content/${id}`, { method: "PATCH", body: JSON.stringify({ driveLink }) });
}

export async function uploadSocialAttachment(slotId: string, file: File): Promise<{ attachment: unknown }> {
  const formData = new FormData();
  formData.set("file", file);
  const res = await fetch(`/api/social-content/${slotId}/attachments`, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function deleteSocialAttachment(slotId: string, attachmentId: string): Promise<{ ok: true }> {
  return jsonFetch(`/api/social-content/${slotId}/attachments/${attachmentId}`, { method: "DELETE" });
}

export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
