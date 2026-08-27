type PackagingMovement = {
  id: string;
  packaging_id: string;
  packaging_code: string;
  packaging_name: string;
  movement_type: "IN" | "OUT" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  qty: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  currency: string;
  occurred_at: string;
  purpose: string;
  job_id: string | null;
  batch_id: string | null;
  reference: string;
  notes: string;
  actor: string;
};

type PackagingMovementSummary = {
  id: string;
  code: string;
  name: string;
  unit: string;
  qty_in: number;
  qty_out: number;
  cost_in: number;
  cost_out: number;
  balance: number;
};

type PackagingMovementResponse = {
  data: PackagingMovement[];
  summary: PackagingMovementSummary[];
};

export function PackagingLedger({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [from, setFrom] = useState(() => offsetDate(-30));
  const [to, setTo] = useState(() => offsetDate(0));
  const [packagingId, setPackagingId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<PackagingMovement[]>([]);
  const [summary, setSummary] = useState<PackagingMovementSummary[]>([]);
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    packaging_id: "",
    movement_type: "IN",
    qty: 0,
    unit: "Kg",
    occurred_at: toLocalDateTime(new Date().toISOString()),
    purpose: "",
    reference: "",
    notes: "",
    actor: "Administrator",
  });
  const load = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    if (packagingId) params.set("packaging", packagingId);
    if (movementType) params.set("type", movementType);
    const [movementResponse, packagingResponse] = await Promise.all([
      apiFetch<PackagingMovementResponse>(`/packaging-movements?${params}`),
      apiFetch<{ data: Packaging[] }>("/packagings"),
    ]);
    setItems(movementResponse.data);
    setSummary(movementResponse.summary);
    setPackagings(packagingResponse.data);
  }, [from, packagingId, movementType, to]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => notify(error.message)));
  }, [load, notify]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await apiFetch("/packaging-movements", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        occurred_at: new Date(form.occurred_at).toISOString(),
      }),
    });
    setShowForm(false);
    setForm({
      packaging_id: "",
      movement_type: "IN",
      qty: 0,
      unit: "Kg",
      occurred_at: toLocalDateTime(new Date().toISOString()),
      purpose: "",
      reference: "",
      notes: "",
      actor: "Administrator",
    });
    await load();
    notify("Pergerakan packaging berhasil dicatat ke ledger.");
  };
  const inCount = items.filter((item) =>
    ["IN", "ADJUSTMENT_IN"].includes(item.movement_type),
  ).length;
  const outCount = items.filter((item) =>
    ["OUT", "ADJUSTMENT_OUT"].includes(item.movement_type),
  ).length;
  const [currentPage, setCurrentPage] = useState(1);
  const remove = async (id: string) => {
    if (!window.confirm("Hapus data pergerakan packaging ini secara permanen?")) return;
    try {
      await apiFetch(`/packaging-movements/${id}`, { method: "DELETE" });
      await load();
      notify("Data pergerakan berhasil dihapus.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menghapus pergerakan");
    }
  };
  const [pageSize, setPageSize] = useState(10);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return (
    <div className="admin-page">
      <MasterHeader
        kicker="MATERIAL TRACEABILITY"
        title="Penggunaan Packaging"
        text="Catat packaging masuk, pemakaian, penyesuaian, waktu, referensi, serta tujuan penggunaannya."
        actions={
          <>
            <TutorialButton tutorialKey="ledger" />
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              <i className="bi bi-plus-lg" /> Catat Pergerakan
            </button>
          </>
        }
      />
      <section className="panel packaging-ledger-filter">
        <DateRange
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
          onApply={() => void load()}
        />
        <label>
          Packaging
          <select
            value={packagingId}
            onChange={(event) => {
              setPackagingId(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Semua packaging</option>
            {packagings.map((packaging) => (
              <option key={packaging.id} value={packaging.id}>
                {packaging.code} · {packaging.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jenis
          <select
            value={movementType}
            onChange={(event) => {
              setMovementType(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Semua pergerakan</option>
            <option value="IN">Packaging Masuk</option>
            <option value="OUT">Pemakaian</option>
            <option value="ADJUSTMENT_IN">Penyesuaian Tambah</option>
            <option value="ADJUSTMENT_OUT">Penyesuaian Kurang</option>
          </select>
        </label>
      </section>
      <div className="ledger-kpis">
        <article>
          <span className="ledger-icon in">
            <i className="bi bi-box-arrow-in-down" />
          </span>
          <div>
            <small>Transaksi Masuk</small>
            <strong>{inCount}</strong>
            <span>Dalam periode</span>
          </div>
        </article>
        <article>
          <span className="ledger-icon out">
            <i className="bi bi-box-arrow-up" />
          </span>
          <div>
            <small>Transaksi Pemakaian</small>
            <strong>{outCount}</strong>
            <span>Manual dan otomatis dari Job</span>
          </div>
        </article>
        <article>
          <span className="ledger-icon balance">
            <i className="bi bi-boxes" />
          </span>
          <div>
            <small>Packaging Tercatat</small>
            <strong>{summary.length}</strong>
            <span>Saldo dapat ditelusuri</span>
          </div>
        </article>
      </div>
      
      <section className="panel table-panel" style={{ marginBottom: "16px" }}>
        <div className="panel-head" style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1, display: "flex", gap: "10px", alignItems: "center" }}>
            <h2 style={{ minWidth: "220px" }}>Ringkasan Penggunaan Packaging</h2>
            <div className="editor-search" style={{ margin: 0, flex: 1, maxWidth: "400px" }}>
              <i className="bi bi-search" />
              <input 
                type="search" 
                placeholder="Cari nama atau kode packaging..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Packaging</th>
                <th>Masuk</th>
                <th>Dipakai</th>
                <th>Saldo Saat Ini</th>
              </tr>
            </thead>
            <tbody>
              {summary.filter(m => 
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                m.code.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((packaging) => (
                <tr key={packaging.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--text-main)', fontWeight: 800 }}>{packaging.code}</strong>
                      <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{packaging.name}</span>
                    </div>
                  </td>
                  <td><span className="movement-in" style={{ color: "var(--green)", fontWeight: 600 }}>+{Number(packaging.qty_in).toLocaleString("id-ID")} {packaging.unit}</span></td>
                  <td><span className="movement-out" style={{ color: "var(--red)", fontWeight: 600 }}>−{Number(packaging.qty_out).toLocaleString("id-ID")} {packaging.unit}</span></td>
                  <td><strong>{Number(packaging.balance).toLocaleString("id-ID")} {packaging.unit}</strong></td>
                </tr>
              ))}
              {summary.filter(m => 
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                m.code.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    Packaging tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel ledger-table">
        <div className="panel-head">
          <div>
            <h2>Ledger Pergerakan</h2>
            <p>{items.length} transaksi sesuai periode dan filter</p>
          </div>
          <span className="database-pill">
            <i className="bi bi-shield-check" /> Audit Trail Terverifikasi
          </span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Packaging</th>
                <th>Jenis</th>
                <th>Jumlah</th>
                <th>Tujuan / Referensi</th>
                <th>Dicatat Oleh</th>
                <th style={{ textAlign: "center", width: "60px" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length ? (
                paginated.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.occurred_at).toLocaleString("id-ID")}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '16px', color: 'var(--text-main)', fontWeight: 800 }}>{item.packaging_code}</strong>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{item.packaging_name}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`movement-badge ${item.movement_type.toLowerCase()}`}
                      >
                        {movementLabel(item.movement_type)}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {Number(item.qty).toLocaleString("id-ID")} {item.unit}
                      </strong>
                    </td>
                    <td>
                      <strong>{item.purpose || "-"}</strong>
                      <small>
                        {item.batch_id || item.reference || item.notes || "-"}
                      </small>
                    </td>
                    <td>{item.actor || "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => remove(item.id)} title="Hapus">
                        <i className="bi bi-trash3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
                    Tidak ada transaksi pergerakan packaging ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalItems={items.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </section>
      {showForm && (
        <EntityModal
          title="Catat Pergerakan Packaging"
          subtitle="Semua perukemasan stok disimpan beserta waktu, tujuan, dan pencatatnya."
          onClose={() => setShowForm(false)}
          onSubmit={submit}
        >
          <div className="master-form-grid">
            <label>
              Packaging
              <select
                required
                value={form.packaging_id}
                onChange={(event) => {
                  const packaging = packagings.find(
                    (item) => item.id === event.target.value,
                  );
                  setForm({
                    ...form,
                    packaging_id: event.target.value,
                    unit: packaging?.unit || form.unit,
                  });
                }}
              >
                <option value="">Pilih packaging</option>
                {packagings
                  .filter((packaging) => packaging.status === "Active")
                  .map((packaging) => (
                    <option key={packaging.id} value={packaging.id}>
                      {packaging.code} · {packaging.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Jenis Pergerakan
              <select
                value={form.movement_type}
                onChange={(event) =>
                  setForm({ ...form, movement_type: event.target.value })
                }
              >
                <option value="IN">Packaging Masuk</option>
                <option value="OUT">Pemakaian Manual</option>
                <option value="ADJUSTMENT_IN">Penyesuaian Tambah</option>
                <option value="ADJUSTMENT_OUT">Penyesuaian Kurang</option>
              </select>
            </label>
            <label>
              Jumlah
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={form.qty || ""}
                onChange={(event) =>
                  setForm({ ...form, qty: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Satuan
              <input value={form.unit} readOnly />
            </label>
            <label>
              Waktu Transaksi
              <input
                required
                type="datetime-local"
                value={form.occurred_at}
                onChange={(event) =>
                  setForm({ ...form, occurred_at: event.target.value })
                }
              />
            </label>
            <label>
              Referensi
              <input
                value={form.reference}
                onChange={(event) =>
                  setForm({ ...form, reference: event.target.value })
                }
                placeholder="PO, surat jalan, atau nomor dokumen"
              />
            </label>
            <label className="full-field">
              Tujuan Penggunaan
              <input
                required
                value={form.purpose}
                onChange={(event) =>
                  setForm({ ...form, purpose: event.target.value })
                }
                placeholder="Contoh: Penerimaan supplier atau produksi Mixing A"
              />
            </label>
            <label className="full-field">
              Catatan
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </label>
          </div>
        </EntityModal>
      )}
    </div>
  );
}

type ReportPreset = {
  id: string;
  name: string;
  report_type: string;
  from_date: string;
  to_date: string;
  status_filter: string;
  job_filter: string;
};

type FinanceRow = BatchRow & {
  variance: number;
  variance_percent: number;
};

type FinanceData = {
  rows: FinanceRow[];
  summary: {
    completed_batches: number;
    estimated_cost: number;
    actual_cost: number;
    variance: number;
    total_output: number;
    cost_per_unit: number;
  };
  packaging_breakdown: Array<{
    code: string;
    name: string;
    unit: string;
    qty: number;
    cost: number;
  }>;
};

export function PackagingMaster({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const tutorial = useTutorial("packagings");
  const empty: Packaging = {
    id: "",
    code: "",
    name: "",
    default_qty: 0,
    unit: "Kg",
    unit_price: 0,
    initial_stock: 0,
    currency: "IDR",
    status: "Active",
    notes: "",
  };
  const [items, setItems] = useState<Packaging[]>([]);
  const [form, setForm] = useState<Packaging | null>(null);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: Packaging[] }>("/packagings");
      setItems(response.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal memuat packaging");
    }
  }, [notify]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    try {
      const editing = Boolean(form.id);
      await apiFetch(editing ? `/packagings/${form.id}` : "/packagings", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      await load();
      setForm(null);
      notify(`Packaging ${form.name} berhasil disimpan ke database.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menyimpan packaging. Pastikan kode unik.");
    }
  };
  const deactivate = async (packaging: Packaging) => {
    if (!window.confirm(`Hapus packaging ${packaging.name} secara permanen? Seluruh riwayat harga dan pemakaian akan ikut terhapus.`)) return;
    try {
      await apiFetch(`/packagings/${packaging.id}`, { method: "DELETE" });
      await load();
      notify(`${packaging.name} berhasil dihapus dari database.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menghapus packaging");
    }
  };
  const openPriceHistory = async (packaging: Packaging) => {
    const response = await apiFetch<{ data: PackagingPrice[] }>(
      `/packagings/${packaging.id}/prices`,
    );
    setPriceHistory({ packaging, items: response.data });
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = items.filter((item) =>
    `${item.code} ${item.name} ${item.unit} ${item.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="admin-page">
      <MasterHeader
        kicker="MASTER PRODUKSI"
        title="Packaging / Kemasan"
        text="Kelola kode, satuan, harga kemasan, dan histori perukemasan biaya."
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setForm(empty)}>
              <i className="bi bi-plus-lg" /> Tambah Packaging
            </button>
            <button className="btn btn-light" onClick={tutorial.show}>
              <i className="bi bi-info-circle" /> Tutorial
            </button>
          </>
        }
      />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <i className="bi bi-search" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari kode atau nama kemasan..."
            />
          </div>
          <span className="database-pill">
            <i className="bi bi-database-check" /> Database Terhubung ·{" "}
            {items.length} kemasan
          </span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Packaging</th>
                <th>Stok</th>
                <th>Satuan</th>
                <th>Harga Satuan</th>
                <th>Status</th>
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length ? (
                paginated.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={() => setForm(item)}
                  >
                    <td>
                      <strong style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: 800 }}>{item.code}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>{item.name}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--blue)' }}>
                        {Number((item as any).initial_stock || 0).toLocaleString("id-ID")}
                      </strong>
                    </td>
                    <td>{item.unit}</td>
                    <td>
                      <strong className="money-value">
                        {formatRupiah(item.unit_price)}
                      </strong>
                      <small>per {item.unit}</small>
                    </td>
                    <td>
                      <SimpleBadge value={item.status} />
                    </td>
                    <td>{item.notes || "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label={`Edit ${item.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm(item);
                          }}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          aria-label={`Riwayat harga ${item.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void openPriceHistory(item);
                          }}
                        >
                          <i className="bi bi-clock-history" />
                        </button>
                        <button
                          aria-label={`Hapus ${item.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deactivate(item);
                          }}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
                    Tidak ada packaging ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </section>
      {form && (
        <EntityModal
          title={form.id ? "Edit Packaging" : "Tambah Packaging"}
          subtitle="Data tersimpan pada database server lokal."
          onClose={() => setForm(null)}
          onSubmit={save}
        >
          <div className="master-form-grid">
            <label>
              Kode Packaging
              <input
                required
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="MAT-006"
              />
            </label>
            <label>
              Nama Packaging
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Stok Saat Ini
              <input
                type="number"
                step="0.01"
                value={form.initial_stock || 0}
                onChange={(e) =>
                  setForm({ ...form, initial_stock: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Satuan
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option>Kg</option>
                <option>Gram</option>
                <option>Liter</option>
                <option>Ml</option>
                <option>Unit</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
            <label>
              Harga per {form.unit}
              <div className="currency-input">
                <span>Rp</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.unit_price}
                  onChange={(e) =>
                    setForm({ ...form, unit_price: Number(e.target.value) })
                  }
                />
              </div>
            </label>
            {!form.id && (
              <label>
                Stok Awal (Opsional)
                <div className="currency-input">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.initial_stock || 0}
                    onChange={(e) =>
                      setForm({ ...form, initial_stock: Number(e.target.value) })
                    }
                  />
                  <span>{form.unit}</span>
                </div>
              </label>
            )}
            <label className="full-field">
              Catatan
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Catatan spesifikasi atau keselamatan kemasan"
              />
            </label>
          </div>
        </EntityModal>
      )}
      
      {tutorial.open && (
        <TutorialModal content={TUTORIALS.packagings} onClose={tutorial.close} />
      )}
    </div>
  );
}

type Role = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  is_system?: number;
};
type User = {
  id: string;
  username: string;
  name: string;
  role_id: string;
  role_name?: string;
  status: string;
  shift: string;
  employee_no: string;
  password?: string;
};
