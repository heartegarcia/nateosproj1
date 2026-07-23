import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { addDays, format, subDays } from "date-fns";
import { db } from "../lib/db";

const today = new Date();
const d = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");

function reset() {
  db.exec("DELETE FROM tasks; DELETE FROM projects; DELETE FROM businesses; DELETE FROM users;");
}

function seedUsers() {
  const users = [
    {
      id: randomUUID(),
      email: "geniepcaubava@gmail.com",
      password: "genie123",
      display_name: "Genie",
      role: "admin",
    },
    {
      id: randomUUID(),
      email: "nate@nateos.local",
      password: "nate123",
      display_name: "Nate",
      role: "executive",
    },
  ];
  const stmt = db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, role, created_at) VALUES (@id, @email, @password_hash, @display_name, @role, @created_at)`
  );
  for (const u of users) {
    stmt.run({
      id: u.id,
      email: u.email,
      password_hash: bcrypt.hashSync(u.password, 10),
      display_name: u.display_name,
      role: u.role,
      created_at: new Date().toISOString(),
    });
  }
  console.log("Seeded users:");
  for (const u of users) console.log(`  ${u.display_name}: ${u.email} / ${u.password}`);
}

function seedBusinesses() {
  const businesses = [
    { name: "Business On Purpose", color: "#6366f1" },
    { name: "MyHousePlans", color: "#10b981" },
    { name: "Mydas", color: "#f59e0b" },
    { name: "Social Media", color: "#ec4899" },
    { name: "Personal / Executive Support", color: "#0ea5e9" },
  ];
  const stmt = db.prepare(
    `INSERT INTO businesses (id, name, color, sort_order, created_at) VALUES (@id, @name, @color, @sort_order, @created_at)`
  );
  const ids: Record<string, string> = {};
  businesses.forEach((b, i) => {
    const id = randomUUID();
    ids[b.name] = id;
    stmt.run({ id, name: b.name, color: b.color, sort_order: i, created_at: new Date().toISOString() });
  });
  return ids;
}

function seedProjects(businessIds: Record<string, string>) {
  const projects = [
    { business: "Business On Purpose", name: "Q3 Coaching Cohort" },
    { business: "MyHousePlans", name: "Website Relaunch" },
    { business: "Mydas", name: "Investor Update Deck" },
    { business: "Social Media", name: "July Content Calendar" },
    { business: "Personal / Executive Support", name: "Travel & Scheduling" },
  ];
  const stmt = db.prepare(
    `INSERT INTO projects (id, business_id, name, description, status, health, created_at) VALUES (@id, @business_id, @name, @description, @status, @health, @created_at)`
  );
  const ids: Record<string, string> = {};
  for (const p of projects) {
    const id = randomUUID();
    ids[p.name] = id;
    stmt.run({
      id,
      business_id: businessIds[p.business],
      name: p.name,
      description: null,
      status: "active",
      health: "on_track",
      created_at: new Date().toISOString(),
    });
  }
  return ids;
}

function seedTasks(businessIds: Record<string, string>, projectIds: Record<string, string>) {
  const stmt = db.prepare(
    `INSERT INTO tasks (id, title, business_id, project_id, assignee, status, base_priority, due_date, notes, channels, created_at, completed_at)
     VALUES (@id, @title, @business_id, @project_id, @assignee, @status, @base_priority, @due_date, @notes, @channels, @created_at, @completed_at)`
  );

  const rows = [
    // Overdue
    {
      title: "Send Q2 investor recap",
      business: "Mydas",
      project: "Investor Update Deck",
      assignee: "genie",
      status: "in_progress",
      base_priority: "high",
      due_date: d(-2),
      notes: "Waiting on final revenue numbers from accountant.",
    },
    {
      title: "Approve contractor invoice #114",
      business: "MyHousePlans",
      project: null,
      assignee: "nate",
      status: "not_started",
      base_priority: "medium",
      due_date: d(-1),
      notes: null,
    },
    // Due today
    {
      title: "Finalize cohort welcome email",
      business: "Business On Purpose",
      project: "Q3 Coaching Cohort",
      assignee: "genie",
      status: "in_progress",
      base_priority: "medium",
      due_date: d(0),
      notes: null,
    },
    {
      title: "Approve speaker one-pager",
      business: "Business On Purpose",
      project: "Q3 Coaching Cohort",
      assignee: "nate",
      status: "not_started",
      base_priority: "high",
      due_date: d(0),
      notes: "Reviewed draft — looks good, needs Nate's sign-off before print.",
    },
    // Due within 48h -> auto high
    {
      title: "Upload house plan renders to site",
      business: "MyHousePlans",
      project: "Website Relaunch",
      assignee: "genie",
      status: "not_started",
      base_priority: "low",
      due_date: d(1),
      notes: null,
    },
    // Due within 5 days -> auto medium at least
    {
      title: "Draft July content calendar",
      business: "Social Media",
      project: "July Content Calendar",
      assignee: "genie",
      status: "not_started",
      base_priority: "low",
      due_date: d(4),
      notes: null,
    },
    {
      title: "Edit + post client-win reel",
      business: "Social Media",
      project: "July Content Calendar",
      assignee: "genie",
      status: "not_started",
      base_priority: "medium",
      due_date: d(5),
      notes: "Pull best testimonial clip from Friday call.",
      channels: "ig,tiktok",
    },
    // Waiting on Nate, no due date pressure
    {
      title: "Approve new contractor rate sheet",
      business: "Mydas",
      project: null,
      assignee: "nate",
      status: "not_started",
      base_priority: "medium",
      due_date: d(6),
      notes: null,
    },
    {
      title: "Review & sign updated NDA template",
      business: "Personal / Executive Support",
      project: null,
      assignee: "nate",
      status: "in_progress",
      base_priority: "low",
      due_date: d(9),
      notes: "Redlines from legal attached.",
    },
    // Further out, low priority
    {
      title: "Research new project management tool",
      business: "Personal / Executive Support",
      project: "Travel & Scheduling",
      assignee: "genie",
      status: "not_started",
      base_priority: "low",
      due_date: d(14),
      notes: null,
    },
    // Completed today
    {
      title: "Book flights for Denver conference",
      business: "Personal / Executive Support",
      project: "Travel & Scheduling",
      assignee: "genie",
      status: "completed",
      base_priority: "medium",
      due_date: d(0),
      notes: null,
      completed_today: true,
    },
    {
      title: "Post Monday motivation graphic",
      business: "Social Media",
      project: "July Content Calendar",
      assignee: "genie",
      status: "completed",
      base_priority: "low",
      due_date: d(-1),
      notes: null,
      channels: "fb,ig",
      completed_today: true,
    },
    // Completed earlier (not today) - should not show in "completed today"
    {
      title: "Kickoff call with web designer",
      business: "MyHousePlans",
      project: "Website Relaunch",
      assignee: "genie",
      status: "completed",
      base_priority: "medium",
      due_date: d(-5),
      notes: null,
      completed_offset: -3,
    },
    // No due date
    {
      title: "Organize SOP folder structure",
      business: "Personal / Executive Support",
      project: null,
      assignee: "genie",
      status: "not_started",
      base_priority: "low",
      due_date: null,
      notes: null,
    },
  ];

  for (const r of rows) {
    const completedAt =
      "completed_today" in r && r.completed_today
        ? new Date().toISOString()
        : "completed_offset" in r && r.completed_offset !== undefined
          ? subDays(today, Math.abs(r.completed_offset)).toISOString()
          : null;
    stmt.run({
      id: randomUUID(),
      title: r.title,
      business_id: businessIds[r.business],
      project_id: r.project ? projectIds[r.project] : null,
      assignee: r.assignee,
      status: r.status,
      base_priority: r.base_priority,
      due_date: r.due_date,
      notes: r.notes,
      channels: "channels" in r ? (r.channels ?? null) : null,
      created_at: subDays(today, 7).toISOString(),
      completed_at: completedAt,
    });
  }
  console.log(`Seeded ${rows.length} demo tasks.`);
}

reset();
seedUsers();
const businessIds = seedBusinesses();
const projectIds = seedProjects(businessIds);
seedTasks(businessIds, projectIds);
console.log("Seed complete.");
