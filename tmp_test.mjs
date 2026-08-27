import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/automova.sqlite");
try {
  db.prepare("INSERT INTO materials (id,code,name,default_qty,unit,unit_price,currency,status,notes) VALUES ('1','MAT1','N',0,'Kg',0,'IDR','Active','')").run();
  db.prepare("INSERT INTO materials (id,code,name,default_qty,unit,unit_price,currency,status,notes) VALUES ('2','MAT1','N',0,'Kg',0,'IDR','Active','')").run();
} catch (e) {
  console.log(e.code, e.message);
}
