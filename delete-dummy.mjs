import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('/var/www/automova/data/automova.sqlite');
db.exec("DELETE FROM batches; DELETE FROM batch_events; DELETE FROM jobs; DELETE FROM job_materials; DELETE FROM job_steps; DELETE FROM material_movements WHERE job_id IS NOT NULL OR batch_id IS NOT NULL;");
console.log("Dummy data deleted successfully");
