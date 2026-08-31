import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, copyFileSync, statSync, readdirSync, unlinkSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID, scryptSync, randomBytes } from "node:crypto";

const databasePath = resolve(
  process.env.AUTOMOVA_DB_PATH || "data/automova.sqlite",
);
const port = Number(process.env.AUTOMOVA_API_PORT || 3100);
mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// AUTO BACKUP ENGINE
const backupsDir = resolve(dirname(databasePath), "backups");
mkdirSync(backupsDir, { recursive: true });

const soundsDir = resolve(dirname(databasePath), "sounds");
mkdirSync(soundsDir, { recursive: true });

function performBackup(reason = "auto") {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `automova_backup_${timestamp}.sqlite`;
    const backupFilePath = resolve(backupsDir, backupFileName);

    try {
      db.prepare(`VACUUM INTO '${backupFilePath}'`).run();
    } catch {
      copyFileSync(databasePath, backupFilePath);
    }

    const stat = statSync(backupFilePath);
    const backupTime = new Date().toISOString();
    const backupSizeMb = (stat.size / (1024 * 1024)).toFixed(2);

    db.prepare(
      "INSERT OR REPLACE INTO settings(key, value, updated_at) VALUES('last_backup_time', ?, CURRENT_TIMESTAMP)"
    ).run(backupTime);
    db.prepare(
      "INSERT OR REPLACE INTO settings(key, value, updated_at) VALUES('last_backup_file', ?, CURRENT_TIMESTAMP)"
    ).run(backupFileName);
    db.prepare(
      "INSERT OR REPLACE INTO settings(key, value, updated_at) VALUES('last_backup_size', ?, CURRENT_TIMESTAMP)"
    ).run(`${backupSizeMb} MB`);

    const files = readdirSync(backupsDir)
      .filter((f) => f.startsWith("automova_backup_") && f.endsWith(".sqlite"))
      .sort();
    if (files.length > 30) {
      const toDelete = files.slice(0, files.length - 30);
      for (const f of toDelete) {
        try { unlinkSync(resolve(backupsDir, f)); } catch { /* ignore */ }
      }
    }

    return {
      ok: true,
      time: backupTime,
      file: backupFileName,
      size: `${backupSizeMb} MB`,
      reason,
    };
  } catch (error) {
    console.error("Backup failed:", error);
    return { ok: false, error: String(error) };
  }
}

// Initial startup backup

// Periodic 6-hour backup schedule
setInterval(() => {
  performBackup("scheduled_6h");
}, 6 * 60 * 60 * 1000);

// Initial startup backup will be called after schema creation
const schema = [
  `CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', is_system INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, module TEXT NOT NULL, action TEXT NOT NULL, label TEXT NOT NULL, UNIQUE(module, action))`,
  `CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id), permission_id TEXT NOT NULL REFERENCES permissions(id), allowed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(role_id, permission_id))`,
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role_id TEXT NOT NULL REFERENCES roles(id), password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Active', shift TEXT NOT NULL DEFAULT '', employee_no TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS master_shifts (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'Active')`,
  `CREATE TABLE IF NOT EXISTS master_areas (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'Active')`,
  `CREATE TABLE IF NOT EXISTS master_lines (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, area_id TEXT, status TEXT NOT NULL DEFAULT 'Active')`,
  `CREATE TABLE IF NOT EXISTS master_units (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'Active')`,
  `CREATE TABLE IF NOT EXISTS master_packaging (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'Active')`,
  `CREATE TABLE IF NOT EXISTS materials (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, default_qty REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL, unit_price REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'IDR', status TEXT NOT NULL DEFAULT 'Active', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS material_price_history (id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES materials(id), unit_price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'IDR', effective_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, name TEXT NOT NULL, product TEXT NOT NULL, product_code TEXT NOT NULL DEFAULT '', target REAL NOT NULL, unit TEXT NOT NULL, shift TEXT NOT NULL, area TEXT NOT NULL, line TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'Draft', popup_enabled INTEGER NOT NULL DEFAULT 1, popup_title TEXT NOT NULL DEFAULT '', popup_message TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS job_materials (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, material_id TEXT REFERENCES materials(id), name TEXT NOT NULL, qty REAL NOT NULL, unit TEXT NOT NULL, sequence INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS job_packagings (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, packaging_id TEXT REFERENCES master_packaging(id), name TEXT NOT NULL, qty REAL NOT NULL, unit TEXT NOT NULL, sequence INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS job_steps (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, step_no INTEGER NOT NULL, title TEXT NOT NULL, instruction TEXT NOT NULL, warning TEXT NOT NULL DEFAULT '', duration_seconds INTEGER NOT NULL DEFAULT 0, action_label TEXT NOT NULL, notes_required INTEGER NOT NULL DEFAULT 0, yes_target TEXT NOT NULL DEFAULT 'next', no_target TEXT NOT NULL DEFAULT 'paused')`,
  `CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, job_id TEXT, job_name TEXT NOT NULL, job_version INTEGER NOT NULL, operator_id TEXT, operator_name TEXT NOT NULL, status TEXT NOT NULL, current_step INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL, completed_at TEXT, output REAL, unit TEXT NOT NULL, planned_duration INTEGER NOT NULL DEFAULT 0, actual_duration INTEGER NOT NULL DEFAULT 0, pause_count INTEGER NOT NULL DEFAULT 0, on_time INTEGER NOT NULL DEFAULT 1, estimated_material_cost REAL NOT NULL DEFAULT 0, actual_material_cost REAL NOT NULL DEFAULT 0, cost_per_unit REAL NOT NULL DEFAULT 0, batch_no TEXT NOT NULL DEFAULT '', packaging_code TEXT NOT NULL DEFAULT '', expired_date TEXT NOT NULL DEFAULT '', storage_location TEXT NOT NULL DEFAULT '', filling_date TEXT NOT NULL DEFAULT '', special_notes TEXT NOT NULL DEFAULT '', line TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS batch_events (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE, event_time TEXT NOT NULL, event_type TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS material_movements (id TEXT PRIMARY KEY, material_id TEXT NOT NULL REFERENCES materials(id), movement_type TEXT NOT NULL, qty REAL NOT NULL, unit TEXT NOT NULL, unit_cost REAL NOT NULL DEFAULT 0, total_cost REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'IDR', occurred_at TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', job_id TEXT, batch_id TEXT, reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS packaging_movements (id TEXT PRIMARY KEY, packaging_id TEXT NOT NULL REFERENCES master_packaging(id), movement_type TEXT NOT NULL, qty REAL NOT NULL, unit TEXT NOT NULL, unit_cost REAL NOT NULL DEFAULT 0, total_cost REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'IDR', occurred_at TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', job_id TEXT, batch_id TEXT, reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS report_presets (id TEXT PRIMARY KEY, name TEXT NOT NULL, report_type TEXT NOT NULL DEFAULT 'Production Summary', from_date TEXT NOT NULL, to_date TEXT NOT NULL, status_filter TEXT NOT NULL DEFAULT '', job_filter TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, target_role TEXT NOT NULL DEFAULT 'all', title TEXT NOT NULL, message TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'info', is_read INTEGER NOT NULL DEFAULT 0, link_view TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS master_sounds (id TEXT PRIMARY KEY, name TEXT NOT NULL, filename TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id)`,
  `CREATE INDEX IF NOT EXISTS idx_steps_job ON job_steps(job_id, step_no)`,
  `CREATE INDEX IF NOT EXISTS idx_batches_operator ON batches(operator_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_events_batch ON batch_events(batch_id, event_time)`,
  `CREATE INDEX IF NOT EXISTS idx_batches_started_at ON batches(started_at)`,
  `CREATE INDEX IF NOT EXISTS idx_material_price_history ON material_price_history(material_id, effective_at)`,
  `CREATE INDEX IF NOT EXISTS idx_material_movements_period ON material_movements(material_id, occurred_at, movement_type)`,
  `CREATE INDEX IF NOT EXISTS idx_material_movements_batch ON material_movements(batch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_packaging_movements_period ON packaging_movements(packaging_id, occurred_at, movement_type)`,
  `CREATE INDEX IF NOT EXISTS idx_packaging_movements_batch ON packaging_movements(batch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_role_read ON notifications(target_role, is_read, created_at)`,
];
for (const statement of schema) db.prepare(statement).run();

const ensureColumn = (table, column, definition) => {
  const exists = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((item) => item.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
ensureColumn("materials", "unit_price", "REAL NOT NULL DEFAULT 0");
ensureColumn("materials", "currency", "TEXT NOT NULL DEFAULT 'IDR'");
ensureColumn("materials", "min_sku", "REAL NOT NULL DEFAULT 0");
ensureColumn("master_packaging", "min_sku", "REAL NOT NULL DEFAULT 0");
ensureColumn(
  "batches",
  "estimated_material_cost",
  "REAL NOT NULL DEFAULT 0",
);
ensureColumn("batches", "actual_material_cost", "REAL NOT NULL DEFAULT 0");
ensureColumn("batches", "cost_per_unit", "REAL NOT NULL DEFAULT 0");
ensureColumn("batches", "area", "TEXT NOT NULL DEFAULT ''");
ensureColumn("batches", "line", "TEXT NOT NULL DEFAULT ''");
ensureColumn("material_movements", "unit_cost", "REAL NOT NULL DEFAULT 0");
ensureColumn("material_movements", "total_cost", "REAL NOT NULL DEFAULT 0");
ensureColumn(
  "material_movements",
  "currency",
  "TEXT NOT NULL DEFAULT 'IDR'",
);
ensureColumn("master_packaging", "default_qty", "REAL NOT NULL DEFAULT 0");
ensureColumn("master_packaging", "unit", "TEXT NOT NULL DEFAULT 'Pcs'");
ensureColumn("master_packaging", "unit_price", "REAL NOT NULL DEFAULT 0");
ensureColumn("master_packaging", "currency", "TEXT NOT NULL DEFAULT 'IDR'");
ensureColumn("master_packaging", "notes", "TEXT NOT NULL DEFAULT ''");
ensureColumn("jobs", "sound_step_completed_id", "TEXT");
ensureColumn("jobs", "sound_job_completed_id", "TEXT");
ensureColumn("jobs", "sound_paused_id", "TEXT");
ensureColumn("jobs", "sound_stopped_id", "TEXT");
ensureColumn("jobs", "allow_overdrive", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("job_steps", "sound_completed_id", "TEXT");
ensureColumn("job_steps", "sound_warning_id", "TEXT");
ensureColumn("job_steps", "allow_overdrive", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("job_steps", "loop_warning", "INTEGER NOT NULL DEFAULT 1");

try {
  db.exec(`
    UPDATE batches 
    SET line = COALESCE((SELECT line FROM jobs WHERE jobs.id = batches.job_id), '') 
    WHERE line IS NULL OR line = ''
  `);
} catch (err) {
  console.warn("Gagal memperbarui kolom line pada data batch lama:", err);
}

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
};

const verifyPassword = (password, storedHash) => {
  if (!storedHash?.includes(":")) return false;
  const [salt, expected] = storedHash.split(":");
  return scryptSync(password, salt, 64).toString("hex") === expected;
};

const checkMaterialStockWarning = (materialId) => {
  try {
    const material = db.prepare("SELECT name, min_sku FROM materials WHERE id=?").get(materialId);
    if (!material || material.min_sku === undefined || material.min_sku === null || !(material.min_sku > 0)) return;

    const currentStock = db.prepare(
      "SELECT COALESCE(SUM(CASE WHEN movement_type IN ('IN','ADJUSTMENT_IN') THEN qty WHEN movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -qty ELSE 0 END),0) AS total FROM material_movements WHERE material_id=?"
    ).get(materialId)?.total || 0;

    if (currentStock <= material.min_sku) {
      db.prepare(
        "INSERT INTO notifications(id,target_role,title,message,type,is_read,link_view) VALUES(?,?,?,?,?,0,?)"
      ).run(
        randomUUID(),
        "all",
        "Peringatan Stok Bahan Baku",
        `silahkan cek ada bahan yang segera habis (Stok ${material.name} tersisa ${currentStock})`,
        "warning",
        ""
      );
    }
  } catch (err) {
    console.error("Gagal memeriksa peringatan stok material:", err);
  }
};

const checkPackagingStockWarning = (packagingId) => {
  try {
    const packaging = db.prepare("SELECT name, min_sku FROM master_packaging WHERE id=?").get(packagingId);
    if (!packaging || packaging.min_sku === undefined || packaging.min_sku === null || !(packaging.min_sku > 0)) return;

    const currentStock = db.prepare(
      "SELECT COALESCE(SUM(CASE WHEN movement_type IN ('IN','ADJUSTMENT_IN') THEN qty WHEN movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -qty ELSE 0 END),0) AS total FROM packaging_movements WHERE packaging_id=?"
    ).get(packagingId)?.total || 0;

    if (currentStock <= packaging.min_sku) {
      db.prepare(
        "INSERT INTO notifications(id,target_role,title,message,type,is_read,link_view) VALUES(?,?,?,?,?,0,?)"
      ).run(
        randomUUID(),
        "all",
        "Peringatan Stok Kemasan",
        `silahkan cek ada bahan yang segera habis (Stok ${packaging.name} tersisa ${currentStock})`,
        "warning",
        ""
      );
    }
  } catch (err) {
    console.error("Gagal memeriksa peringatan stok packaging:", err);
  }
};

function seed() {
  const roles = [
    [
      "role-admin",
      "Administrator",
      "Akses penuh master, transaksi, report, audit, dan settings",
      1,
    ],
    [
      "role-supervisor",
      "Supervisor",
      "Monitoring produksi dan otorisasi override",
      1,
    ],
    [
      "role-operator",
      "Operator",
      "Menjalankan Job dan melihat riwayat pribadi",
      1,
    ],
    ["role-viewer", "Management / Viewer", "Dashboard dan report read-only", 1],
  ];
  const insertRole = db.prepare(
    "INSERT OR IGNORE INTO roles(id,name,description,is_system) VALUES(?,?,?,?)",
  );
  for (const role of roles) insertRole.run(...role);

  const permissions = [
    ["dashboard.view", "Dashboard", "view", "Lihat dashboard"],
    ["jobs.manage", "Job", "manage", "Kelola Job & version"],
    ["materials.manage", "Material", "manage", "Kelola material"],
    ["packaging.manage", "Kemasan", "manage", "Kelola kemasan"],
    ["operational_config.manage", "Pengaturan Operasional", "manage", "Kelola area, line, shift, & satuan"],
    ["batches.execute", "Batch", "execute", "Jalankan batch"],
    ["batches.override", "Batch", "override", "Repeat, skip, resume, cancel"],
    ["batches.view_all", "Batch", "view_all", "Lihat semua batch"],
    ["reports.view", "Report", "view", "Lihat report"],
    ["reports.export", "Report", "export", "Export report"],
    ["users.manage", "User", "manage", "Kelola user"],
    ["roles.manage", "Hak Akses", "manage", "Kelola role & permission"],
    ["settings.manage", "Settings", "manage", "Kelola settings"],
    ["audit.view", "Audit", "view", "Lihat audit log"],
  ];
  const insertPermission = db.prepare(
    "INSERT OR IGNORE INTO permissions(id,module,action,label) VALUES(?,?,?,?)",
  );
  for (const permission of permissions) insertPermission.run(...permission);
  const allPermissionIds = permissions.map((p) => p[0]);
  const rolePermissionMap = {
    "role-admin": allPermissionIds,
    "role-supervisor": [
      "dashboard.view",
      "batches.execute",
      "batches.override",
      "batches.view_all",
      "reports.view",
      "reports.export",
      "audit.view",
    ],
    "role-operator": ["batches.execute"],
    "role-viewer": [
      "dashboard.view",
      "batches.view_all",
      "reports.view",
      "reports.export",
    ],
  };
  const insertRolePermission = db.prepare(
    "INSERT OR IGNORE INTO role_permissions(role_id,permission_id,allowed) VALUES(?,?,1)",
  );
  for (const [roleId, ids] of Object.entries(rolePermissionMap))
    for (const permissionId of ids)
      insertRolePermission.run(roleId, permissionId);

  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count === 0) {
    const insertUser = db.prepare(
      "INSERT INTO users(id,username,name,role_id,password_hash,status,shift,employee_no) VALUES(?,?,?,?,?,?,?,?)",
    );
    insertUser.run(
      "user-admin", "suganda", "Suganda",
      "role-admin",
      hashPassword("automova"),
      "Active",
      "Office",
      "ADM-001",
    );
    insertUser.run(
      "user-supervisor", "yogi", "Yogi",
      "role-supervisor",
      hashPassword("automova"),
      "Active",
      "Shift 2",
      "SPV-002",
    );
    insertUser.run(
      "user-budi", "budi", "Budi",
      "role-operator",
      hashPassword("automova"),
      "Active",
      "Shift 2",
      "OPR-014",
    );
    insertUser.run(
      "user-rina",
      "rina",
      "Rina Melati",
      "role-operator",
      hashPassword("automova"),
      "Active",
      "Shift 2",
      "OPR-008",
    );
    insertUser.run(
      "user-agus",
      "agus",
      "Agus Setiawan",
      "role-operator",
      hashPassword("automova"),
      "Active",
      "Shift 1",
      "OPR-011",
    );
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM master_shifts").get().count === 0) {
    const insertShift = db.prepare("INSERT INTO master_shifts(id,name,status) VALUES(?,?,?)");
    [
      ["shift-1", "Shift 1 (06:00 - 14:00)", "Active"],
      ["shift-2", "Shift 2 (14:00 - 22:00)", "Active"],
      ["shift-3", "Shift 3 (22:00 - 06:00)", "Active"]
    ].forEach((row) => insertShift.run(...row));
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM master_areas").get().count === 0) {
    const insertArea = db.prepare("INSERT INTO master_areas(id,name,status) VALUES(?,?,?)");
    [
      ["area-1", "Produksi Cair", "Active"],
      ["area-2", "Produksi Padat", "Active"],
      ["area-3", "Packaging", "Active"]
    ].forEach((row) => insertArea.run(...row));
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM master_lines").get().count === 0) {
    const insertLine = db.prepare("INSERT INTO master_lines(id,name,area_id,status) VALUES(?,?,?,?)");
    [
      ["line-1", "Line 1 - Liquid", "area-1", "Active"],
      ["line-2", "Line 2 - Liquid", "area-1", "Active"],
      ["line-3", "Line 3 - Powder", "area-2", "Active"]
    ].forEach((row) => insertLine.run(...row));
  }

  if (db.prepare("SELECT COUNT(*) AS count FROM master_units").get().count === 0) {
    const insertUnit = db.prepare("INSERT INTO master_units(id,name,status) VALUES(?,?,?)");
    [
      ["unit-1", "Kg", "Active"],
      ["unit-2", "Liter", "Active"],
      ["unit-3", "Pcs", "Active"],
      ["unit-4", "Gram", "Active"],
      ["unit-5", "Ml", "Active"]
    ].forEach((row) => insertUnit.run(...row));
  }




  db.prepare(
    "INSERT OR IGNORE INTO settings(key,value) VALUES('operator_popup_global',?)",
  ).run(
    JSON.stringify({
      enabled: true,
      title: "Pengingat sebelum bekerja",
      message:
        "Pastikan APD lengkap, baca kembali SOP, dan awali pekerjaan dengan berdoa sesuai keyakinan masing-masing.",
      requireAcknowledge: true,
    }),
  );
  db.prepare(
    "INSERT OR IGNORE INTO settings(key,value) VALUES('supervisor_cancel_pin_hash',?)",
  ).run(hashPassword("2468"));
  db.prepare(
    "INSERT OR IGNORE INTO settings(key,value) VALUES('supervisor_cancel_pin_plain',?)",
  ).run("2468");
  db.prepare(
    "INSERT OR IGNORE INTO settings(key,value) VALUES('admin_pin_hash',?)",
  ).run(hashPassword("1357"));
  db.prepare(
    "INSERT OR IGNORE INTO settings(key,value) VALUES('admin_pin_plain',?)",
  ).run("1357");

}
seed();

const json = (res, status, payload) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Payload terlalu besar");
  }
  return body ? JSON.parse(body) : {};
};

const listJobs = () =>
  db
    .prepare("SELECT * FROM jobs ORDER BY updated_at DESC")
    .all()
    .map((job) => ({
      ...job,
      popup_enabled: Boolean(job.popup_enabled),
      materials: db
        .prepare(
          `SELECT jm.id,jm.material_id,m.code,jm.name,jm.qty,jm.unit,jm.sequence,
          COALESCE(m.unit_price,0) AS unit_price,COALESCE(m.currency,'IDR') AS currency,
          ROUND(jm.qty*COALESCE(m.unit_price,0),2) AS line_cost
          FROM job_materials jm LEFT JOIN materials m ON m.id=jm.material_id
          WHERE jm.job_id=? ORDER BY jm.sequence`,
        )
        .all(job.id),
      packagings: db
        .prepare(
          `SELECT jp.id,jp.packaging_id,p.code,jp.name,jp.qty,jp.unit,jp.sequence,
          COALESCE(p.unit_price,0) AS unit_price,COALESCE(p.currency,'IDR') AS currency,
          ROUND(jp.qty*COALESCE(p.unit_price,0),2) AS line_cost
          FROM job_packagings jp LEFT JOIN master_packaging p ON p.id=jp.packaging_id
          WHERE jp.job_id=? ORDER BY jp.sequence`,
        )
        .all(job.id),
       steps: db
        .prepare(
          "SELECT id,step_no,title,instruction,warning,duration_seconds,action_label,notes_required,yes_target,no_target,sound_completed_id,sound_warning_id,allow_overdrive,loop_warning FROM job_steps WHERE job_id=? ORDER BY step_no",
        )
        .all(job.id)
        .map((step) => ({
          ...step,
          duration: step.duration_seconds,
          action: step.action_label,
          notes_required: Boolean(step.notes_required),
          allow_overdrive: step.allow_overdrive !== 0,
          loop_warning: step.loop_warning !== 0,
        })),
    }))
    .map((job) => ({
      ...job,
      estimated_material_cost: job.materials.reduce(
        (sum, material) => sum + Number(material.line_cost || 0),
        0,
      ),
    }));

const dateRange = (url) => {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    from: url.searchParams.get("from") || today,
    to: url.searchParams.get("to") || today,
  };
};

const batchWhere = (url) => {
  const { from, to } = dateRange(url);
  const clauses = ["date(started_at, '+7 hours') BETWEEN date(?) AND date(?)"];
  const values = [from, to];
  for (const [parameter, column] of [
    ["status", "status"],
    ["job", "job_id"],
    ["operator", "operator_id"],
  ]) {
    const value = url.searchParams.get(parameter);
    if (value) {
      clauses.push(`${column}=?`);
      values.push(value);
    }
  }
  return { from, to, sql: clauses.join(" AND "), values };
};

function saveJob(job, id = job.id || randomUUID()) {
  const existing = db.prepare("SELECT id FROM jobs WHERE id=?").get(id);
  if (existing)
    db.prepare(
      "UPDATE jobs SET name=?,product=?,product_code=?,target=?,unit=?,shift=?,area=?,line=?,version=?,status=?,popup_enabled=?,popup_title=?,popup_message=?,sound_step_completed_id=?,sound_job_completed_id=?,sound_paused_id=?,sound_stopped_id=?,allow_overdrive=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(
      job.name,
      job.product,
      job.product_code || "",
      Number(job.target),
      job.unit,
      job.shift,
      job.area,
      job.line,
      Number(job.version || 1),
      job.status || "Draft",
      job.popup_enabled ? 1 : 0,
      job.popup_title || "",
      job.popup_message || "",
      job.sound_step_completed_id || null,
      job.sound_job_completed_id || null,
      job.sound_paused_id || null,
      job.sound_stopped_id || null,
      job.allow_overdrive !== false && job.allow_overdrive !== 0 ? 1 : 0,
      id,
    );
  else
    db.prepare(
      "INSERT INTO jobs(id,name,product,product_code,target,unit,shift,area,line,version,status,popup_enabled,popup_title,popup_message,sound_step_completed_id,sound_job_completed_id,sound_paused_id,sound_stopped_id,allow_overdrive) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      job.name,
      job.product,
      job.product_code || "",
      Number(job.target),
      job.unit,
      job.shift,
      job.area,
      job.line,
      Number(job.version || 1),
      job.status || "Draft",
      job.popup_enabled ? 1 : 0,
      job.popup_title || "",
      job.popup_message || "",
      job.sound_step_completed_id || null,
      job.sound_job_completed_id || null,
      job.sound_paused_id || null,
      job.sound_stopped_id || null,
      job.allow_overdrive !== false && job.allow_overdrive !== 0 ? 1 : 0,
    );
  db.prepare("DELETE FROM job_materials WHERE job_id=?").run(id);
  db.prepare("DELETE FROM job_packagings WHERE job_id=?").run(id);
  db.prepare("DELETE FROM job_steps WHERE job_id=?").run(id);
  const materialStmt = db.prepare(
    "INSERT INTO job_materials(id,job_id,material_id,name,qty,unit,sequence) VALUES(?,?,?,?,?,?,?)",
  );
  (job.materials || []).forEach((material, index) =>
    materialStmt.run(
      randomUUID(),
      id,
      material.material_id || null,
      material.name,
      Number(material.qty),
      material.unit,
      index + 1,
    ),
  );
  const packagingStmt = db.prepare(
    "INSERT INTO job_packagings(id,job_id,packaging_id,name,qty,unit,sequence) VALUES(?,?,?,?,?,?,?)",
  );
  (job.packagings || []).forEach((packaging, index) =>
    packagingStmt.run(
      randomUUID(),
      id,
      packaging.packaging_id || packaging.id || null, // handle both formats just in case
      packaging.name,
      Number(packaging.qty),
      packaging.unit || "Pcs",
      index + 1,
    ),
  );
  const stepStmt = db.prepare(
    "INSERT INTO job_steps(id,job_id,step_no,title,instruction,warning,duration_seconds,action_label,notes_required,yes_target,no_target,sound_completed_id,sound_warning_id,allow_overdrive,loop_warning) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  (job.steps || []).forEach((step, index) =>
    stepStmt.run(
      randomUUID(),
      id,
      index + 1,
      step.title,
      step.instruction,
      step.warning || "",
      Number(step.duration_seconds ?? step.duration ?? 0),
      step.action_label ?? step.action ?? "Selesai",
      step.notes_required ? 1 : 0,
      step.yes_target || "next",
      step.no_target || "paused",
      step.sound_completed_id || null,
      step.sound_warning_id || null,
      step.allow_overdrive !== false ? 1 : 0,
      step.loop_warning !== false ? 1 : 0,
    ),
  );
  return id;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "localhost"}`,
  );
  const path = url.pathname;
  try {
    if (path === "/api/health" && req.method === "GET") {
      const os = await import("node:os");
      const interfaces = os.networkInterfaces();
      const ips = [];
      for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
          if (net.family === "IPv4" && !net.internal) {
            ips.push({ name, address: net.address });
          }
        }
      }
      return json(res, 200, {
        ok: true,
        database: databasePath,
        time: new Date().toISOString(),
        ips,
      });
    }

    if (path === "/api/auth/login" && req.method === "POST") {
      const body = await readBody(req);
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!username || !password)
        return json(res, 400, { error: "Username dan password wajib diisi" });
      const user = db
        .prepare(
          "SELECT u.id,u.username,u.name,u.role_id,u.password_hash,u.status,u.shift,u.employee_no,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.username=?",
        )
        .get(username);
      if (!user || !verifyPassword(password, user.password_hash))
        return json(res, 401, { error: "Username atau password salah" });
      if (user.status !== "Active")
        return json(res, 403, { error: "Akun tidak aktif. Hubungi Administrator." });
      const permissions = db
        .prepare(
          "SELECT permission_id FROM role_permissions WHERE role_id=? AND allowed=1",
        )
        .all(user.role_id)
        .map((p) => p.permission_id);
      return json(res, 200, {
        data: {
          id: user.id,
          username: user.username,
          name: user.name,
          role_id: user.role_id,
          role_name: user.role_name,
          shift: user.shift,
          employee_no: user.employee_no,
          permissions,
        },
      });
    }

    if (path === "/api/auth/pins" && req.method === "GET") {
      const supervisorPin = db.prepare("SELECT value FROM settings WHERE key='supervisor_cancel_pin_plain'").get()?.value || "2468";
      const adminPin = db.prepare("SELECT value FROM settings WHERE key='admin_pin_plain'").get()?.value || "1357";
      return json(res, 200, { supervisorPin, adminPin });
    }

    if (path === "/api/supervisor/verify-pin" && req.method === "POST") {
      const body = await readBody(req);
      const pin = String(body.pin || "");
      if (!pin)
        return json(res, 400, { error: "PIN wajib diisi" });
      const pinHash = db
        .prepare(
          "SELECT value FROM settings WHERE key='supervisor_cancel_pin_hash'",
        )
        .get()?.value;
      const adminPinHash = db
        .prepare(
          "SELECT value FROM settings WHERE key='admin_pin_hash'",
        )
        .get()?.value;
      const spvOk = pinHash && verifyPassword(pin, pinHash);
      const adminOk = adminPinHash && verifyPassword(pin, adminPinHash);
      if (!spvOk && !adminOk)
        return json(res, 403, { error: "PIN Supervisor atau Administrator tidak sesuai" });
      return json(res, 200, { ok: true });
    }

    if (path === "/api/supervisor/change-pin" && req.method === "POST") {
      const body = await readBody(req);
      const currentPin = String(body.currentPin || "");
      const newPin = String(body.newPin || "");
      if (!currentPin || !newPin) {
        return json(res, 400, { error: "PIN saat ini dan PIN baru wajib diisi" });
      }
      const pinHash = db
        .prepare(
          "SELECT value FROM settings WHERE key='supervisor_cancel_pin_hash'",
        )
        .get()?.value;
      if (!pinHash || !verifyPassword(currentPin, pinHash)) {
        return json(res, 403, { error: "PIN Supervisor saat ini tidak sesuai" });
      }
      if (newPin.length < 4) {
        return json(res, 400, { error: "PIN baru minimal harus 4 digit" });
      }
      const newHash = hashPassword(newPin);
      db.prepare(
        "UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='supervisor_cancel_pin_hash'"
      ).run(newHash);
      db.prepare(
        "INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('supervisor_cancel_pin_plain',?,CURRENT_TIMESTAMP)"
      ).run(newPin);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/admin/change-pin" && req.method === "POST") {
      const body = await readBody(req);
      const currentPin = String(body.currentPin || "");
      const newPin = String(body.newPin || "");
      if (!currentPin || !newPin) {
        return json(res, 400, { error: "PIN saat ini dan PIN baru wajib diisi" });
      }
      const pinHash = db
        .prepare(
          "SELECT value FROM settings WHERE key='admin_pin_hash'",
        )
        .get()?.value;
      if (!pinHash || !verifyPassword(currentPin, pinHash)) {
        return json(res, 403, { error: "PIN Administrator saat ini tidak sesuai" });
      }
      if (newPin.length < 4) {
        return json(res, 400, { error: "PIN baru minimal harus 4 digit" });
      }
      const newHash = hashPassword(newPin);
      db.prepare(
        "UPDATE settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='admin_pin_hash'"
      ).run(newHash);
      db.prepare(
        "INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('admin_pin_plain',?,CURRENT_TIMESTAMP)"
      ).run(newPin);
      return json(res, 200, { ok: true });
    }

    const masterMatch = path.match(/^\/api\/(master_shifts|master_areas|master_lines|master_units|master_packaging)(?:\/([^/]+))?$/);
    if (masterMatch) {
      const table = masterMatch[1];
      const idParam = masterMatch[2];

      if (!idParam && req.method === "GET") {
        if (table === "master_packaging") {
          return json(res, 200, {
            data: db.prepare(`SELECT m.*, COALESCE(SUM(CASE WHEN mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.qty WHEN mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -mm.qty ELSE 0 END),0) AS initial_stock FROM ${table} m LEFT JOIN packaging_movements mm ON mm.packaging_id=m.id GROUP BY m.id ORDER BY m.name`).all(),
          });
        }
        return json(res, 200, {
          data: db.prepare(`SELECT * FROM ${table} ORDER BY name`).all(),
        });
      }
      
      if (!idParam && req.method === "POST") {
        const body = await readBody(req);
        const id = body.id || randomUUID();
        if (table === "master_lines") {
          db.prepare(`INSERT INTO ${table}(id, name, area_id, status) VALUES(?,?,?,?)`)
            .run(id, body.name, body.area_id || null, body.status || "Active");
        } else if (table === "master_packaging") {
          db.prepare(`INSERT INTO ${table}(id, code, name, default_qty, unit, unit_price, currency, status, notes, min_sku) VALUES(?,?,?,?,?,?,?,?,?,?)`)
            .run(id, body.code || "", body.name, Number(body.default_qty || 0), body.unit || "Pcs", Number(body.unit_price || 0), body.currency || "IDR", body.status || "Active", body.notes || "", Number(body.min_sku || 0));
          if (Number(body.initial_stock || 0) > 0) {
            db.prepare("INSERT INTO packaging_movements(id,packaging_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
              .run(randomUUID(), id, "IN", Number(body.initial_stock), body.unit || "Pcs", Number(body.unit_price || 0), Number(body.initial_stock) * Number(body.unit_price || 0), body.currency || "IDR", new Date().toISOString(), "Initial Stock", "", "", "System");
          }
          checkPackagingStockWarning(id);
        } else {
          db.prepare(`INSERT INTO ${table}(id, name, status) VALUES(?,?,?)`)
            .run(id, body.name, body.status || "Active");
        }
        return json(res, 200, { ok: true, id });
      }
      
      if (idParam && req.method === "PUT") {
        const body = await readBody(req);
        if (table === "master_lines") {
          db.prepare(`UPDATE ${table} SET name=?, area_id=?, status=? WHERE id=?`)
            .run(body.name, body.area_id || null, body.status || "Active", idParam);
        } else if (table === "master_packaging") {
          db.prepare(`UPDATE ${table} SET code=?, name=?, default_qty=?, unit=?, unit_price=?, currency=?, status=?, notes=?, min_sku=? WHERE id=?`)
            .run(body.code || "", body.name, Number(body.default_qty || 0), body.unit || "Pcs", Number(body.unit_price || 0), body.currency || "IDR", body.status || "Active", body.notes || "", Number(body.min_sku || 0), idParam);
          
          if (body.initial_stock !== undefined) {
            const currentStock = Number(
              db
                .prepare(
                  "SELECT COALESCE(SUM(CASE WHEN movement_type IN ('IN','ADJUSTMENT_IN') THEN qty WHEN movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -qty ELSE 0 END),0) AS total FROM packaging_movements WHERE packaging_id=?",
                )
                .get(idParam)?.total || 0,
            );
            const newStock = Number(body.initial_stock);
            if (currentStock !== newStock) {
              const diff = newStock - currentStock;
              const movementType = diff > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
              const qty = Math.abs(diff);
              db.prepare(
                "INSERT INTO packaging_movements(id,packaging_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
              ).run(
                randomUUID(),
                idParam,
                movementType,
                qty,
                body.unit || "Pcs",
                Number(body.unit_price || 0),
                qty * Number(body.unit_price || 0),
                body.currency || "IDR",
                new Date().toISOString(),
                "Penyesuaian Master",
                "SYSTEM-MASTER-EDIT",
                "Diubah dari form edit Packaging Master",
                body.actor || "Administrator",
              );
            }
          }
          checkPackagingStockWarning(idParam);
        } else {
          db.prepare(`UPDATE ${table} SET name=?, status=? WHERE id=?`)
            .run(body.name, body.status || "Active", idParam);
        }
        return json(res, 200, { ok: true });
      }

      if (idParam && req.method === "DELETE") {
        if (table === "master_packaging") {
          db.prepare(`DELETE FROM packaging_movements WHERE packaging_id=?`).run(idParam);
          db.prepare(`DELETE FROM job_packagings WHERE packaging_id=?`).run(idParam);
        }
        db.prepare(`DELETE FROM ${table} WHERE id=?`).run(idParam);
        return json(res, 200, { ok: true });
      }
    }

    if (path === "/api/materials" && req.method === "GET")
      return json(res, 200, {
        data: db.prepare(`SELECT m.*, COALESCE(SUM(CASE WHEN mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.qty WHEN mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -mm.qty ELSE 0 END),0) AS initial_stock FROM materials m LEFT JOIN material_movements mm ON mm.material_id=m.id GROUP BY m.id ORDER BY m.name`).all(),
      });
    if (path === "/api/materials" && req.method === "POST") {
      const body = await readBody(req);
      const id = body.id || randomUUID();
      db.prepare(
        "INSERT INTO materials(id,code,name,default_qty,unit,unit_price,currency,status,notes,min_sku) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        body.code,
        body.name,
        Number(body.default_qty || 0),
        body.unit,
        Number(body.unit_price || 0),
        body.currency || "IDR",
        body.status || "Active",
        body.notes || "",
        Number(body.min_sku || 0),
      );
      if (Number(body.initial_stock || 0) > 0) {
        db.prepare(
          "INSERT INTO material_movements(id,material_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          randomUUID(),
          id,
          "IN",
          Number(body.initial_stock),
          body.unit,
          Number(body.unit_price || 0),
          Number(body.initial_stock) * Number(body.unit_price || 0),
          body.currency || "IDR",
          new Date().toISOString(),
          "Stok Awal (Initial Stock)",
          "SYSTEM-INIT",
          "Diinput saat pembuatan master material",
          "Administrator"
        );
      }
      db.prepare(
        "INSERT INTO material_price_history(id,material_id,unit_price,currency,effective_at,notes,actor) VALUES(?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        id,
        Number(body.unit_price || 0),
        body.currency || "IDR",
        body.price_effective_at || new Date().toISOString(),
        "Harga awal material",
        body.actor || "Administrator",
      );
      checkMaterialStockWarning(id);
      return json(res, 201, { id });
    }
    const materialPriceMatch = path.match(
      /^\/api\/materials\/([^/]+)\/prices$/,
    );
    if (materialPriceMatch && req.method === "GET")
      return json(res, 200, {
        data: db
          .prepare(
            "SELECT * FROM material_price_history WHERE material_id=? ORDER BY effective_at DESC,created_at DESC",
          )
          .all(materialPriceMatch[1]),
      });
    const materialMatch = path.match(/^\/api\/materials\/([^/]+)$/);
    if (materialMatch && req.method === "PUT") {
      const body = await readBody(req);
      const previous = db
        .prepare("SELECT unit_price,currency FROM materials WHERE id=?")
        .get(materialMatch[1]);
      db.prepare(
        "UPDATE materials SET code=?,name=?,default_qty=?,unit=?,unit_price=?,currency=?,status=?,notes=?,min_sku=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        body.code,
        body.name,
        Number(body.default_qty || 0),
        body.unit,
        Number(body.unit_price || 0),
        body.currency || "IDR",
        body.status || "Active",
        body.notes || "",
        Number(body.min_sku || 0),
        materialMatch[1],
      );
      if (
        !previous ||
        Number(previous.unit_price) !== Number(body.unit_price || 0) ||
        previous.currency !== (body.currency || "IDR")
      )
        db.prepare(
          "INSERT INTO material_price_history(id,material_id,unit_price,currency,effective_at,notes,actor) VALUES(?,?,?,?,?,?,?)",
        ).run(
          randomUUID(),
          materialMatch[1],
          Number(body.unit_price || 0),
          body.currency || "IDR",
          body.price_effective_at || new Date().toISOString(),
          body.price_notes || "Perubahan harga dari Material Master",
          body.actor || "Administrator",
        );
        
      if (body.initial_stock !== undefined) {
        const currentStock = Number(
          db
            .prepare(
              "SELECT COALESCE(SUM(CASE WHEN movement_type IN ('IN','ADJUSTMENT_IN') THEN qty WHEN movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -qty ELSE 0 END),0) AS total FROM material_movements WHERE material_id=?",
            )
            .get(materialMatch[1])?.total || 0,
        );
        const newStock = Number(body.initial_stock);
        if (currentStock !== newStock) {
          const diff = newStock - currentStock;
          const movementType = diff > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
          const qty = Math.abs(diff);
          db.prepare(
            "INSERT INTO material_movements(id,material_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            randomUUID(),
            materialMatch[1],
            movementType,
            qty,
            body.unit,
            Number(body.unit_price || 0),
            qty * Number(body.unit_price || 0),
            body.currency || "IDR",
            new Date().toISOString(),
            "Penyesuaian Master",
            "SYSTEM-MASTER-EDIT",
            "Diubah dari form edit Material Master",
            body.actor || "Administrator",
          );
        }
      }
      checkMaterialStockWarning(materialMatch[1]);
      return json(res, 200, { ok: true });
    }
    if (materialMatch && req.method === "DELETE") {
      db.prepare("DELETE FROM material_movements WHERE material_id=?").run(materialMatch[1]);
      db.prepare("DELETE FROM material_price_history WHERE material_id=?").run(materialMatch[1]);
      db.prepare("DELETE FROM job_materials WHERE material_id=?").run(materialMatch[1]);
      db.prepare("DELETE FROM materials WHERE id=?").run(materialMatch[1]);
      return json(res, 200, { ok: true, deleted: true });
    }

    if (path === "/api/users" && req.method === "GET")
      return json(res, 200, {
        data: db
          .prepare(
            "SELECT u.id,u.username,u.name,u.role_id,r.name AS role_name,u.status,u.shift,u.employee_no,u.created_at,u.updated_at FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.name",
          )
          .all(),
      });
    if (path === "/api/users" && req.method === "POST") {
      const body = await readBody(req);
      const id = body.id || randomUUID();
      db.prepare(
        "INSERT INTO users(id,username,name,role_id,password_hash,status,shift,employee_no) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        id,
        body.username,
        body.name,
        body.role_id,
        hashPassword(body.password || "automova"),
        body.status || "Active",
        body.shift || "",
        body.employee_no || "",
      );
      return json(res, 201, { id });
    }
    const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && req.method === "GET") {
      const user = db
        .prepare(
          "SELECT u.id,u.username,u.name,u.role_id,u.status,u.shift,u.employee_no,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?",
        )
        .get(userMatch[1]);
      if (!user) return json(res, 404, { error: "User tidak ditemukan" });
      const permissions = db
        .prepare(
          "SELECT permission_id FROM role_permissions WHERE role_id=? AND allowed=1",
        )
        .all(user.role_id)
        .map((p) => p.permission_id);
      return json(res, 200, {
        data: {
          id: user.id,
          username: user.username,
          name: user.name,
          role_id: user.role_id,
          role_name: user.role_name,
          shift: user.shift,
          employee_no: user.employee_no,
          permissions,
        },
      });
    }
    if (userMatch && req.method === "PUT") {
      const body = await readBody(req);
      if (body.password)
        db.prepare(
          "UPDATE users SET username=?,name=?,role_id=?,password_hash=?,status=?,shift=?,employee_no=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(
          body.username,
          body.name,
          body.role_id,
          hashPassword(body.password),
          body.status,
          body.shift || "",
          body.employee_no || "",
          userMatch[1],
        );
      else
        db.prepare(
          "UPDATE users SET username=?,name=?,role_id=?,status=?,shift=?,employee_no=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(
          body.username,
          body.name,
          body.role_id,
          body.status,
          body.shift || "",
          body.employee_no || "",
          userMatch[1],
        );
      return json(res, 200, { ok: true });
    }
    if (userMatch && req.method === "DELETE") {
      db.prepare("DELETE FROM users WHERE id=?").run(userMatch[1]);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/roles" && req.method === "GET") {
      const permissions = db
        .prepare("SELECT * FROM permissions ORDER BY module,label")
        .all();
      const roles = db
        .prepare("SELECT * FROM roles ORDER BY is_system DESC,name")
        .all()
        .map((role) => ({
          ...role,
          permissions: db
            .prepare(
              "SELECT permission_id FROM role_permissions WHERE role_id=? AND allowed=1",
            )
            .all(role.id)
            .map((p) => p.permission_id),
        }));
      return json(res, 200, { data: roles, permissions });
    }
    if (path === "/api/roles" && req.method === "POST") {
      const body = await readBody(req);
      const id = body.id || randomUUID();
      db.prepare(
        "INSERT INTO roles(id,name,description,is_system) VALUES(?,?,?,0)",
      ).run(id, body.name, body.description || "");
      return json(res, 201, { id });
    }
    const rolePermissionMatch = path.match(
      /^\/api\/roles\/([^/]+)\/permissions$/,
    );
    if (rolePermissionMatch && req.method === "PUT") {
      const body = await readBody(req);
      db.prepare("DELETE FROM role_permissions WHERE role_id=?").run(
        rolePermissionMatch[1],
      );
      const stmt = db.prepare(
        "INSERT INTO role_permissions(role_id,permission_id,allowed) VALUES(?,?,1)",
      );
      (body.permissions || []).forEach((id) =>
        stmt.run(rolePermissionMatch[1], id),
      );
      return json(res, 200, { ok: true });
    }
    const roleMatch = path.match(/^\/api\/roles\/([^/]+)$/);
    if (roleMatch && req.method === "PUT") {
      const body = await readBody(req);
      db.prepare(
        "UPDATE roles SET name=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(body.name, body.description || "", roleMatch[1]);
      return json(res, 200, { ok: true });
    }
    if (roleMatch && req.method === "DELETE") {
      const role = db
        .prepare("SELECT is_system FROM roles WHERE id=?")
        .get(roleMatch[1]);
      if (!role) return json(res, 404, { error: "Role tidak ditemukan" });
      if (role.is_system)
        return json(res, 409, { error: "Role bawaan tidak dapat dihapus" });
      const assigned = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role_id=?")
        .get(roleMatch[1]).count;
      if (assigned)
        return json(res, 409, {
          error: "Role masih digunakan oleh user dan tidak dapat dihapus",
        });
      db.prepare("DELETE FROM role_permissions WHERE role_id=?").run(
        roleMatch[1],
      );
      db.prepare("DELETE FROM roles WHERE id=?").run(roleMatch[1]);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/jobs" && req.method === "GET")
      return json(res, 200, { data: listJobs() });
    if (path === "/api/jobs" && req.method === "POST") {
      const body = await readBody(req);
      const id = saveJob(body);
      return json(res, 201, { id });
    }
    const publishMatch = path.match(/^\/api\/jobs\/([^/]+)\/publish$/);
    if (publishMatch && req.method === "POST") {
      db.prepare(
        "UPDATE jobs SET status='Published',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(publishMatch[1]);
      return json(res, 200, { ok: true });
    }
    const jobMatch = path.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobMatch && req.method === "PUT") {
      const body = await readBody(req);
      saveJob(body, jobMatch[1]);
      return json(res, 200, { ok: true });
    }
    if (jobMatch && req.method === "DELETE") {
      db.prepare("DELETE FROM jobs WHERE id=?").run(jobMatch[1]);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/settings/operator-popup" && req.method === "GET")
      return json(res, 200, {
        data: JSON.parse(
          db
            .prepare(
              "SELECT value FROM settings WHERE key='operator_popup_global'",
            )
            .get()?.value || "{}",
        ),
      });
    if (path === "/api/settings/operator-popup" && req.method === "PUT") {
      const body = await readBody(req);
      db.prepare(
        "INSERT INTO settings(key,value,updated_at) VALUES('operator_popup_global',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",
      ).run(JSON.stringify(body));
      return json(res, 200, { ok: true });
    }

    if (path === "/api/settings/backup" && req.method === "GET") {
      const lastTime = db.prepare("SELECT value FROM settings WHERE key='last_backup_time'").get()?.value || "";
      const lastFile = db.prepare("SELECT value FROM settings WHERE key='last_backup_file'").get()?.value || "";
      const lastSize = db.prepare("SELECT value FROM settings WHERE key='last_backup_size'").get()?.value || "";
      const files = readdirSync(backupsDir)
        .filter((f) => f.startsWith("automova_backup_") && f.endsWith(".sqlite"))
        .map((f) => {
          const s = statSync(resolve(backupsDir, f));
          return {
            filename: f,
            size_mb: (s.size / (1024 * 1024)).toFixed(2),
            created_at: s.birthtime.toISOString(),
          };
        })
        .reverse();
      return json(res, 200, {
        ok: true,
        last_backup_time: lastTime,
        last_backup_file: lastFile,
        last_backup_size: lastSize,
        total_backups: files.length,
        backups: files,
      });
    }

    if (path === "/api/settings/backup" && req.method === "POST") {
      const result = performBackup("manual_user_trigger");
      return json(res, 200, result);
    }

    if (path.startsWith("/api/settings/backup/download/") && req.method === "GET") {
      const filename = path.replace("/api/settings/backup/download/", "");
      const safeFile = resolve(backupsDir, filename);
      if (existsSync(safeFile) && safeFile.startsWith(backupsDir)) {
        const fileStream = readFileSync(safeFile);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
        });
        return res.end(fileStream);
      }
      return json(res, 404, { error: "Backup file not found" });
    }

    if (path === "/api/material-movements" && req.method === "GET") {
      const { from, to } = dateRange(url);
      const clauses = ["date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?)"];
      const values = [from, to];
      const material = url.searchParams.get("material");
      const type = url.searchParams.get("type");
      if (material) {
        clauses.push("mm.material_id=?");
        values.push(material);
      }
      if (type) {
        clauses.push("mm.movement_type=?");
        values.push(type);
      }
      return json(res, 200, {
        data: db
          .prepare(
            `SELECT mm.*,m.code AS material_code,m.name AS material_name
            FROM material_movements mm JOIN materials m ON m.id=mm.material_id
            WHERE ${clauses.join(" AND ")} ORDER BY mm.occurred_at DESC,mm.created_at DESC`,
          )
          .all(...values),
        summary: db
          .prepare(
            `SELECT m.id,m.code,m.name,m.unit,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.qty ELSE 0 END),0) AS qty_in,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN mm.qty ELSE 0 END),0) AS qty_out,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.total_cost ELSE 0 END),0) AS cost_in,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN mm.total_cost ELSE 0 END),0) AS cost_out,
            COALESCE(SUM(CASE WHEN mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.qty WHEN mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -mm.qty ELSE 0 END),0) AS balance
            FROM materials m LEFT JOIN material_movements mm ON mm.material_id=m.id
            GROUP BY m.id ORDER BY m.name`,
          )
          .all(from, to, from, to, from, to, from, to),
        range: { from, to },
      });
    }
    if (path === "/api/material-movements" && req.method === "POST") {
      const body = await readBody(req);
      const material = db
        .prepare("SELECT * FROM materials WHERE id=?")
        .get(body.material_id);
      if (!material)
        return json(res, 404, { error: "Material tidak ditemukan" });
      const allowedTypes = ["IN", "OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"];
      if (!allowedTypes.includes(body.movement_type))
        return json(res, 400, { error: "Jenis pergerakan tidak valid" });
      if (!(Number(body.qty) > 0))
        return json(res, 400, { error: "Jumlah harus lebih dari 0" });
      const id = body.id || randomUUID();
      const unitCost = Number(body.unit_cost ?? material.unit_price ?? 0);
      db.prepare(
        "INSERT INTO material_movements(id,material_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,job_id,batch_id,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        body.material_id,
        body.movement_type,
        Number(body.qty),
        body.unit || material.unit,
        unitCost,
        Number(body.qty) * unitCost,
        body.currency || material.currency || "IDR",
        body.occurred_at || new Date().toISOString(),
        body.purpose || "",
        body.job_id || null,
        body.batch_id || null,
        body.reference || "",
        body.notes || "",
        body.actor || "Administrator",
      );
      checkMaterialStockWarning(body.material_id);
      return json(res, 201, { id });
    }
    const movementMatch = path.match(/^\/api\/material-movements\/([^/]+)$/);
    if (movementMatch && req.method === "PUT") {
      const body = await readBody(req);
      const material = db.prepare("SELECT * FROM materials WHERE id=?").get(body.material_id);
      if (!material) return json(res, 404, { error: "Material tidak ditemukan" });
      const allowedTypes = ["IN", "OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"];
      if (!allowedTypes.includes(body.movement_type)) return json(res, 400, { error: "Jenis pergerakan tidak valid" });
      if (!(Number(body.qty) > 0)) return json(res, 400, { error: "Jumlah harus lebih dari 0" });
      const unitCost = Number(body.unit_cost ?? material.unit_price ?? 0);
      db.prepare(
        "UPDATE material_movements SET material_id=?,movement_type=?,qty=?,unit=?,unit_cost=?,total_cost=?,currency=?,occurred_at=?,purpose=?,reference=?,notes=?,actor=? WHERE id=?"
      ).run(
        body.material_id,
        body.movement_type,
        Number(body.qty),
        body.unit || material.unit,
        unitCost,
        Number(body.qty) * unitCost,
        body.currency || material.currency || "IDR",
        body.occurred_at || new Date().toISOString(),
        body.purpose || "",
        body.reference || "",
        body.notes || "",
        body.actor || "Administrator",
        movementMatch[1]
      );
      checkMaterialStockWarning(body.material_id);
      return json(res, 200, { ok: true });
    }
    if (movementMatch && req.method === "DELETE") {
      const prev = db.prepare("SELECT material_id FROM material_movements WHERE id=?").get(movementMatch[1]);
      db.prepare("DELETE FROM material_movements WHERE id=?").run(movementMatch[1]);
      if (prev) checkMaterialStockWarning(prev.material_id);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/packaging-movements" && req.method === "GET") {
      const { from, to } = dateRange(url);
      const clauses = ["date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?)"];
      const values = [from, to];
      const packaging = url.searchParams.get("packaging");
      const type = url.searchParams.get("type");
      if (packaging) {
        clauses.push("mm.packaging_id=?");
        values.push(packaging);
      }
      if (type) {
        clauses.push("mm.movement_type=?");
        values.push(type);
      }
      return json(res, 200, {
        data: db
          .prepare(
            `SELECT mm.*,m.code AS packaging_code,m.name AS packaging_name
            FROM packaging_movements mm JOIN master_packaging m ON m.id=mm.packaging_id
            WHERE ${clauses.join(" AND ")} ORDER BY mm.occurred_at DESC,mm.created_at DESC`,
          )
          .all(...values),
        summary: db
          .prepare(
            `SELECT m.id,m.code,m.name,m.unit,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.qty ELSE 0 END),0) AS qty_in,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN mm.qty ELSE 0 END),0) AS qty_out,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.total_cost ELSE 0 END),0) AS cost_in,
            COALESCE(SUM(CASE WHEN date(mm.occurred_at, '+7 hours') BETWEEN date(?) AND date(?) AND mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN mm.total_cost ELSE 0 END),0) AS cost_out,
            COALESCE(SUM(CASE WHEN mm.movement_type IN ('IN','ADJUSTMENT_IN') THEN mm.qty WHEN mm.movement_type IN ('OUT','ADJUSTMENT_OUT') THEN -mm.qty ELSE 0 END),0) AS balance
            FROM master_packaging m LEFT JOIN packaging_movements mm ON mm.packaging_id=m.id
            GROUP BY m.id ORDER BY m.name`,
          )
          .all(from, to, from, to, from, to, from, to),
        range: { from, to },
      });
    }

    if (path === "/api/packaging-movements" && req.method === "POST") {
      const body = await readBody(req);
      const packaging = db
        .prepare("SELECT * FROM master_packaging WHERE id=?")
        .get(body.packaging_id);
      if (!packaging)
        return json(res, 404, { error: "Kemasan tidak ditemukan" });
      const allowedTypes = ["IN", "OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"];
      if (!allowedTypes.includes(body.movement_type))
        return json(res, 400, { error: "Jenis pergerakan tidak valid" });
      if (!(Number(body.qty) > 0))
        return json(res, 400, { error: "Jumlah harus lebih dari 0" });
      const id = body.id || randomUUID();
      const unitCost = Number(body.unit_cost ?? packaging.unit_price ?? 0);
      db.prepare(
        "INSERT INTO packaging_movements(id,packaging_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,job_id,batch_id,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        body.packaging_id,
        body.movement_type,
        Number(body.qty),
        body.unit || packaging.unit,
        unitCost,
        Number(body.qty) * unitCost,
        body.currency || packaging.currency || "IDR",
        body.occurred_at || new Date().toISOString(),
        body.purpose || "",
        body.job_id || null,
        body.batch_id || null,
        body.reference || "",
        body.notes || "",
        body.actor || "Administrator",
      );
      checkPackagingStockWarning(body.packaging_id);
      return json(res, 201, { id });
    }

    const pkgMovementMatch = path.match(/^\/api\/packaging-movements\/([^/]+)$/);
    if (pkgMovementMatch && req.method === "PUT") {
      const body = await readBody(req);
      const packaging = db.prepare("SELECT * FROM master_packaging WHERE id=?").get(body.packaging_id);
      if (!packaging) return json(res, 404, { error: "Kemasan tidak ditemukan" });
      const allowedTypes = ["IN", "OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"];
      if (!allowedTypes.includes(body.movement_type)) return json(res, 400, { error: "Jenis pergerakan tidak valid" });
      if (!(Number(body.qty) > 0)) return json(res, 400, { error: "Jumlah harus lebih dari 0" });
      const unitCost = Number(body.unit_cost ?? packaging.unit_price ?? 0);
      db.prepare(
        "UPDATE packaging_movements SET packaging_id=?,movement_type=?,qty=?,unit=?,unit_cost=?,total_cost=?,currency=?,occurred_at=?,purpose=?,reference=?,notes=?,actor=? WHERE id=?"
      ).run(
        body.packaging_id,
        body.movement_type,
        Number(body.qty),
        body.unit || packaging.unit,
        unitCost,
        Number(body.qty) * unitCost,
        body.currency || packaging.currency || "IDR",
        body.occurred_at || new Date().toISOString(),
        body.purpose || "",
        body.reference || "",
        body.notes || "",
        body.actor || "Administrator",
        pkgMovementMatch[1]
      );
      checkPackagingStockWarning(body.packaging_id);
      return json(res, 200, { ok: true });
    }
    if (pkgMovementMatch && req.method === "DELETE") {
      const prev = db.prepare("SELECT packaging_id FROM packaging_movements WHERE id=?").get(pkgMovementMatch[1]);
      db.prepare("DELETE FROM packaging_movements WHERE id=?").run(pkgMovementMatch[1]);
      if (prev) checkPackagingStockWarning(prev.packaging_id);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/finance" && req.method === "GET") {
      const { from, to } = dateRange(url);
      const clauses = [
        "date(started_at, '+7 hours') BETWEEN date(?) AND date(?)",
        "status='Completed'",
      ];
      const values = [from, to];
      const job = url.searchParams.get("job");
      if (job) {
        clauses.push("job_id=?");
        values.push(job);
      }
      const where = clauses.join(" AND ");
      const rows = db
        .prepare(
          `SELECT *,
          actual_material_cost-estimated_material_cost AS variance,
          CASE WHEN estimated_material_cost>0 THEN ROUND(100.0*(actual_material_cost-estimated_material_cost)/estimated_material_cost,2) ELSE 0 END AS variance_percent
          FROM batches WHERE ${where} ORDER BY started_at DESC`,
        )
        .all(...values);
      const summary = db
        .prepare(
          `SELECT COUNT(*) AS completed_batches,
          COALESCE(SUM(estimated_material_cost),0) AS estimated_cost,
          COALESCE(SUM(actual_material_cost),0) AS actual_cost,
          COALESCE(SUM(actual_material_cost-estimated_material_cost),0) AS variance,
          COALESCE(SUM(output),0) AS total_output,
          CASE WHEN SUM(output)>0 THEN ROUND(SUM(actual_material_cost)/SUM(output),2) ELSE 0 END AS cost_per_unit
          FROM batches WHERE ${where}`,
        )
        .get(...values);
      const breakdownClauses = [
        "date(b.started_at) BETWEEN date(?) AND date(?)",
        "b.status='Completed'",
        "mm.movement_type='OUT'",
      ];
      const breakdownValues = [from, to];
      if (job) {
        breakdownClauses.push("b.job_id=?");
        breakdownValues.push(job);
      }
      const materialBreakdown = db
        .prepare(
          `SELECT m.code,m.name,mm.unit,ROUND(SUM(mm.qty),3) AS qty,ROUND(SUM(mm.total_cost),2) AS cost
          FROM material_movements mm JOIN materials m ON m.id=mm.material_id JOIN batches b ON b.id=mm.batch_id
          WHERE ${breakdownClauses.join(" AND ")}
          GROUP BY m.id,mm.unit ORDER BY cost DESC`,
        )
        .all(...breakdownValues);
      return json(res, 200, {
        data: { rows, summary, material_breakdown: materialBreakdown },
        range: { from, to },
      });
    }

    if (path === "/api/dashboard" && req.method === "GET") {
      const { from, to } = dateRange(url);
      const values = [from, to];
      const condition = "date(started_at, '+7 hours') BETWEEN date(?) AND date(?)";
      const summary = db
        .prepare(
          `SELECT COUNT(*) AS total_batches,
          COALESCE(SUM(CASE WHEN status='Completed' THEN output ELSE 0 END),0) AS total_output,
          SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status='Paused' THEN 1 ELSE 0 END) AS paused,
          SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) AS cancelled,
          COALESCE(ROUND(AVG(CASE WHEN status='Completed' THEN actual_duration END)),0) AS avg_duration
          FROM batches WHERE ${condition}`,
        )
        .get(...values);
      const daily = db
        .prepare(
          `SELECT date(started_at, '+7 hours') AS day,
          COALESCE(SUM(CASE WHEN status='Completed' THEN output ELSE 0 END),0) AS output,
          COUNT(*) AS batches
          FROM batches WHERE ${condition} GROUP BY date(started_at, '+7 hours') ORDER BY day`,
        )
        .all(...values);
      const recent = db
        .prepare(
          `SELECT * FROM batches WHERE ${condition} ORDER BY started_at DESC LIMIT 6`,
        )
        .all(...values);
      const issues = db
        .prepare(
          `SELECT * FROM batches WHERE ${condition} AND status IN ('Paused','Cancelled') ORDER BY started_at DESC LIMIT 5`,
        )
        .all(...values);
      const materials = db
        .prepare(
          `SELECT jm.name,jm.unit,ROUND(SUM(jm.qty),2) AS qty
          FROM batches b JOIN job_materials jm ON jm.job_id=b.job_id
          WHERE ${condition.replaceAll("started_at", "b.started_at")} AND b.status='Completed'
          GROUP BY jm.name,jm.unit ORDER BY qty DESC LIMIT 5`,
        )
        .all(...values);
      const machines = db
        .prepare(
          `SELECT line AS machine,
          COUNT(*) AS total_batches,
          SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) AS completed,
          COALESCE(SUM(CASE WHEN status='Completed' THEN output ELSE 0 END),0) AS output,
          COALESCE(ROUND(AVG(CASE WHEN status='Completed' THEN actual_duration END)),0) AS avg_duration
          FROM batches WHERE ${condition} AND line != ''
          GROUP BY line ORDER BY total_batches DESC`,
        )
        .all(...values);
      return json(res, 200, {
        data: {
          from,
          to,
          summary: {
            ...summary,
            completion_rate: Number(summary.total_batches)
              ? Math.round(
                  (Number(summary.completed) / Number(summary.total_batches)) *
                    1000,
                ) / 10
              : 0,
          },
          daily,
          recent,
          issues,
          materials,
          machines,
        },
      });
    }

    if (path === "/api/batches" && req.method === "GET") {
      const filter = batchWhere(url);
      return json(res, 200, {
        data: db
          .prepare(
            `SELECT * FROM batches WHERE ${filter.sql} ORDER BY started_at DESC`,
          )
          .all(...filter.values),
        range: { from: filter.from, to: filter.to },
      });
    }
    if (path === "/api/batches" && req.method === "POST") {
      const body = await readBody(req);
      const previous = db
        .prepare("SELECT status FROM batches WHERE id=?")
        .get(body.id);
      const estimatedMaterialCost = Number(
        db
          .prepare(
            "SELECT COALESCE(SUM(jm.qty*m.unit_price),0) AS total FROM job_materials jm JOIN materials m ON m.id=jm.material_id WHERE jm.job_id=?",
          )
          .get(body.job_id)?.total || 0,
      );
      db.prepare(
        `INSERT INTO batches(id,job_id,job_name,job_version,operator_id,operator_name,status,current_step,started_at,completed_at,output,unit,planned_duration,actual_duration,pause_count,on_time,estimated_material_cost,actual_material_cost,cost_per_unit,batch_no,packaging_code,expired_date,storage_location,filling_date,special_notes,area,line)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET job_id=excluded.job_id,job_name=excluded.job_name,job_version=excluded.job_version,operator_id=excluded.operator_id,operator_name=excluded.operator_name,status=excluded.status,current_step=excluded.current_step,completed_at=excluded.completed_at,output=excluded.output,unit=excluded.unit,planned_duration=excluded.planned_duration,actual_duration=excluded.actual_duration,pause_count=excluded.pause_count,on_time=excluded.on_time,batch_no=excluded.batch_no,packaging_code=excluded.packaging_code,expired_date=excluded.expired_date,storage_location=excluded.storage_location,filling_date=excluded.filling_date,special_notes=excluded.special_notes,area=excluded.area,line=excluded.line`,
      ).run(
        body.id,
        body.job_id || null,
        body.job_name,
        Number(body.job_version),
        body.operator_id || null,
        body.operator_name,
        body.status,
        Number(body.current_step || 0),
        body.started_at,
        body.completed_at || null,
        body.output ?? null,
        body.unit,
        Number(body.planned_duration || 0),
        Number(body.actual_duration || 0),
        Number(body.pause_count || 0),
        body.on_time !== undefined ? (body.on_time ? 1 : 0) : 1,
        estimatedMaterialCost,
        Number(body.actual_material_cost || 0),
        Number(body.cost_per_unit || 0),
        body.batch_no || "",
        body.packaging_code || "",
        body.expired_date || "",
        body.storage_location || "",
        body.filling_date || "",
        body.special_notes || "",
        body.area || "",
        body.line || "",
      );
      const eventStmt = db.prepare(
        "INSERT OR REPLACE INTO batch_events(id,batch_id,event_time,event_type,title,detail,actor) VALUES(?,?,?,?,?,?,?)",
      );
      (body.events || []).forEach((event) =>
        eventStmt.run(
          event.id || randomUUID(),
          body.id,
          event.event_time,
          event.event_type,
          event.title,
          event.detail || "",
          event.actor || body.operator_name,
        ),
      );
      if (body.status === "Completed" && previous?.status !== "Completed") {
        const jobMaterials = db
          .prepare(
            "SELECT jm.id,jm.material_id,jm.name,jm.qty,jm.unit,m.unit_price,m.currency FROM job_materials jm JOIN materials m ON m.id=jm.material_id WHERE jm.job_id=?",
          )
          .all(body.job_id);
        const usageStmt = db.prepare(
          "INSERT OR IGNORE INTO material_movements(id,material_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,job_id,batch_id,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        );
        for (const material of jobMaterials) {
          const frontendVal = body.actual_materials ? (body.actual_materials[material.id] ?? body.actual_materials[material.material_id]) : undefined;
          const actualQty = frontendVal !== undefined ? Number(frontendVal) : material.qty;
          usageStmt.run(
            `usage-${body.id}-${material.id}`,
            material.material_id,
            "OUT",
            actualQty,
            material.unit,
            material.unit_price,
            actualQty * Number(material.unit_price),
            material.currency || "IDR",
            body.completed_at || new Date().toISOString(),
            `Produksi ${body.job_name}`,
            body.job_id,
            body.id,
            body.id,
            `Pemakaian aktual: ${material.name}`,
            body.operator_name,
          );
        }

        const jobPackagings = db
          .prepare(
            "SELECT jp.id,jp.packaging_id,jp.name,jp.qty,jp.unit,p.unit_price,p.currency FROM job_packagings jp JOIN master_packaging p ON p.id=jp.packaging_id WHERE jp.job_id=?",
          )
          .all(body.job_id);
        const pkgUsageStmt = db.prepare(
          "INSERT OR IGNORE INTO packaging_movements(id,packaging_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,job_id,batch_id,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        );
        for (const packaging of jobPackagings) {
          const frontendVal = body.actual_packagings ? (body.actual_packagings[packaging.id] ?? body.actual_packagings[packaging.packaging_id]) : undefined;
          const actualQty = frontendVal !== undefined ? Number(frontendVal) : packaging.qty;
          pkgUsageStmt.run(
            `usage-pkg-${body.id}-${packaging.id}`,
            packaging.packaging_id,
            "OUT",
            actualQty,
            packaging.unit,
            packaging.unit_price || 0,
            actualQty * Number(packaging.unit_price || 0),
            packaging.currency || "IDR",
            body.completed_at || new Date().toISOString(),
            `Produksi ${body.job_name}`,
            body.job_id,
            body.id,
            body.id,
            `Pemakaian aktual kemasan: ${packaging.name}`,
            body.operator_name,
          );
        }

        const actualCost = Number(
          db
            .prepare(
              "SELECT COALESCE(SUM(total_cost),0) AS total FROM material_movements WHERE batch_id=? AND movement_type IN ('OUT','ADJUSTMENT_OUT')",
            )
            .get(body.id)?.total || 0,
        );
        db.prepare(
          "UPDATE batches SET actual_material_cost=?,cost_per_unit=CASE WHEN output>0 THEN ?/output ELSE 0 END WHERE id=?",
        ).run(actualCost, actualCost, body.id);

        for (const material of jobMaterials) {
          checkMaterialStockWarning(material.material_id);
        }
        for (const packaging of jobPackagings) {
          checkPackagingStockWarning(packaging.packaging_id);
        }
      }
      return json(res, 201, { id: body.id });
    }
    const cancelMatch = path.match(/^\/api\/batches\/([^/]+)\/cancel$/);
    if (cancelMatch && req.method === "POST") {
      const body = await readBody(req);
      const current = db
        .prepare("SELECT * FROM batches WHERE id=?")
        .get(cancelMatch[1]);
      if (!current) return json(res, 404, { error: "Batch tidak ditemukan" });
      if (current.status === "Cancelled")
        return json(res, 409, { error: "Batch sudah dibatalkan" });
      if (!String(body.reason || "").trim())
        return json(res, 400, { error: "Alasan pembatalan wajib diisi" });
      const actorRole = String(body.actor_role || "");
      if (!["operator", "supervisor", "admin"].includes(actorRole))
        return json(res, 403, { error: "Role tidak diizinkan" });
      if (actorRole === "operator") {
        const pinHash = db
          .prepare(
            "SELECT value FROM settings WHERE key='supervisor_cancel_pin_hash'",
          )
          .get()?.value;
        const adminPinHash = db
          .prepare(
            "SELECT value FROM settings WHERE key='admin_pin_hash'",
          )
          .get()?.value;
        const spvOk = pinHash && verifyPassword(String(body.pin || ""), pinHash);
        const adminOk = adminPinHash && verifyPassword(String(body.pin || ""), adminPinHash);
        if (!spvOk && !adminOk)
          return json(res, 403, { error: "PIN Supervisor atau Administrator tidak sesuai" });
      }
      const cancelledAt = new Date().toISOString();
      db.prepare(
        "UPDATE batches SET status='Cancelled',completed_at=COALESCE(completed_at,?) WHERE id=?",
      ).run(cancelledAt, cancelMatch[1]);
      db.prepare(
        "INSERT INTO batch_events(id,batch_id,event_time,event_type,title,detail,actor) VALUES(?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        cancelMatch[1],
        cancelledAt,
        "cancel",
        "Batch dibatalkan",
        String(body.reason).trim(),
        body.actor_name || actorRole,
      );
      if (current.status === "Completed" && current.job_id) {
        const usedMaterials = db
          .prepare(
            `SELECT jm.id,jm.material_id,jm.name,jm.unit,
            COALESCE((SELECT qty FROM material_movements WHERE batch_id=? AND material_id=jm.material_id AND movement_type='OUT' LIMIT 1),jm.qty) AS qty,
            COALESCE((SELECT unit_cost FROM material_movements WHERE batch_id=? AND material_id=jm.material_id AND movement_type='OUT' LIMIT 1),m.unit_price) AS unit_price,
            COALESCE(m.currency,'IDR') AS currency
            FROM job_materials jm JOIN materials m ON m.id=jm.material_id WHERE jm.job_id=?`,
          )
          .all(current.id, current.id, current.job_id);
        const reverseStmt = db.prepare(
          "INSERT OR IGNORE INTO material_movements(id,material_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,job_id,batch_id,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        );
        for (const material of usedMaterials)
          reverseStmt.run(
            `cancel-reversal-${current.id}-${material.id}`,
            material.material_id,
            "ADJUSTMENT_IN",
            material.qty,
            material.unit,
            material.unit_price,
            Number(material.qty) * Number(material.unit_price),
            material.currency || "IDR",
            cancelledAt,
            `Pembatalan ${current.job_name}`,
            current.job_id,
            current.id,
            current.id,
            `Pengembalian pemakaian: ${material.name}`,
            body.actor_name || actorRole,
          );
          
        const usedPackagings = db
          .prepare(
            `SELECT jp.id,jp.packaging_id,jp.name,jp.unit,
            COALESCE((SELECT qty FROM packaging_movements WHERE batch_id=? AND packaging_id=jp.packaging_id AND movement_type='OUT' LIMIT 1),jp.qty) AS qty,
            COALESCE((SELECT unit_cost FROM packaging_movements WHERE batch_id=? AND packaging_id=jp.packaging_id AND movement_type='OUT' LIMIT 1),p.unit_price) AS unit_price,
            COALESCE(p.currency,'IDR') AS currency
            FROM job_packagings jp JOIN master_packaging p ON p.id=jp.packaging_id WHERE jp.job_id=?`,
          )
          .all(current.id, current.id, current.job_id);
        const pkgReverseStmt = db.prepare(
          "INSERT OR IGNORE INTO packaging_movements(id,packaging_id,movement_type,qty,unit,unit_cost,total_cost,currency,occurred_at,purpose,job_id,batch_id,reference,notes,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        );
        for (const packaging of usedPackagings)
          pkgReverseStmt.run(
            `cancel-pkg-reversal-${current.id}-${packaging.id}`,
            packaging.packaging_id,
            "ADJUSTMENT_IN",
            packaging.qty,
            packaging.unit,
            packaging.unit_price || 0,
            Number(packaging.qty) * Number(packaging.unit_price || 0),
            packaging.currency || "IDR",
            cancelledAt,
            `Pembatalan ${current.job_name}`,
            current.job_id,
            current.id,
            current.id,
            `Pengembalian pemakaian kemasan: ${packaging.name}`,
            body.actor_name || actorRole,
          );

        db.prepare(
          "UPDATE batches SET actual_material_cost=0,cost_per_unit=0 WHERE id=?",
        ).run(current.id);
      }
      db.prepare(
        "INSERT INTO notifications(id,target_role,title,message,type,is_read,link_view) VALUES(?,?,?,?,?,0,?)",
      ).run(
        randomUUID(),
        "admin",
        "Batch dibatalkan",
        `${current.id} dibatalkan oleh ${body.actor_name || actorRole}: ${String(body.reason).trim()}`,
        "warning",
        "history",
      );
      return json(res, 200, { ok: true, cancelled_at: cancelledAt });
    }
    const batchMatch = path.match(/^\/api\/batches\/([^/]+)$/);
    if (batchMatch && req.method === "GET") {
      const detail = db
        .prepare("SELECT * FROM batches WHERE id=?")
        .get(batchMatch[1]);
      if (!detail) return json(res, 404, { error: "Batch tidak ditemukan" });
      return json(res, 200, {
        data: {
          ...detail,
          events: db
            .prepare(
              "SELECT * FROM batch_events WHERE batch_id=? ORDER BY event_time",
            )
            .all(batchMatch[1]),
        },
      });
    }
    if (batchMatch && req.method === "PUT") {
      const body = await readBody(req);
      const current = db
        .prepare("SELECT * FROM batches WHERE id=?")
        .get(batchMatch[1]);
      if (!current) return json(res, 404, { error: "Batch tidak ditemukan" });
      db.prepare(
        "UPDATE batches SET status=?,output=?,unit=?,completed_at=?,actual_duration=?,on_time=? WHERE id=?",
      ).run(
        body.status || current.status,
        body.output ?? current.output,
        body.unit || current.unit,
        body.completed_at ?? current.completed_at,
        Number(body.actual_duration ?? current.actual_duration),
        body.on_time === undefined ? current.on_time : body.on_time ? 1 : 0,
        batchMatch[1],
      );
      db.prepare(
        "INSERT INTO batch_events(id,batch_id,event_time,event_type,title,detail,actor) VALUES(?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        batchMatch[1],
        new Date().toISOString(),
        "correction",
        "Batch dikoreksi",
        body.notes || "Data batch diperbarui melalui Batch History",
        body.actor || "Administrator",
      );
      return json(res, 200, { ok: true });
    }
    if (batchMatch && req.method === "DELETE") {
      const current = db
        .prepare("SELECT id FROM batches WHERE id=?")
        .get(batchMatch[1]);
      if (!current) return json(res, 404, { error: "Batch tidak ditemukan" });
      db.prepare(
        "UPDATE batches SET status='Cancelled',completed_at=COALESCE(completed_at,?) WHERE id=?",
      ).run(new Date().toISOString(), batchMatch[1]);
      db.prepare(
        "INSERT INTO batch_events(id,batch_id,event_time,event_type,title,detail,actor) VALUES(?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        batchMatch[1],
        new Date().toISOString(),
        "cancel",
        "Batch dibatalkan",
        "Dibatalkan melalui Batch History",
        "Administrator",
      );
      return json(res, 200, { ok: true });
    }

    if (path === "/api/reports" && req.method === "GET")
      return json(res, 200, {
        data: db
          .prepare("SELECT * FROM report_presets ORDER BY updated_at DESC")
          .all(),
      });
    if (path === "/api/reports" && req.method === "POST") {
      const body = await readBody(req);
      const id = body.id || randomUUID();
      db.prepare(
        "INSERT INTO report_presets(id,name,report_type,from_date,to_date,status_filter,job_filter) VALUES(?,?,?,?,?,?,?)",
      ).run(
        id,
        body.name,
        body.report_type || "Production Summary",
        body.from_date,
        body.to_date,
        body.status_filter || "",
        body.job_filter || "",
      );
      return json(res, 201, { id });
    }
    const reportMatch = path.match(/^\/api\/reports\/([^/]+)$/);
    if (reportMatch && req.method === "PUT") {
      const body = await readBody(req);
      db.prepare(
        "UPDATE report_presets SET name=?,report_type=?,from_date=?,to_date=?,status_filter=?,job_filter=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(
        body.name,
        body.report_type || "Production Summary",
        body.from_date,
        body.to_date,
        body.status_filter || "",
        body.job_filter || "",
        reportMatch[1],
      );
      return json(res, 200, { ok: true });
    }
    if (reportMatch && req.method === "DELETE") {
      db.prepare("DELETE FROM report_presets WHERE id=?").run(reportMatch[1]);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/notifications" && req.method === "GET") {
      const role = url.searchParams.get("role") || "all";
      return json(res, 200, {
        data: db
          .prepare(
            "SELECT * FROM notifications WHERE target_role IN ('all',?) ORDER BY created_at DESC LIMIT 50",
          )
          .all(role),
      });
    }
    if (path === "/api/notifications" && req.method === "POST") {
      const body = await readBody(req);
      const id = body.id || randomUUID();
      db.prepare(
        "INSERT INTO notifications(id,target_role,title,message,type,is_read,link_view) VALUES(?,?,?,?,?,0,?)",
      ).run(
        id,
        body.target_role || "all",
        body.title,
        body.message,
        body.type || "info",
        body.link_view || "",
      );
      return json(res, 201, { id });
    }
    if (path === "/api/notifications/read-all" && req.method === "PUT") {
      const body = await readBody(req);
      db.prepare(
        "UPDATE notifications SET is_read=1 WHERE target_role IN ('all',?)",
      ).run(body.role || "all");
      return json(res, 200, { ok: true });
    }
    const notificationMatch = path.match(/^\/api\/notifications\/([^/]+)$/);
    if (notificationMatch && req.method === "PUT") {
      db.prepare("UPDATE notifications SET is_read=1 WHERE id=?").run(
        notificationMatch[1],
      );
      return json(res, 200, { ok: true });
    }
    if (notificationMatch && req.method === "DELETE") {
      db.prepare("DELETE FROM notifications WHERE id=?").run(
        notificationMatch[1],
      );
      return json(res, 200, { ok: true });
    }

    if (path === "/api/sounds" && req.method === "GET") {
      const sounds = db.prepare("SELECT * FROM master_sounds ORDER BY name ASC").all();
      return json(res, 200, { data: sounds });
    }

    if (path === "/api/sounds/upload" && req.method === "POST") {
      const body = await readBody(req);
      const { name, fileData, filename } = body;
      if (!name || !fileData || !filename) {
        return json(res, 400, { error: "Nama, fileData, dan nama file wajib diisi" });
      }
      
      const matches = fileData.match(/^data:audio\/(mp3|mpeg);base64,(.+)$/);
      if (!matches) {
        return json(res, 400, { error: "Format audio tidak valid. Hanya menerima MP3" });
      }
      const base64Content = matches[2];
      const fileBuffer = Buffer.from(base64Content, 'base64');
      
      if (fileBuffer.length > 2 * 1024 * 1024) {
        return json(res, 400, { error: "Ukuran file melebihi batas 2MB" });
      }
      
      const id = randomUUID();
      const savedFilename = `${id}.mp3`;
      const filePath = resolve(soundsDir, savedFilename);
      
      writeFileSync(filePath, fileBuffer);
      
      db.prepare("INSERT INTO master_sounds (id, name, filename) VALUES (?, ?, ?)")
        .run(id, name, savedFilename);
        
      return json(res, 200, { ok: true, id, name, filename: savedFilename });
    }

    const soundFileMatch = path.match(/^\/api\/sounds\/file\/([^/]+)$/);
    if (soundFileMatch && req.method === "GET") {
      const filename = soundFileMatch[1];
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return json(res, 400, { error: "Nama file tidak valid" });
      }
      const filePath = resolve(soundsDir, filename);
      if (!existsSync(filePath)) {
        res.writeHead(404, { "access-control-allow-origin": "*" });
        return res.end("Not Found");
      }
      const stat = statSync(filePath);
      res.writeHead(200, {
        "content-type": "audio/mpeg",
        "content-length": stat.size,
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=31536000",
      });
      const fileContent = readFileSync(filePath);
      return res.end(fileContent);
    }

    const soundDeleteMatch = path.match(/^\/api\/sounds\/([^/]+)$/);
    if (soundDeleteMatch && req.method === "DELETE") {
      const id = soundDeleteMatch[1];
      const sound = db.prepare("SELECT * FROM master_sounds WHERE id = ?").get(id);
      if (!sound) {
        return json(res, 404, { error: "Suara tidak ditemukan" });
      }
      
      const filePath = resolve(soundsDir, sound.filename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      
      db.prepare("DELETE FROM master_sounds WHERE id = ?").run(id);
      return json(res, 200, { ok: true });
    }

    if (path === "/api/performance" && req.method === "GET") {
      const { from, to } = dateRange(url);
      const data = db
        .prepare(
          `SELECT u.id,u.name,u.employee_no,u.shift,COUNT(b.id) AS total_batches,SUM(CASE WHEN b.status='Completed' THEN 1 ELSE 0 END) AS completed,SUM(CASE WHEN b.status='Paused' THEN 1 ELSE 0 END) AS paused,SUM(CASE WHEN b.status='Cancelled' THEN 1 ELSE 0 END) AS cancelled,COALESCE(ROUND(AVG(CASE WHEN b.status='Completed' THEN b.actual_duration END)),0) AS avg_duration,COALESCE(ROUND(100.0*SUM(CASE WHEN b.on_time=1 AND b.status='Completed' THEN 1 ELSE 0 END)/NULLIF(SUM(CASE WHEN b.status='Completed' THEN 1 ELSE 0 END),0),1),0) AS on_time_rate,GROUP_CONCAT(b.job_name) AS jobs_worked,GROUP_CONCAT(b.line) AS machines_used FROM users u LEFT JOIN batches b ON b.operator_id=u.id AND date(b.started_at) BETWEEN date(?) AND date(?) WHERE u.role_id='role-operator' GROUP BY u.id ORDER BY completed DESC,u.name`,
        )
        .all(from, to)
        .map((row) => {
          const uniqueJobs = row.jobs_worked ? Array.from(new Set(row.jobs_worked.split(','))).filter(Boolean) : [];
          const uniqueMachines = row.machines_used ? Array.from(new Set(row.machines_used.split(','))).filter(Boolean) : [];
          return {
            ...row,
            jobs_worked: uniqueJobs,
            machines_used: uniqueMachines,
            score: Number(row.total_batches) === 0 ? 0 : Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  55 +
                    Number(row.on_time_rate) * 0.35 +
                    Number(row.completed) * 2 -
                    Number(row.paused) * 3 -
                    Number(row.cancelled) * 6,
                ),
              ),
            ),
          };
        });
      return json(res, 200, { data });
    }

    return json(res, 404, { error: "Endpoint tidak ditemukan" });
  } catch (error) {
    console.error(error);
    return json(res, 400, {
      error: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AUTOMOVA database API ready on http://0.0.0.0:${port}`);
  console.log(`SQLite: ${databasePath}`);
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
performBackup("startup");
