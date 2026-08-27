import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const port = 3197;
const api = `http://127.0.0.1:${port}/api`;

async function waitUntilReady() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${api}/health`);
      if (response.ok) return;
    } catch {
      /* server is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Test database API did not start");
}

test("persists master data, permissions, settings, performance, and batch detail", async () => {
  const directory = await mkdtemp(join(tmpdir(), "automova-db-test-"));
  const dbPath = join(directory, "test.sqlite");
  
  try {
    await copyFile("data/automova.sqlite", dbPath);
  } catch (err) {
    console.error("Failed to copy template database:", err);
  }

  const child = spawn(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", "server/api-server.mjs"],
    {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        AUTOMOVA_API_PORT: String(port),
        AUTOMOVA_DB_PATH: dbPath,
      },
      stdio: "ignore",
    },
  );

  try {
    await waitUntilReady();

    const initialMaterials = await fetch(`${api}/materials`).then((response) =>
      response.json(),
    );
    assert.ok(initialMaterials.data.length >= 5);

    const created = await fetch(`${api}/materials`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: "MAT-T01",
        name: "Test Material",
        default_qty: 12.5,
        unit: "Kg",
        status: "Active",
        notes: "CRUD test",
      }),
    }).then((response) => response.json());
    assert.ok(created.id);

    await fetch(`${api}/materials/${created.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: "MAT-T01",
        name: "Test Material Updated",
        default_qty: 13,
        unit: "Kg",
        status: "Active",
        notes: "Updated",
      }),
    });
    const updatedMaterials = await fetch(`${api}/materials`).then((response) =>
      response.json(),
    );
    assert.equal(
      updatedMaterials.data.find((item) => item.id === created.id).name,
      "Test Material Updated",
    );

    const roles = await fetch(`${api}/roles`).then((response) =>
      response.json(),
    );
    assert.ok(roles.data.some((role) => role.id === "role-admin"));
    assert.ok(
      roles.permissions.some((permission) => permission.id === "users.manage"),
    );

    const popup = {
      enabled: true,
      title: "Test SOP",
      message: "Baca SOP sebelum mulai",
      requireAcknowledge: true,
    };
    await fetch(`${api}/settings/operator-popup`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(popup),
    });
    const savedPopup = await fetch(`${api}/settings/operator-popup`).then(
      (response) => response.json(),
    );
    assert.deepEqual(savedPopup.data, popup);

    const performance = await fetch(
      `${api}/performance?from=2026-07-20&to=2026-07-23`,
    ).then((response) => response.json());
    assert.ok(
      performance.data.every(
        (operator) => operator.score >= 0 && operator.score <= 100,
      ),
    );

    const batchDetail = await fetch(`${api}/batches/BATCH-20260722-006`).then(
      (response) => response.json(),
    );
    assert.equal(batchDetail.data.job_version, 13);
    assert.ok(batchDetail.data.events.length >= 5);

    const filteredBatches = await fetch(
      `${api}/batches?from=2026-07-22&to=2026-07-22&status=Completed`,
    ).then((response) => response.json());
    assert.ok(filteredBatches.data.length >= 2);
    assert.ok(
      filteredBatches.data.every((batch) => batch.status === "Completed"),
    );

    const dashboard = await fetch(
      `${api}/dashboard?from=2026-07-20&to=2026-07-23`,
    ).then((response) => response.json());
    assert.ok(dashboard.data.summary.total_batches >= 7);
    assert.ok(dashboard.data.daily.length >= 3);
    assert.ok(dashboard.data.materials.length >= 1);

    const movements = await fetch(
      `${api}/material-movements?from=2026-07-20&to=2026-07-23`,
    ).then((response) => response.json());
    assert.ok(movements.data.some((item) => item.movement_type === "IN"));
    assert.ok(
      movements.data.some(
        (item) =>
          item.movement_type === "OUT" &&
          item.batch_id === "BATCH-20260722-006",
      ),
    );
    assert.ok(movements.summary.every((item) => item.balance >= 0));

    const incomingMovement = await fetch(`${api}/material-movements`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        material_id: "mat-garam",
        movement_type: "IN",
        qty: 25,
        unit: "Kg",
        occurred_at: "2026-07-23T01:00:00.000Z",
        purpose: "Penerimaan supplier",
        reference: "PO-TEST-001",
        actor: "Administrator",
      }),
    }).then((response) => response.json());
    assert.ok(incomingMovement.id);

    const report = await fetch(`${api}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test Weekly Report",
        from_date: "2026-07-20",
        to_date: "2026-07-23",
        status_filter: "Completed",
      }),
    }).then((response) => response.json());
    assert.ok(report.id);
    const reports = await fetch(`${api}/reports`).then((response) =>
      response.json(),
    );
    assert.equal(reports.data[0].name, "Test Weekly Report");

    const notification = await fetch(`${api}/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_role: "operator",
        title: "Timer selesai",
        message: "Konfirmasi proses",
        type: "warning",
      }),
    }).then((response) => response.json());
    assert.ok(notification.id);
    await fetch(`${api}/notifications/${notification.id}`, {
      method: "PUT",
    });
    const notifications = await fetch(
      `${api}/notifications?role=operator`,
    ).then((response) => response.json());
    assert.equal(
      notifications.data.find((item) => item.id === notification.id).is_read,
      1,
    );

    await fetch(`${api}/batches/BATCH-20260722-006`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "Completed",
        output: 501,
        unit: "Liter",
        actual_duration: 4700,
        notes: "Test correction",
      }),
    });
    const correctedBatch = await fetch(
      `${api}/batches/BATCH-20260722-006`,
    ).then((response) => response.json());
    assert.equal(correctedBatch.data.output, 501);
    assert.ok(
      correctedBatch.data.events.some(
        (event) => event.event_type === "correction",
      ),
    );

    const deniedCancel = await fetch(
      `${api}/batches/BATCH-20260722-004/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor_role: "operator",
          actor_name: "Agus Setiawan",
          pin: "0000",
          reason: "Test PIN salah",
        }),
      },
    );
    assert.equal(deniedCancel.status, 403);

    const approvedCancel = await fetch(
      `${api}/batches/BATCH-20260722-004/cancel`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actor_role: "operator",
          actor_name: "Agus Setiawan",
          pin: "2468",
          reason: "Mesin perlu pemeriksaan teknisi",
        }),
      },
    );
    assert.equal(approvedCancel.status, 200);
    const cancelledBatch = await fetch(
      `${api}/batches/BATCH-20260722-004`,
    ).then((response) => response.json());
    assert.equal(cancelledBatch.data.status, "Cancelled");
    assert.ok(
      cancelledBatch.data.events.some((event) => event.event_type === "cancel"),
    );
  } finally {
    child.kill("SIGINT");
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
