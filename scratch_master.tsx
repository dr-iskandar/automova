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
  const [priceHistory, setPriceHistory] = useState<{
    packaging: Packaging;
    items: PackagingPrice[];
  } | null>(null);
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
      {priceHistory && (
        <PriceHistoryModal
          packaging={priceHistory.packaging}
          items={priceHistory.items}
          onClose={() => setPriceHistory(null)}
        />
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

