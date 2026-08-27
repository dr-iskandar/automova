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
