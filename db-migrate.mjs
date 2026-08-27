import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/automova.sqlite");
db.exec("PRAGMA journal_mode = WAL;");
try {
  db.exec("ALTER TABLE jobs ADD COLUMN product_code TEXT NOT NULL DEFAULT ''");
  console.log("Added product_code to jobs");
} catch (e) {
  console.log("jobs product_code already exists or error:", e.message);
}
try {
  db.exec("ALTER TABLE batches ADD COLUMN batch_no TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE batches ADD COLUMN packaging_code TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE batches ADD COLUMN expired_date TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE batches ADD COLUMN storage_location TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE batches ADD COLUMN filling_date TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE batches ADD COLUMN special_notes TEXT NOT NULL DEFAULT ''");
  console.log("Added new columns to batches");
} catch (e) {
  console.log("batches columns already exist or error:", e.message);
}
