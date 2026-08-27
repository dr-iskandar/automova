import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const permissions = sqliteTable(
  "permissions",
  {
    id: text("id").primaryKey(),
    module: text("module").notNull(),
    action: text("action").notNull(),
    label: text("label").notNull(),
  },
  (table) => [
    uniqueIndex("permissions_module_action_unique").on(
      table.module,
      table.action,
    ),
  ],
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id),
    allowed: integer("allowed", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    passwordHash: text("password_hash").notNull(),
    status: text("status").notNull().default("Active"),
    shift: text("shift").notNull().default(""),
    employeeNo: text("employee_no").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_users_role").on(table.roleId)],
);

export const materials = sqliteTable("materials", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  defaultQty: real("default_qty").notNull().default(0),
  unit: text("unit").notNull(),
  unitPrice: real("unit_price").notNull().default(0),
  currency: text("currency").notNull().default("IDR"),
  status: text("status").notNull().default("Active"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const materialPriceHistory = sqliteTable(
  "material_price_history",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    unitPrice: real("unit_price").notNull(),
    currency: text("currency").notNull().default("IDR"),
    effectiveAt: text("effective_at").notNull(),
    notes: text("notes").notNull().default(""),
    actor: text("actor").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_material_price_history").on(
      table.materialId,
      table.effectiveAt,
    ),
  ],
);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  product: text("product").notNull(),
  target: real("target").notNull(),
  unit: text("unit").notNull(),
  shift: text("shift").notNull(),
  area: text("area").notNull(),
  line: text("line").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("Draft"),
  popupEnabled: integer("popup_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  popupTitle: text("popup_title").notNull().default(""),
  popupMessage: text("popup_message").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const jobMaterials = sqliteTable("job_materials", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  materialId: text("material_id").references(() => materials.id),
  name: text("name").notNull(),
  qty: real("qty").notNull(),
  unit: text("unit").notNull(),
  sequence: integer("sequence").notNull().default(0),
});

export const jobSteps = sqliteTable(
  "job_steps",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    stepNo: integer("step_no").notNull(),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    warning: text("warning").notNull().default(""),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    actionLabel: text("action_label").notNull(),
    notesRequired: integer("notes_required", { mode: "boolean" })
      .notNull()
      .default(false),
    yesTarget: text("yes_target").notNull().default("next"),
    noTarget: text("no_target").notNull().default("paused"),
  },
  (table) => [index("idx_steps_job").on(table.jobId, table.stepNo)],
);

export const batches = sqliteTable(
  "batches",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id"),
    jobName: text("job_name").notNull(),
    jobVersion: integer("job_version").notNull(),
    operatorId: text("operator_id"),
    operatorName: text("operator_name").notNull(),
    status: text("status").notNull(),
    currentStep: integer("current_step").notNull().default(0),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    output: real("output"),
    unit: text("unit").notNull(),
    plannedDuration: integer("planned_duration").notNull().default(0),
    actualDuration: integer("actual_duration").notNull().default(0),
    pauseCount: integer("pause_count").notNull().default(0),
    onTime: integer("on_time", { mode: "boolean" }).notNull().default(true),
    estimatedMaterialCost: real("estimated_material_cost")
      .notNull()
      .default(0),
    actualMaterialCost: real("actual_material_cost").notNull().default(0),
    costPerUnit: real("cost_per_unit").notNull().default(0),
  },
  (table) => [index("idx_batches_operator").on(table.operatorId, table.status)],
);

export const batchEvents = sqliteTable(
  "batch_events",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    eventTime: text("event_time").notNull(),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    actor: text("actor").notNull().default(""),
  },
  (table) => [index("idx_events_batch").on(table.batchId, table.eventTime)],
);

export const materialMovements = sqliteTable(
  "material_movements",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id),
    movementType: text("movement_type").notNull(),
    qty: real("qty").notNull(),
    unit: text("unit").notNull(),
    unitCost: real("unit_cost").notNull().default(0),
    totalCost: real("total_cost").notNull().default(0),
    currency: text("currency").notNull().default("IDR"),
    occurredAt: text("occurred_at").notNull(),
    purpose: text("purpose").notNull().default(""),
    jobId: text("job_id"),
    batchId: text("batch_id"),
    reference: text("reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    actor: text("actor").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_material_movements_period").on(
      table.materialId,
      table.occurredAt,
      table.movementType,
    ),
    index("idx_material_movements_batch").on(table.batchId),
  ],
);

export const reportPresets = sqliteTable("report_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  reportType: text("report_type").notNull().default("Production Summary"),
  fromDate: text("from_date").notNull(),
  toDate: text("to_date").notNull(),
  statusFilter: text("status_filter").notNull().default(""),
  jobFilter: text("job_filter").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    targetRole: text("target_role").notNull().default("all"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("info"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    linkView: text("link_view").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_notifications_role_read").on(
      table.targetRole,
      table.isRead,
      table.createdAt,
    ),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
