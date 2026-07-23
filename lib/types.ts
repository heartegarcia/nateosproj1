export type Role = "admin" | "executive";
export type Assignee = "genie" | "nate";
export type TaskStatus = "not_started" | "in_progress" | "completed";
export type Priority = "high" | "medium" | "low";
export type ProjectStatus = "active" | "on_hold" | "completed";
export type ProjectHealth = "on_track" | "at_risk" | "behind";
export type ProjectViewMode = "gallery" | "list";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface Business {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  business_id: string;
  parent_project_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  view_mode: ProjectViewMode;
  created_at: string;
  deleted_at: string | null;
}

export type ContentStage = "concept" | "final";

export interface TaskRow {
  id: string;
  title: string;
  business_id: string;
  project_id: string | null;
  assignee: Assignee;
  status: TaskStatus;
  base_priority: Priority;
  due_date: string | null;
  notes: string | null;
  nate_note: string | null;
  channels: string | null;
  content_stage: ContentStage | null;
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface Task extends TaskRow {
  effective_priority: Priority;
  is_overdue: boolean;
  is_auto_escalated: boolean;
  business_name: string;
  business_color: string;
  project_name: string | null;
  channels_list: string[];
}

export interface TaskFilters {
  assignee?: Assignee;
  businessId?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueFrom?: string; // YYYY-MM-DD inclusive
  dueTo?: string; // YYYY-MM-DD inclusive
  today?: string; // YYYY-MM-DD, viewer's local "today" for priority escalation
}

export interface CreateTaskInput {
  title: string;
  businessId: string;
  projectId?: string | null;
  assignee?: Assignee;
  status?: TaskStatus;
  basePriority?: Priority;
  dueDate?: string | null;
  notes?: string | null;
  channels?: string[] | null;
  contentStage?: ContentStage | null;
}

export interface UpdateTaskInput {
  title?: string;
  businessId?: string;
  projectId?: string | null;
  assignee?: Assignee;
  status?: TaskStatus;
  basePriority?: Priority;
  dueDate?: string | null;
  notes?: string | null;
  nateNote?: string | null;
  channels?: string[] | null;
  contentStage?: ContentStage | null;
}

export interface CreateProjectInput {
  businessId: string;
  name: string;
  description?: string | null;
  parentProjectId?: string | null;
}

export interface UpdateProjectInput {
  status?: ProjectStatus;
  health?: ProjectHealth;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  folder: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface CreateBusinessInput {
  name: string;
  color: string;
}

export type FieldType = "text" | "longtext" | "date" | "link" | "auto_number" | "select";

export interface ProjectField {
  id: string;
  project_id: string;
  label: string;
  field_type: FieldType;
  auto_number_prefix: string | null;
  sync_to_calendar: number; // 0 | 1 (SQLite boolean)
  options: string | null; // JSON string array, only for field_type 'select'
  is_status: number; // 0 | 1 — marks this select field as the project's status pipeline
  sort_order: number;
  created_at: string;
}

export interface CreateProjectFieldInput {
  label: string;
  fieldType?: FieldType;
  autoNumberPrefix?: string | null;
  syncToCalendar?: boolean;
  options?: string[];
  isStatus?: boolean;
}

export interface ProjectEntry {
  id: string;
  project_id: string;
  title: string;
  linked_task_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  values: Record<string, string>; // field_id -> value
}

export interface EntryAttachment {
  id: string;
  entry_id: string;
  folder: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface DailyReview {
  id: string;
  review_date: string;
  wins: string | null;
  blockers: string | null;
  tomorrow: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateDailyReviewInput {
  wins?: string;
  blockers?: string;
  tomorrow?: string;
}

export type SopCategory = "sop" | "contract" | "playbook" | "training" | "onboarding" | "other";

export interface SopDocument {
  id: string;
  title: string;
  category: SopCategory;
  storage_path: string | null;
  file_name: string | null;
  external_url: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface CreateSopLinkInput {
  title: string;
  category: SopCategory;
  externalUrl: string;
  notes?: string | null;
}

export interface TimeEntry {
  id: string;
  work_date: string;
  start_time: string; // HH:MM
  end_time: string | null; // HH:MM, null = timer running
  notes: string | null;
  invoice_id: string | null;
  created_at: string;
  deleted_at: string | null;
  hours: number; // computed
}

export interface CreateTimeEntryInput {
  workDate: string;
  startTime: string;
  endTime?: string | null;
  notes?: string | null;
}

export interface UpdateTimeEntryInput {
  workDate?: string;
  startTime?: string;
  endTime?: string | null;
  notes?: string | null;
}

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface Invoice {
  id: string;
  invoice_number: number;
  period_start: string;
  period_end: string;
  total_hours: number;
  hourly_rate: number;
  total_amount: number;
  status: InvoiceStatus;
  approval_task_id: string | null;
  pdf_storage_path: string | null;
  created_at: string;
}

export interface InvoiceSettings {
  id: string;
  full_name: string | null;
  bank_details: string | null;
  hourly_rate: number | null;
  payment_terms: string | null;
}

export interface UpdateInvoiceSettingsInput {
  fullName?: string;
  bankDetails?: string;
  hourlyRate?: number;
  paymentTerms?: string;
}

export interface SocialAttachment {
  id: string;
  slot_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  uploaded_at: string;
  deleted_at: string | null;
}

export interface SocialSlot {
  id: string;
  content_date: string;
  stage: ContentStage;
  title: string | null;
  task_id: string | null;
  drive_link: string | null;
  created_at: string;
  updated_at: string;
  attachments: SocialAttachment[];
  filled: boolean; // drive_link set OR >= 1 attachment
}

/** A project entry surfaced onto a calendar because its project has a
 * sync-to-calendar date field. Used to overlay Events (etc.) on Nate's dashboard. */
export interface CalendarEntryItem {
  id: string; // entry id
  date: string; // YYYY-MM-DD
  title: string;
  business_id: string;
  business_color: string;
  business_name: string;
  project_id: string;
  project_name: string;
}

export type SearchResultType = "task" | "entry" | "project" | "attachment" | "sop";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface ApplicationStatusBreakdown {
  projectId: string;
  projectName: string;
  businessId: string;
  counts: { label: string; count: number }[];
}

export interface ClientBriefing {
  projectId: string;
  businessId: string;
  name: string;
  health: ProjectHealth;
  status: ProjectStatus;
  latestDashboardVersion: string | null;
}

export interface NextEventBriefing {
  id: string;
  title: string;
  date: string;
  href: string;
}

export interface ExecutiveBriefing {
  overdueCount: number;
  dueTodayCount: number;
  waitingOnNateCount: number;
  nextEvent: NextEventBriefing | null;
  applications: ApplicationStatusBreakdown[];
  clients: ClientBriefing[];
  contentReadyThisWeek: number;
  contentTotalThisWeek: number;
  missingDocumentationCount: number;
}

export interface TimelineItem {
  id: string;
  type: "entry" | "attachment";
  date: string; // ISO
  title: string;
  categoryName: string;
  entryId: string;
  entryHref: string;
}
