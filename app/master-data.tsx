"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { PrintableTicket } from "./printable-ticket";

type TutorialStep = { title: string; text: string; icon: string };

const TUTORIALS: Record<
  string,
  { title: string; intro: string; steps: TutorialStep[] }
> = {
  materials: {
    title: "Cara mengelola Material",
    intro:
      "Master Material menjadi referensi bahan di seluruh Job dan report penggunaan.",
    steps: [
      {
        title: "Tambah material",
        text: "Tekan Tambah Material, isi kode unik, nama bahan, jumlah default, satuan, dan catatan keselamatan.",
        icon: "bi-plus-circle",
      },
      {
        title: "Periksa satuan",
        text: "Gunakan satuan konsisten seperti Kg, Gram, Liter, Ml, atau Unit agar report dapat dibandingkan.",
        icon: "bi-rulers",
      },
      {
        title: "Edit atau nonaktifkan",
        text: "Klik baris material untuk mengubah data. Material yang pernah dipakai dinonaktifkan, bukan dihapus permanen.",
        icon: "bi-pencil-square",
      },
    ],
  },
  packagings: {
    title: "Cara mengelola Kemasan",
    intro:
      "Master Kemasan menjadi referensi kemasan di seluruh Job dan report penggunaan.",
    steps: [
      {
        title: "Tambah kemasan",
        text: "Tekan Tambah Kemasan, isi kode unik, nama kemasan, jumlah default, satuan, dan informasi stok.",
        icon: "bi-plus-circle",
      },
      {
        title: "Periksa satuan",
        text: "Gunakan satuan konsisten seperti Pcs, Box, atau Drum.",
        icon: "bi-rulers",
      },
      {
        title: "Edit atau hapus",
        text: "Anda dapat mengubah status kemasan atau menghapusnya jika belum digunakan dalam transaksi.",
        icon: "bi-pencil-square",
      },
    ],
  },
  users: {
    title: "Cara mengelola User",
    intro:
      "Setiap user memiliki akun, role, shift, dan status yang menentukan akses aplikasi.",
    steps: [
      {
        title: "Tambah akun",
        text: "Isi nomor pegawai, nama, username, password awal, shift, dan role yang sesuai.",
        icon: "bi-person-plus",
      },
      {
        title: "Tetapkan role",
        text: "Operator menjalankan Job, Supervisor memberi override, Admin mengelola master, Viewer hanya membaca report.",
        icon: "bi-person-lock",
      },
      {
        title: "Nonaktifkan dengan aman",
        text: "Ubah status menjadi Inactive saat user tidak lagi bertugas. Histori batch tetap menyimpan nama operator.",
        icon: "bi-person-x",
      },
    ],
  },
  access: {
    title: "Cara mengatur Hak Akses",
    intro: "Permission membatasi menu dan aksi penting pada setiap role.",
    steps: [
      {
        title: "Pilih role",
        text: "Pilih salah satu role pada panel kiri untuk melihat seluruh permission yang tersedia.",
        icon: "bi-people",
      },
      {
        title: "Aktifkan permission",
        text: "Centang aksi yang diperbolehkan. Pisahkan hak melihat, mengelola, export, dan supervisor override.",
        icon: "bi-ui-checks-grid",
      },
      {
        title: "Simpan perubahan",
        text: "Tekan Simpan Hak Akses. Perubahan berlaku pada login berikutnya dan perlu dicatat pada audit produksi.",
        icon: "bi-shield-check",
      },
    ],
  },
  settings: {
    title: "Cara mengatur Popup Operator",
    intro:
      "Popup digunakan untuk pengingat SOP, keselamatan, atau doa sebelum operator memulai proses.",
    steps: [
      {
        title: "Aktifkan popup",
        text: "Gunakan toggle jika pengingat harus muncul saat operator membuka Job baru.",
        icon: "bi-toggle-on",
      },
      {
        title: "Tulis pesan singkat",
        text: "Buat judul dan pesan yang jelas. Hindari instruksi panjang; detail teknis tetap diletakkan pada step SOP.",
        icon: "bi-card-text",
      },
      {
        title: "Wajibkan pengakuan",
        text: "Jika aktif, operator harus mencentang bahwa pesan telah dibaca sebelum masuk ke halaman proses.",
        icon: "bi-check2-square",
      },
    ],
  },
  jobs: {
    title: "Cara membuat Job",
    intro:
      "Job menyatukan identitas produk, material, step, timer, keputusan, dan pesan awal operator.",
    steps: [
      {
        title: "Lengkapi identitas",
        text: "Isi nama Job, produk, target, unit, area, line, dan shift. Simpan sebagai Draft saat masih disusun.",
        icon: "bi-journal-plus",
      },
      {
        title: "Susun bahan dan step",
        text: "Tambahkan material sesuai urutan lalu edit setiap step: instruksi, warning, durasi, action, serta rule YES/NO.",
        icon: "bi-diagram-3",
      },
      {
        title: "Publish version",
        text: "Validasi Job lalu publish. Sistem menaikkan versi; batch aktif tetap memakai snapshot versi sebelumnya.",
        icon: "bi-cloud-arrow-up",
      },
    ],
  },
  ledger: {
    title: "Cara mencatat penggunaan Material",
    intro:
      "Ledger Material menyimpan setiap barang masuk, pemakaian, dan penyesuaian agar stok dapat ditelusuri periodik.",
    steps: [
      {
        title: "Catat material masuk",
        text: "Tekan Catat Pergerakan, pilih Material Masuk, isi jumlah, waktu, tujuan, dan referensi penerimaan.",
        icon: "bi-box-arrow-in-down",
      },
      {
        title: "Telusuri pemakaian",
        text: "Pemakaian dari batch selesai dicatat otomatis beserta Job, nomor batch, waktu, dan operator.",
        icon: "bi-diagram-3",
      },
      {
        title: "Gunakan filter periode",
        text: "Pilih tanggal, material, atau jenis pergerakan untuk melihat saldo dan recap penggunaan pada periode tertentu.",
        icon: "bi-calendar-range",
      },
    ],
  },
};

function useTutorial(key: keyof typeof TUTORIALS) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const storageKey = `automova-tutorial-${key}`;
    if (!localStorage.getItem(storageKey)) queueMicrotask(() => setOpen(true));
  }, [key]);
  const close = () => {
    localStorage.setItem(`automova-tutorial-${key}`, "seen");
    setOpen(false);
  };
  return { open, show: () => setOpen(true), close };
}

export function TutorialButton({
  tutorialKey,
}: {
  tutorialKey: keyof typeof TUTORIALS;
}) {
  const tutorial = useTutorial(tutorialKey);
  return (
    <>
      <button
        className="btn btn-light info-tutorial-button"
        onClick={tutorial.show}
      >
        <i className="bi bi-info-circle" /> Tutorial
      </button>
      {tutorial.open && (
        <TutorialModal
          content={TUTORIALS[tutorialKey]}
          onClose={tutorial.close}
        />
      )}
    </>
  );
}

function TutorialModal({
  content,
  onClose,
}: {
  content: (typeof TUTORIALS)[string];
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const current = content.steps[step];
  return (
    <div className="modal-backdrop-custom">
      <section
        className="tutorial-modal"
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
      >
        <div className="tutorial-top">
          <span className="tutorial-icon">
            <i className={`bi ${current.icon}`} />
          </span>
          <button onClick={onClose} aria-label="Tutup tutorial">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <p className="section-kicker">
          PANDUAN {step + 1} / {content.steps.length}
        </p>
        <h2>{step === 0 ? content.title : current.title}</h2>
        <p className="tutorial-intro">
          {step === 0 ? content.intro : current.text}
        </p>
        <div className="tutorial-preview">
          <span>
            <i className={`bi ${current.icon}`} />
          </span>
          <div>
            <strong>{current.title}</strong>
            <p>{current.text}</p>
          </div>
        </div>
        <div className="tutorial-dots">
          {content.steps.map((_, index) => (
            <i key={index} className={index === step ? "active" : ""} />
          ))}
        </div>
        <div className="tutorial-actions">
          <button className="btn btn-light" onClick={onClose}>
            Lewati
          </button>
          <div>
            {step > 0 && (
              <button
                className="btn btn-light"
                onClick={() => setStep(step - 1)}
              >
                <i className="bi bi-arrow-left" /> Kembali
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() =>
                step === content.steps.length - 1
                  ? onClose()
                  : setStep(step + 1)
              }
            >
              {step === content.steps.length - 1 ? "Selesai" : "Berikutnya"}
              <i
                className={`bi ${step === content.steps.length - 1 ? "bi-check-lg" : "bi-arrow-right"}`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

type Material = {
  id: string;
  code: string;
  name: string;
  default_qty: number;
  unit: string;
  unit_price: number;
  currency: string;
  status: string;
  notes: string;
  initial_stock?: number;
  min_sku?: number;
};

type MaterialPrice = {
  id: string;
  unit_price: number;
  currency: string;
  effective_at: string;
  notes: string;
  actor: string;
};

export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div
      className="table-pagination-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
        borderTop: "1px solid var(--border-color, #e5e7eb)",
        flexWrap: "wrap",
        gap: "0.75rem",
        fontSize: "11px",
        color: "var(--text-muted, #6b7280)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span>
          Menampilkan <strong>{startItem}</strong> - <strong>{endItem}</strong> dari <strong>{totalItems}</strong> data
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span>Per halaman:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border-color, #d1d5db)",
              background: "var(--bg-panel, #ffffff)",
              fontSize: "10px",
              cursor: "pointer",
            }}
            aria-label="Jumlah per halaman"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <button
          className="btn btn-sm btn-light"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="Halaman Pertama"
          style={{ padding: "0.25rem 0.5rem", opacity: currentPage <= 1 ? 0.5 : 1, cursor: currentPage <= 1 ? "not-allowed" : "pointer" }}
        >
          <i className="bi bi-chevron-double-left" />
        </button>
        <button
          className="btn btn-sm btn-light"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Halaman Sebelumnya"
          style={{ padding: "0.25rem 0.5rem", opacity: currentPage <= 1 ? 0.5 : 1, cursor: currentPage <= 1 ? "not-allowed" : "pointer" }}
        >
          <i className="bi bi-chevron-left" />
        </button>

        <span style={{ margin: "0 0.5rem", fontWeight: 600 }}>
          Halaman {currentPage} / {totalPages}
        </span>

        <button
          className="btn btn-sm btn-light"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Halaman Berikutnya"
          style={{ padding: "0.25rem 0.5rem", opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? "not-allowed" : "pointer" }}
        >
          <i className="bi bi-chevron-right" />
        </button>
        <button
          className="btn btn-sm btn-light"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Halaman Terakhir"
          style={{ padding: "0.25rem 0.5rem", opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? "not-allowed" : "pointer" }}
        >
          <i className="bi bi-chevron-double-right" />
        </button>
      </div>
    </div>
  );
}

export function MaterialMaster({
  authUser,
  notify,
}: {
  authUser: any;
  notify: (message: string) => void;
}) {
  const tutorial = useTutorial("materials");
  const isSuperUser = authUser?.username?.toLowerCase() === "suganda" || authUser?.username?.toLowerCase() === "admin";
  const empty: Material = {
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
    min_sku: 0,
  };
  const [items, setItems] = useState<Material[]>([]);
  const [form, setForm] = useState<Material | null>(null);
  const [query, setQuery] = useState("");
  const [priceHistory, setPriceHistory] = useState<{ material: Material; items: MaterialPrice[] } | null>(null);
  const [masterUnits, setMasterUnits] = useState<{ id: string; name: string }[]>([]);
  const load = useCallback(async () => {
    try {
      const [response, unitsRes] = await Promise.all([
        apiFetch<{ data: Material[] }>("/materials"),
        apiFetch<{ data: { id: string; name: string }[] }>("/master_units")
      ]);
      setItems(response.data);
      setMasterUnits(unitsRes.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal memuat material");
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
      await apiFetch(editing ? `/materials/${form.id}` : "/materials", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      await load();
      setForm(null);
      notify(`Material ${form.name} berhasil disimpan ke database.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menyimpan material. Pastikan kode unik.");
    }
  };
  const deactivate = async (material: Material) => {
    if (!window.confirm(`Hapus material ${material.name} secara permanen? Seluruh riwayat harga dan pemakaian akan ikut terhapus.`)) return;
    try {
      await apiFetch(`/materials/${material.id}`, { method: "DELETE" });
      await load();
      notify(`${material.name} berhasil dihapus dari database.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menghapus material");
    }
  };
  const openPriceHistory = async (material: Material) => {
    const response = await apiFetch<{ data: MaterialPrice[] }>(
      `/materials/${material.id}/prices`,
    );
    setPriceHistory({ material, items: response.data });
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
        title="Material / Bahan"
        text="Kelola kode, satuan, harga bahan, dan histori perubahan biaya."
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setForm(empty)}>
              <i className="bi bi-plus-lg" /> Tambah Material
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
              placeholder="Cari kode atau nama bahan..."
            />
          </div>
          <span className="database-pill">
            <i className="bi bi-database-check" /> Database Terhubung ·{" "}
            {items.length} bahan
          </span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Material</th>
                <th>Stok</th>
                <th>Minimal SKU</th>
                <th>Satuan</th>
                {isSuperUser && <th>Harga Satuan</th>}
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
                      {(() => {
                        const stock = Number((item as any).initial_stock || 0);
                        const isLow = item.min_sku !== undefined && item.min_sku !== null && item.min_sku > 0 && stock <= item.min_sku;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ color: isLow ? '#ef4444' : 'var(--blue)' }}>
                              {stock.toLocaleString("id-ID")}
                            </strong>
                            {isLow && (
                              <span 
                                title={`Stok kritis! Minimal: ${item.min_sku}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#fef08a',
                                  color: '#ca8a04',
                                  borderRadius: '50%',
                                  width: '18px',
                                  height: '18px',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                !
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <strong style={{ color: "var(--muted)", fontWeight: 600 }}>
                        {item.min_sku != null ? item.min_sku.toLocaleString("id-ID") : "0"}
                      </strong>
                    </td>
                    <td>{item.unit}</td>
                    {isSuperUser && (
                      <td>
                        <strong className="money-value">
                          {formatRupiah(item.unit_price)}
                        </strong>
                        <small>per {item.unit}</small>
                      </td>
                    )}
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
                        {isSuperUser && (
                          <button
                            aria-label={`Riwayat harga ${item.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void openPriceHistory(item);
                            }}
                          >
                            <i className="bi bi-clock-history" />
                          </button>
                        )}
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
                  <td colSpan={isSuperUser ? 9 : 8} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
                    Tidak ada material ditemukan.
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
          title={form.id ? "Edit Material" : "Tambah Material"}
          subtitle="Data tersimpan pada database server lokal."
          onClose={() => setForm(null)}
          onSubmit={save}
        >
          <div className="master-form-grid">
            <label>
              Kode Material
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
              Nama Material
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
              Minimal SKU
              <input
                type="number"
                step="0.01"
                value={form.min_sku || 0}
                onChange={(e) =>
                  setForm({ ...form, min_sku: Number(e.target.value) })
                }
                placeholder="Contoh: 300"
              />
            </label>
            <label>
              Satuan
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option value="">Pilih</option>
                {masterUnits.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
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
            {isSuperUser && (
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
            )}
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
                placeholder="Catatan spesifikasi atau keselamatan bahan"
              />
            </label>
          </div>
        </EntityModal>
      )}
      {priceHistory && (
        <PriceHistoryModal
          material={priceHistory.material}
          items={priceHistory.items}
          onClose={() => setPriceHistory(null)}
        />
      )}
      {tutorial.open && (
        <TutorialModal content={TUTORIALS.materials} onClose={tutorial.close} />
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

export function UserMaster({ notify }: { notify: (message: string) => void }) {
  const tutorial = useTutorial("users");
  const empty: User = {
    id: "",
    username: "",
    name: "",
    role_id: "role-operator",
    status: "Active",
    shift: "Shift 1",
    employee_no: "",
    password: "",
  };
  const [items, setItems] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try {
      const [users, roleData] = await Promise.all([
        apiFetch<{ data: User[] }>("/users"),
        apiFetch<{ data: Role[] }>("/roles"),
      ]);
      setItems(users.data);
      setRoles(roleData.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal memuat user");
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
      await apiFetch(editing ? `/users/${form.id}` : "/users", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      await load();
      setForm(null);
      notify(`Akun ${form.name} berhasil disimpan.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menyimpan akun.");
    }
  };
  const deactivate = async (user: User) => {
    if (!window.confirm(`Hapus akun ${user.name}?`)) return;
    try {
      await apiFetch(`/users/${user.id}`, { method: "DELETE" });
      await load();
      notify(`Akun ${user.name} berhasil dinonaktifkan/dihapus.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menghapus akun.");
    }
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = items.filter((item) =>
    `${item.employee_no} ${item.name} ${item.username} ${item.role_name}`
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
        kicker="IDENTITY & ACCESS"
        title="User Management"
        text="Tambah operator, admin, supervisor, dan viewer beserta role masing-masing."
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setForm(empty)}>
              <i className="bi bi-person-plus" /> Tambah User
            </button>
            <button className="btn btn-light" onClick={tutorial.show}>
              <i className="bi bi-info-circle" /> Tutorial
            </button>
          </>
        }
      />
      <div className="master-summary-row">
        <div>
          <i className="bi bi-people" />
          <span>
            <strong>{items.length}</strong>
            <small>Total user</small>
          </span>
        </div>
        <div>
          <i className="bi bi-person-badge" />
          <span>
            <strong>
              {items.filter((i) => i.role_id === "role-operator").length}
            </strong>
            <small>Operator</small>
          </span>
        </div>
        <div>
          <i className="bi bi-shield-lock" />
          <span>
            <strong>
              {items.filter((i) => i.role_id === "role-admin").length}
            </strong>
            <small>Administrator</small>
          </span>
        </div>
        <div>
          <i className="bi bi-person-check" />
          <span>
            <strong>{items.filter((i) => i.status === "Active").length}</strong>
            <small>Akun aktif</small>
          </span>
        </div>
      </div>
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
              placeholder="Cari user, NIP, role..."
            />
          </div>
          <span className="database-pill">
            <i className="bi bi-shield-check" /> Password tersimpan sebagai hash
          </span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>No. Pegawai</th>
                <th>Username</th>
                <th>Role</th>
                <th>Shift</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length ? (
                paginated.map((item) => (
                  <tr
                    key={item.id}
                    className="clickable-row"
                    onClick={() => setForm({ ...item, password: "" })}
                  >
                    <td>
                      <div className="user-cell">
                        <span>
                          {item.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{item.name}</strong>
                      </div>
                    </td>
                    <td>{item.employee_no}</td>
                    <td>@{item.username}</td>
                    <td>
                      <span className="role-table-chip">{item.role_name}</span>
                    </td>
                    <td>{item.shift}</td>
                    <td>
                      <SimpleBadge value={item.status} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({ ...item, password: "" });
                          }}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void deactivate(item);
                          }}
                        >
                          <i className="bi bi-person-x" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
                    Tidak ada user ditemukan.
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
          title={form.id ? "Edit User" : "Tambah User"}
          subtitle="Tetapkan akun dan hak akses yang sesuai tanggung jawab."
          onClose={() => setForm(null)}
          onSubmit={save}
        >
          <div className="master-form-grid">
            <label>
              Nomor Pegawai
              <input
                required
                value={form.employee_no}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employee_no: e.target.value.toUpperCase(),
                  })
                }
                placeholder="OPR-015"
              />
            </label>
            <label>
              Nama Lengkap
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Username
              <input
                required
                value={form.username}
                onChange={(e) =>
                  setForm({
                    ...form,
                    username: e.target.value.toLowerCase().replace(/\s/g, ""),
                  })
                }
              />
            </label>
            <label>
              {form.id ? "Password Baru (opsional)" : "Password Awal"}
              <input
                type="password"
                required={!form.id}
                value={form.password || ""}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              Role
              <select
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
              >
                {roles.map((role) => (
                  <option value={role.id} key={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Shift
              <select
                value={form.shift}
                onChange={(e) => setForm({ ...form, shift: e.target.value })}
              >
                <option>Shift 1</option>
                <option>Shift 2</option>
                <option>Shift 3</option>
                <option>Office</option>
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
          </div>
        </EntityModal>
      )}
      {tutorial.open && (
        <TutorialModal content={TUTORIALS.users} onClose={tutorial.close} />
      )}
    </div>
  );
}

type Permission = { id: string; module: string; action: string; label: string };

export function AccessMaster({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const tutorial = useTutorial("access");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const load = useCallback(async (overrideId?: string) => {
    const response = await apiFetch<{
      data: Role[];
      permissions: Permission[];
    }>("/roles");
    setRoles(response.data);
    setPermissions(response.permissions);
    const activeSelected = overrideId !== undefined ? overrideId : selected;
    const exists = response.data.some((r) => r.id === activeSelected);
    const id = exists ? activeSelected : (response.data[0]?.id || "");
    setSelected(id);
    setDraft(response.data.find((role) => role.id === id)?.permissions || []);
  }, [selected]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => notify(error.message)));
  }, [load, notify]);
  const selectRole = (role: Role) => {
    setSelected(role.id);
    setDraft(role.permissions);
  };
  const toggle = (id: string) =>
    setDraft((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const save = async () => {
    await apiFetch(`/roles/${selected}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions: draft }),
    });
    await load();
    notify("Hak akses role berhasil disimpan ke database.");
  };
  const createRole = async (event: FormEvent) => {
    event.preventDefault();
    const res = await apiFetch<{ id: string }>("/roles", { method: "POST", body: JSON.stringify(newRole) });
    setShowAdd(false);
    setNewRole({ name: "", description: "" });
    await load(res?.id);
    notify("Role baru berhasil ditambahkan.");
  };
  const selectedRole = roles.find((role) => role.id === selected);
  const updateRole = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRole) return;
    await apiFetch(`/roles/${selected}`, {
      method: "PUT",
      body: JSON.stringify(newRole),
    });
    setShowEdit(false);
    await load();
    notify("Nama dan deskripsi role berhasil diperbarui.");
  };
  const deleteRole = async () => {
    if (!selectedRole || !window.confirm(`Hapus role ${selectedRole.name}?`))
      return;
    try {
      await apiFetch(`/roles/${selected}`, { method: "DELETE" });
      await load();
      notify("Role berhasil dihapus.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Role gagal dihapus");
    }
  };
  const grouped = useMemo(
    () =>
      Object.entries(
        permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
          (acc[permission.module] ||= []).push(permission);
          return acc;
        }, {}),
      ),
    [permissions],
  );
  return (
    <div className="admin-page">
      <MasterHeader
        kicker="ROLE-BASED ACCESS"
        title="Hak Akses"
        text="Atur permission menu dan aksi untuk masing-masing role."
        actions={
          <>
            <button
              className="btn btn-primary"
              onClick={() => setShowAdd(true)}
            >
              <i className="bi bi-plus-lg" /> Tambah Role
            </button>
            <button className="btn btn-light" onClick={tutorial.show}>
              <i className="bi bi-info-circle" /> Tutorial
            </button>
          </>
        }
      />
      <div className="access-layout">
        <aside className="panel role-list">
          <div>
            <h2>Daftar Role</h2>
            <small>{roles.length} role terdaftar</small>
          </div>
          {roles.map((role) => (
            <button
              className={selected === role.id ? "selected" : ""}
              key={role.id}
              onClick={() => selectRole(role)}
            >
              <span>
                <i
                  className={`bi ${role.id === "role-admin" ? "bi-shield-lock" : role.id === "role-operator" ? "bi-person-badge" : "bi-people"}`}
                />
              </span>
              <div>
                <strong>{role.name}</strong>
                <small>{role.description}</small>
              </div>
              <i className="bi bi-chevron-right" />
            </button>
          ))}
        </aside>
        <section className="panel permission-panel">
          <div className="permission-head">
            <div>
              <h2>
                {roles.find((role) => role.id === selected)?.name || "Role"}
              </h2>
              <p>Aktifkan permission sesuai kebutuhan operasional.</p>
            </div>
            <div className="header-actions">
              <button
                className="btn btn-light"
                onClick={() => {
                  if (!selectedRole) return;
                  setNewRole({
                    name: selectedRole.name,
                    description: selectedRole.description,
                  });
                  setShowEdit(true);
                }}
              >
                <i className="bi bi-pencil" /> Edit Role
              </button>
              {!selectedRole?.is_system && (
                <button
                  className="btn btn-light danger-button"
                  onClick={() => void deleteRole()}
                >
                  <i className="bi bi-trash" /> Hapus
                </button>
              )}
              <button className="btn btn-primary" onClick={() => void save()}>
                <i className="bi bi-save" /> Simpan Hak Akses
              </button>
            </div>
          </div>
          <div className="permission-grid">
            {grouped.map(([module, items]) => (
              <article key={module}>
                <div>
                  <span>
                    <i className="bi bi-grid" />
                  </span>
                  <strong>{module}</strong>
                </div>
                {items.map((permission) => (
                  <label key={permission.id}>
                    <span>
                      <strong>{permission.label}</strong>
                      <small>{permission.id}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={draft.includes(permission.id)}
                      onChange={() => toggle(permission.id)}
                    />
                  </label>
                ))}
              </article>
            ))}
          </div>
        </section>
      </div>
      {showAdd && (
        <EntityModal
          title="Tambah Role"
          subtitle="Role baru dimulai tanpa permission hingga Anda mengaktifkannya."
          onClose={() => setShowAdd(false)}
          onSubmit={createRole}
        >
          <div className="master-form-grid">
            <label>
              Nama Role
              <input
                required
                value={newRole.name}
                onChange={(e) =>
                  setNewRole({ ...newRole, name: e.target.value })
                }
              />
            </label>
            <label className="full-field">
              Deskripsi
              <textarea
                required
                value={newRole.description}
                onChange={(e) =>
                  setNewRole({ ...newRole, description: e.target.value })
                }
              />
            </label>
          </div>
        </EntityModal>
      )}
      {showEdit && (
        <EntityModal
          title="Edit Role"
          subtitle="Perbarui nama dan deskripsi role tanpa mengubah permission."
          onClose={() => setShowEdit(false)}
          onSubmit={updateRole}
        >
          <div className="master-form-grid">
            <label>
              Nama Role
              <input
                required
                value={newRole.name}
                onChange={(e) =>
                  setNewRole({ ...newRole, name: e.target.value })
                }
              />
            </label>
            <label className="full-field">
              Deskripsi
              <textarea
                required
                value={newRole.description}
                onChange={(e) =>
                  setNewRole({ ...newRole, description: e.target.value })
                }
              />
            </label>
          </div>
        </EntityModal>
      )}
      {tutorial.open && (
        <TutorialModal content={TUTORIALS.access} onClose={tutorial.close} />
      )}
    </div>
  );
}

type Performance = {
  id: string;
  name: string;
  employee_no: string;
  shift: string;
  total_batches: number;
  completed: number;
  paused: number;
  cancelled: number;
  avg_duration: number;
  on_time_rate: number;
  score: number;
  jobs_worked: string[];
  machines_used: string[];
};

export function OperatorPerformance({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [items, setItems] = useState<Performance[]>([]);
  const [from, setFrom] = useState(() => offsetDate(0));
  const [to, setTo] = useState(() => offsetDate(0));
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Performance>("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: Performance[] }>(
        `/performance?${new URLSearchParams({ from, to })}`,
      );
      setItems(response.data);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal memuat performa");
    }
  }, [from, to, notify]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(() => {
      void load();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const handleSort = (field: keyof Performance) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filtered = useMemo(() => {
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.employee_no.toLowerCase().includes(query.toLowerCase()) ||
        item.shift.toLowerCase().includes(query.toLowerCase()),
    );
  }, [items, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filtered, sortField, sortOrder]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const avgScore = items.length
    ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length)
    : 0;
  const avgOnTime = items.length
    ? Math.round(items.reduce((s, i) => s + i.on_time_rate, 0) / items.length)
    : 0;
  const totalCompleted = items.reduce((s, i) => s + i.completed, 0);

  return (
    <div className="admin-page">
      <MasterHeader
        kicker="PEOPLE & PERFORMANCE"
        title="Performa Operator"
        text="Tabel evaluasi kinerja operator berdasarkan penyelesaian batch, durasi rata-rata, dan ketepatan waktu."
        actions={
          <DateRange
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            onApply={() => void load()}
          />
        }
      />

      <div className="master-summary-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div>
          <i className="bi bi-people-fill" />
          <span>
            <strong>{items.length} Operator</strong>
            <small>Total terdaftar</small>
          </span>
        </div>
        <div>
          <i className="bi bi-check-circle-fill" style={{ color: "#059669" }} />
          <span>
            <strong>{totalCompleted} Batch</strong>
            <small>Selesai diproses</small>
          </span>
        </div>
        <div>
          <i className="bi bi-clock-check-fill" style={{ color: "#2563eb" }} />
          <span>
            <strong>{avgOnTime}% Rata-rata</strong>
            <small>Ketepatan Waktu (On-Time)</small>
          </span>
        </div>
        <div>
          <i className="bi bi-award-fill" style={{ color: "#d97706" }} />
          <span>
            <strong>{avgScore} / 100</strong>
            <small>Rata-rata Skor Kinerja</small>
          </span>
        </div>
      </div>

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
              placeholder="Cari nama operator, emp id, shift..."
            />
          </div>
          <span className="database-pill" style={{ color: "var(--muted)", background: "transparent" }}>
            Tabel Interaktif Performa Operator (Klik judul kolom untuk urutkan)
          </span>
        </div>

        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort("score")} style={{ cursor: "pointer" }}>
                  # Rank {sortField === "score" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("name")} style={{ cursor: "pointer" }}>
                  Nama Operator {sortField === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("shift")} style={{ cursor: "pointer" }}>
                  Shift {sortField === "shift" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th>Pekerjaan</th>
                <th>Mesin</th>
                <th onClick={() => handleSort("total_batches")} style={{ cursor: "pointer" }}>
                  Total Batch {sortField === "total_batches" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("completed")} style={{ cursor: "pointer" }}>
                  Selesai {sortField === "completed" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("paused")} style={{ cursor: "pointer" }}>
                  Di-Pause {sortField === "paused" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("on_time_rate")} style={{ cursor: "pointer" }}>
                  On-Time % {sortField === "on_time_rate" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("avg_duration")} style={{ cursor: "pointer" }}>
                  Avg Durasi {sortField === "avg_duration" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("score")} style={{ cursor: "pointer" }}>
                  Skor {sortField === "score" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th>Predikat</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length ? (
                paginated.map((item, idx) => {
                  const rank = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong style={{
                          display: "inline-flex",
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: rank === 1 ? "#fef3c7" : rank === 2 ? "#e0e7ff" : rank === 3 ? "#fee2e2" : "#f3f4f6",
                          color: rank === 1 ? "#b45309" : rank === 2 ? "#3730a3" : rank === 3 ? "#991b1b" : "#4b5563",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px"
                        }}>
                          {rank}
                        </strong>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: "var(--brand-color-light, #e0e7ff)",
                            color: "var(--brand-color, #2563eb)",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px"
                          }}>
                            {item.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </span>
                          <div>
                            <strong style={{ display: "block", fontSize: "11px" }}>{item.name}</strong>
                            <small style={{ color: "#6b7280" }}>{item.employee_no}</small>
                          </div>
                        </div>
                      </td>
                      <td>{item.shift}</td>
                      <td>
                        {item.jobs_worked && item.jobs_worked.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "220px" }}>
                            {item.jobs_worked.map((job, idx) => (
                              <span key={idx} style={{
                                background: "#eff6ff",
                                color: "#1e40af",
                                border: "1px solid #bfdbfe",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "10px",
                                fontWeight: 500,
                                whiteSpace: "nowrap"
                              }}>{job}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#9ca3af", fontSize: "11px" }}>-</span>
                        )}
                      </td>
                      <td>
                        {item.machines_used && item.machines_used.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "150px" }}>
                            {item.machines_used.map((mach, idx) => (
                              <span key={idx} style={{
                                background: "#f3f4f6",
                                color: "#374151",
                                border: "1px solid #d1d5db",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "10px",
                                fontWeight: 500,
                                whiteSpace: "nowrap"
                              }}>{mach}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "#9ca3af", fontSize: "11px" }}>-</span>
                        )}
                      </td>
                      <td><strong>{item.total_batches}</strong></td>
                      <td><span className="badge badge-success">{item.completed}</span></td>
                      <td>{item.paused > 0 ? <span className="badge badge-warning">{item.paused}</span> : "0"}</td>
                      <td>
                        <strong style={{ color: item.on_time_rate >= 80 ? "#059669" : "#d97706" }}>{item.on_time_rate}%</strong>
                      </td>
                      <td>{fmtDuration(item.avg_duration)}</td>
                      <td>
                        <strong style={{ fontSize: "12px", color: item.score >= 85 ? "#059669" : item.score >= 70 ? "#2563eb" : "#dc2626" }}>
                          {item.score}
                        </strong>
                      </td>
                      <td>
                        <span className={`status-badge ${item.score >= 85 ? "status-published" : item.score >= 70 ? "status-draft" : "status-archived"}`}>
                          {item.score >= 85 ? "Sangat Baik" : item.score >= 70 ? "Baik" : "Perlu Perhatian"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                    Tidak ada data performa operator ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={currentPage}
          totalItems={sorted.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </section>
    </div>
  );
}

type BatchRow = {
  id: string;
  job_name: string;
  job_version: number;
  operator_name: string;
  status: string;
  output: number | null;
  unit: string;
  area?: string;
  line?: string;
  started_at: string;
  completed_at: string | null;
  actual_duration: number;
  current_step: number;
  pause_count: number;
  estimated_material_cost: number;
  actual_material_cost: number;
  cost_per_unit: number;
  events?: Array<{
    id: string;
    event_time: string;
    event_type: string;
    title: string;
    detail: string;
    actor: string;
  }>;
};

export function DatabaseBatchHistory({
  notify,
  role = "admin",
  authUser,
}: {
  notify: (message: string) => void;
  role?: "admin" | "supervisor";
  authUser?: any;
}) {
  const isSuperUser = authUser?.username?.toLowerCase() === "suganda" || authUser?.username?.toLowerCase() === "admin";
  const [items, setItems] = useState<BatchRow[]>([]);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<BatchRow | null>(null);
  const [editing, setEditing] = useState<BatchRow | null>(null);
  const [cancelling, setCancelling] = useState<BatchRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(() => offsetDate(-7));
  const [to, setTo] = useState(() => offsetDate(0));
  const load = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    if (status) params.set("status", status);
    const response = await apiFetch<{ data: BatchRow[] }>(`/batches?${params}`);
    setItems(response.data);
  }, [from, status, to]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => notify(error.message)));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load, notify]);
  const openDetail = async (id: string) => {
    try {
      const response = await apiFetch<{ data: BatchRow }>(`/batches/${id}`);
      setDetail(response.data);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Detail batch gagal dimuat",
      );
    }
  };
  const filtered = items.filter((item) =>
    `${item.id} ${item.job_name} ${item.operator_name} ${item.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    await apiFetch(`/batches/${editing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: editing.status,
        output: editing.output,
        unit: editing.unit,
        completed_at: editing.completed_at,
        actual_duration: editing.actual_duration,
        notes: "Koreksi data melalui form Batch History",
      }),
    });
    setEditing(null);
    await load();
    notify("Data batch dan audit trail berhasil diperbarui.");
  };
  const cancelBatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!cancelling) return;
    await apiFetch(`/batches/${cancelling.id}/cancel`, {
      method: "POST",
      body: JSON.stringify({
        actor_role: role,
        actor_name: role === "admin" ? "Administrator" : "Supervisor",
        reason: cancelReason,
      }),
    });
    setCancelling(null);
    setCancelReason("");
    await load();
    notify("Batch dibatalkan dan perubahan tercatat di timeline serta ledger.");
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="admin-page">
      <MasterHeader
        kicker="TRACEABILITY"
        title="Batch History"
        text="Klik batch untuk melihat version snapshot, output, durasi, dan timeline aktivitas."
        actions={
          <DateRange
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            onApply={() => void load()}
          />
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
              placeholder="Cari batch, Job, operator..."
            />
          </div>
          <select
            className="filter-select"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter status batch"
          >
            <option value="">Semua status</option>
            <option>Completed</option>
            <option>Paused</option>
            <option>Cancelled</option>
            <option>In Progress</option>
          </select>
          <span className="database-pill">
            <i className="bi bi-database-check" /> {items.length} transaksi dari
            database
          </span>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Batch No</th>
                <th>Job / Version</th>
                <th>Operator</th>
                <th>Mesin</th>
                <th>Output</th>
                <th>Status</th>
                <th>Mulai</th>
                <th>Durasi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length ? (
                paginated.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="batch-link link-button"
                        onClick={() => void openDetail(item.id)}
                      >
                        {item.id}
                      </button>
                    </td>
                    <td>
                      <strong>{item.job_name}</strong>
                      <small>Version {item.job_version}</small>
                    </td>
                    <td>{item.operator_name}</td>
                    <td>
                      <span style={{
                        background: "#f3f4f6",
                        color: "#374151",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "11px",
                        fontWeight: 500
                      }}>
                        {item.line || "-"}
                      </span>
                    </td>
                    <td>
                      {item.output == null ? "-" : `${item.output} ${item.unit}`}
                    </td>
                    <td>
                      <SimpleBadge value={item.status} />
                    </td>
                    <td>{new Date(item.started_at).toLocaleString("id-ID")}</td>
                    <td>{fmtDuration(item.actual_duration)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          onClick={() => void openDetail(item.id)}
                          aria-label="Lihat detail"
                        >
                          <i className="bi bi-eye" />
                        </button>
                        <button
                          onClick={() => setEditing({ ...item })}
                          aria-label="Edit batch"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        {item.status !== "Cancelled" && (
                          <button
                            onClick={() => {
                              setCancelling(item);
                              setCancelReason("");
                            }}
                            aria-label="Batalkan batch"
                          >
                            <i className="bi bi-x-circle" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
                    Tidak ada riwayat batch ditemukan.
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
      <PrintableTicket
        batch={detail ? {
          batch_no: detail.id,
          job_name: detail.job_name,
          operator: detail.operator_name,
          line: "-",
          start_time: detail.started_at,
          end_time: detail.completed_at || undefined,
          output_qty: detail.output || 0,
          unit: detail.unit,
          status: detail.status,
        } : null}
      />
      {detail && <BatchDetail batch={detail} onClose={() => setDetail(null)} isSuperUser={isSuperUser} />}
      {editing && (
        <EntityModal
          title={`Edit ${editing.id}`}
          subtitle="Koreksi akan dicatat otomatis pada timeline batch."
          onClose={() => setEditing(null)}
          onSubmit={saveEdit}
        >
          <div className="master-form-grid">
            <label>
              Status
              <select
                value={editing.status}
                onChange={(event) =>
                  setEditing({ ...editing, status: event.target.value })
                }
              >
                <option>In Progress</option>
                <option>Paused</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </label>
            <label>
              Output
              <input
                type="number"
                step="0.01"
                value={editing.output ?? ""}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    output: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label>
              Satuan
              <select
                value={editing.unit}
                onChange={(event) =>
                  setEditing({ ...editing, unit: event.target.value })
                }
              >
                <option>Liter</option>
                <option>Kg</option>
                <option>Unit</option>
              </select>
            </label>
            <label>
              Durasi Aktual (detik)
              <input
                type="number"
                value={editing.actual_duration}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    actual_duration: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="full-field">
              Tanggal Selesai
              <input
                type="datetime-local"
                value={toLocalDateTime(editing.completed_at)}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    completed_at: event.target.value
                      ? new Date(event.target.value).toISOString()
                      : null,
                  })
                }
              />
            </label>
          </div>
        </EntityModal>
      )}
      {cancelling && (
        <EntityModal
          title={`Batalkan ${cancelling.id}`}
          subtitle={`${role === "admin" ? "Administrator" : "Supervisor"} dapat membatalkan langsung. Alasan tetap wajib untuk audit.`}
          onClose={() => setCancelling(null)}
          onSubmit={cancelBatch}
        >
          <div className="cancel-history-summary">
            <span>
              <small>Job</small>
              <strong>{cancelling.job_name}</strong>
            </span>
            <span>
              <small>Operator</small>
              <strong>{cancelling.operator_name}</strong>
            </span>
            <span>
              <small>Status Saat Ini</small>
              <SimpleBadge value={cancelling.status} />
            </span>
          </div>
          <label className="modal-field">
            Alasan Pembatalan
            <textarea
              required
              minLength={5}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Jelaskan alasan pembatalan untuk audit produksi"
            />
          </label>
        </EntityModal>
      )}
    </div>
  );
}

function BatchDetail({
  batch,
  onClose,
  isSuperUser = false,
}: {
  batch: BatchRow;
  onClose: () => void;
  isSuperUser?: boolean;
}) {
  const [printMode, setPrintMode] = useState<"label" | null>(null);

  return (
    <div className="modal-backdrop-custom">
      <section className={`batch-detail-modal ${printMode === "label" ? "printing-label" : ""}`}>
        <div className="batch-detail-head">
          <div>
            <p className="section-kicker">DETAIL BATCH</p>
            <h2>{batch.id}</h2>
            <p>
              {batch.job_name} · Version {batch.job_version}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline-primary" onClick={() => {
              setPrintMode("label");
              setTimeout(() => {
                window.print();
                setPrintMode(null);
              }, 100);
            }}>
              <i className="bi bi-printer" /> Cetak Label
            </button>
            <button onClick={onClose}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
        <div className="batch-detail-summary">
          <div>
            <small>Status</small>
            <SimpleBadge value={batch.status} />
          </div>
          <div>
            <small>Operator</small>
            <strong>{batch.operator_name}</strong>
          </div>
          <div>
            <small>Output</small>
            <strong>
              {batch.output == null ? "-" : `${batch.output} ${batch.unit}`}
            </strong>
          </div>
          <div>
            <small>Durasi</small>
            <strong>{fmtDuration(batch.actual_duration)}</strong>
          </div>
          <div>
            <small>Mulai</small>
            <strong>
              {new Date(batch.started_at).toLocaleString("id-ID")}
            </strong>
          </div>
          <div>
            <small>Selesai</small>
            <strong>
              {batch.completed_at
                ? new Date(batch.completed_at).toLocaleString("id-ID")
                : "Belum selesai"}
            </strong>
          </div>
          <div>
            <small>Area / Mesin</small>
            <strong>{batch.area || "-"}</strong>
          </div>
          <div>
            <small>Line</small>
            <strong>{batch.line || "-"}</strong>
          </div>
          {isSuperUser && (
            <>
              <div>
                <small>Estimasi Material</small>
                <strong>{formatRupiah(batch.estimated_material_cost)}</strong>
              </div>
              <div>
                <small>Actual Material</small>
                <strong>{formatRupiah(batch.actual_material_cost)}</strong>
              </div>
              <div>
                <small>Biaya per {batch.unit}</small>
                <strong>{formatRupiah(batch.cost_per_unit)}</strong>
              </div>
            </>
          )}
        </div>
        <div className="timeline-title">
          <h3>Timeline Aktivitas</h3>
          <span>{batch.events?.length || 0} event</span>
        </div>
        <div className="batch-timeline">
          {batch.events?.length ? (
            batch.events.map((event) => (
              <div key={event.id}>
                <span className={`timeline-dot type-${event.event_type}`}>
                  <i
                    className={`bi ${event.event_type === "complete" ? "bi-check-lg" : event.event_type === "start" ? "bi-play-fill" : "bi-list-check"}`}
                  />
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                  <small>
                    {new Date(event.event_time).toLocaleString("id-ID")} ·{" "}
                    {event.actor}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-timeline">Belum ada event tersimpan.</p>
          )}
        </div>
        <div className="batch-detail-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </section>
      
      {printMode === "label" && (
        <PrintableTicket batch={{
          batch_no: (() => {
            const d = new Date(batch.started_at);
            const ddmmyy = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(2)}`;
            return (batch.batch_no || batch.id).replace(/^\d{6}/, ddmmyy);
          })(),
          job_name: batch.job_name,
          operator: batch.operator_name,
          line: "Line N/A",
          start_time: new Date(batch.started_at).toISOString(),
          end_time: batch.completed_at ? new Date(batch.completed_at).toISOString() : undefined,
          output_qty: batch.output || 0,
          unit: batch.unit,
          status: batch.status,
          product_code: batch.packaging_code, // Note: backend uses product_code logic mapped occasionally to packaging_code field on BatchRow
          storage_location: batch.storage_location,
          filling_date: batch.filling_date,
          special_notes: batch.special_notes,
          expired_date: batch.expired_date
        }} />
      )}
    </div>
  );
}

type PopupSetting = {
  enabled: boolean;
  title: string;
  message: string;
  requireAcknowledge: boolean;
};

export function SystemSettingsMaster({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const tutorial = useTutorial("settings");
  const [form, setForm] = useState<PopupSetting>({
    enabled: true,
    title: "",
    message: "",
    requireAcknowledge: true,
  });
  const [backupStatus, setBackupStatus] = useState<{
    last_backup_time: string;
    last_backup_file: string;
    last_backup_size: string;
    total_backups: number;
    backups: Array<{ filename: string; size_mb: string; created_at: string }>;
  } | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [sounds, setSounds] = useState<{ id: string; name: string; filename: string; created_at: string }[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchBackupInfo = useCallback(() => {
    apiFetch<{
      last_backup_time: string;
      last_backup_file: string;
      last_backup_size: string;
      total_backups: number;
      backups: Array<{ filename: string; size_mb: string; created_at: string }>;
    }>("/settings/backup")
      .then((res) => setBackupStatus(res))
      .catch(() => undefined);
  }, []);

  const fetchSounds = useCallback(() => {
    apiFetch<{ data: typeof sounds }>("/sounds")
      .then((res) => setSounds(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiFetch<{ data: PopupSetting }>("/settings/operator-popup")
      .then((response) => setForm(response.data))
      .catch((error) => notify(error.message));
    fetchBackupInfo();
    fetchSounds();
  }, [fetchBackupInfo, fetchSounds, notify]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!uploadName.trim()) {
      notify("Harap masukkan nama suara notifikasi");
      return;
    }
    const fileInput = document.getElementById("sound-file-input") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      notify("Harap pilih file audio (.mp3)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify("Ukuran file maksimal 2MB");
      return;
    }
    
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileData = reader.result as string;
        try {
          const res = await apiFetch<{ ok: boolean }>("/sounds/upload", {
            method: "POST",
            body: JSON.stringify({
              name: uploadName,
              fileData,
              filename: file.name
            })
          });
          if (res.ok) {
            notify("Suara notifikasi berhasil diunggah!");
            setUploadName("");
            if (fileInput) fileInput.value = "";
            fetchSounds();
          }
        } catch (err) {
          notify(err instanceof Error ? err.message : "Gagal mengunggah file");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      notify("Gagal membaca file");
      setUploading(false);
    }
  };

  const handleDeleteSound = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus suara notifikasi ini?")) return;
    try {
      const res = await apiFetch<{ ok: boolean }>(`/sounds/${id}`, { method: "DELETE" });
      if (res.ok) {
        notify("Suara notifikasi berhasil dihapus.");
        fetchSounds();
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menghapus suara");
    }
  };

  const handlePlaySound = (filename: string) => {
    const audio = new Audio(`/api/sounds/file/${filename}`);
    audio.play().catch(() => notify("Gagal memutar audio. Pastikan file valid."));
  };

  const triggerManualBackup = async () => {
    setBackingUp(true);
    try {
      const res = await apiFetch<{ ok: boolean; file?: string; size?: string; error?: string }>("/settings/backup", { method: "POST" });
      if (res.ok) {
        notify(`Cadangkan database '${res.file}' (${res.size}) berhasil dibuat!`);
        fetchBackupInfo();
      } else {
        notify(`Backup gagal: ${res.error}`);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Backup gagal");
    } finally {
      setBackingUp(false);
    }
  };

  const save = async () => {
    await apiFetch("/settings/operator-popup", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    notify("Pengaturan popup operator tersimpan di database.");
  };

  return (
    <div className="admin-page">
      <MasterHeader
        kicker="KONFIGURASI LOKAL"
        title="System Settings"
        text="Atur identitas, perilaku operator, dan pengingat sebelum proses."
        actions={
          <button className="btn btn-light" onClick={tutorial.show}>
            <i className="bi bi-info-circle" /> Tutorial Popup
          </button>
        }
      />
      <div className="settings-grid">
        <section className="panel setting-card popup-setting-card">
          <div className="setting-title-row">
            <span className="setting-icon">
              <i className="bi bi-chat-square-text" />
            </span>
            <div>
              <h2>Popup Awal Operator</h2>
              <p>
                Muncul setelah operator memilih Job dan sebelum timer dapat
                dimulai.
              </p>
            </div>
            <label className="switch-control">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm({ ...form, enabled: e.target.checked })
                }
              />
              <span />
            </label>
          </div>
          <label>
            Judul Popup
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={!form.enabled}
            />
          </label>
          <label>
            Pesan untuk Operator
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              disabled={!form.enabled}
            />
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={form.requireAcknowledge}
              onChange={(e) =>
                setForm({ ...form, requireAcknowledge: e.target.checked })
              }
              disabled={!form.enabled}
            />{" "}
            Operator wajib mencentang “Saya sudah membaca”
          </label>
          <button className="btn btn-primary" onClick={() => void save()}>
            <i className="bi bi-save" /> Simpan Pengaturan
          </button>
        </section>

        <section className="panel popup-preview-card">
          <p className="section-kicker">PREVIEW OPERATOR</p>
          <span className="preview-prayer-icon">
            <i className="bi bi-shield-check" />
          </span>
          <h2>{form.title || "Judul pengingat"}</h2>
          <p>{form.message || "Pesan akan tampil di sini."}</p>
          <label>
            <input type="checkbox" checked={form.requireAcknowledge} readOnly />{" "}
            Saya sudah membaca dan memahami pengingat ini.
          </label>
          <button disabled={!form.enabled}>Lanjut ke Proses</button>
          {!form.enabled && <em>Popup sedang dinonaktifkan</em>}
        </section>

        <section className="panel setting-card" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
          <div className="setting-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span className="setting-icon" style={{ background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", padding: "0.75rem", borderRadius: 10 }}>
                <i className="bi bi-database-fill-check" style={{ fontSize: "24px" }} />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: "16px" }}>Auto Backup & Database Snapshots</h2>
                <p style={{ margin: "0.25rem 0 0 0", color: "#6b7280" }}>
                  Sistem melakukan backup otomatis database setiap 6 jam dan saat aplikasi dinyalakan.
                </p>
              </div>
            </div>
            <button
              className="btn btn-success"
              onClick={() => void triggerManualBackup()}
              disabled={backingUp}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700 }}
            >
              <i className={`bi ${backingUp ? "bi-arrow-repeat spin" : "bi-cloud-arrow-up"}`} />
              {backingUp ? "Membuat Backup..." : "Jalankan Backup Sekarang"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
            <div style={{ background: "var(--surface-color-2, #f9fafb)", padding: "1rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <small style={{ color: "#6b7280", display: "block" }}>STATUS AUTO BACKUP</small>
              <strong style={{ color: "#059669", fontSize: "13px", display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
                <span className="pulse-dot" style={{ background: "#10b981" }} /> Aktif (Otomatis 6 Jam)
              </strong>
            </div>
            <div style={{ background: "var(--surface-color-2, #f9fafb)", padding: "1rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <small style={{ color: "#6b7280", display: "block" }}>BACKUP TERAKHIR</small>
              <strong style={{ color: "#111827", fontSize: "12px", display: "block", marginTop: "0.2rem" }}>
                {backupStatus?.last_backup_time ? new Date(backupStatus.last_backup_time).toLocaleString("id-ID") : "Baru Saja"}
              </strong>
            </div>
            <div style={{ background: "var(--surface-color-2, #f9fafb)", padding: "1rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <small style={{ color: "#6b7280", display: "block" }}>NAMA FILE SNAPSHOT</small>
              <strong style={{ color: "#111827", fontSize: "11px", wordBreak: "break-all", display: "block", marginTop: "0.2rem" }}>
                {backupStatus?.last_backup_file || "automova_backup_auto.sqlite"}
              </strong>
            </div>
            <div style={{ background: "var(--surface-color-2, #f9fafb)", padding: "1rem", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <small style={{ color: "#6b7280", display: "block" }}>TOTAL BACKUP TERSIMPAN</small>
              <strong style={{ color: "#2563eb", fontSize: "14px", display: "block", marginTop: "0.2rem" }}>
                {backupStatus?.total_backups || 1} File Snapshot
              </strong>
            </div>
          </div>

          {backupStatus?.last_backup_file && (
            <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
              <a
                className="btn btn-outline-primary"
                href={`/api/settings/backup/download/${backupStatus.last_backup_file}`}
                download={backupStatus.last_backup_file}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "12px" }}
              >
                <i className="bi bi-download" /> Unduh Snapshot Database (.db)
              </a>
            </div>
          )}
        </section>

        <section className="panel setting-card sound-setting-card" style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
          <div className="setting-title-row" style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <span className="setting-icon" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", padding: "0.75rem", borderRadius: 10 }}>
              <i className="bi bi-volume-up-fill" style={{ fontSize: "24px" }} />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px" }}>Pustaka Suara Notifikasi (Notification Sound Library)</h2>
              <p style={{ margin: "0.25rem 0 0 0", color: "#6b7280" }}>
                Unggah dan kelola file suara kustom (.mp3) untuk berbagai pemicu alarm job dan step pengerjaan.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
            {/* Form Upload */}
            <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingRight: "1rem" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Unggah Suara Baru</h3>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                Nama Panggilan Suara (cth: "Alarm Sirene Besar", "Ding Sukses")
                <input
                  required
                  placeholder="Masukkan nama suara notifikasi..."
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                Pilih File Audio (.mp3 saja, maks 2MB)
                <input
                  type="file"
                  id="sound-file-input"
                  accept="audio/mp3,audio/mpeg"
                  required
                  style={{ padding: "0.5rem", border: "1px dashed #cbd5e1", borderRadius: "8px" }}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={uploading} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start", marginTop: "0.5rem" }}>
                <i className={`bi ${uploading ? "bi-arrow-repeat spin" : "bi-cloud-upload"}`} />
                {uploading ? "Mengunggah..." : "Unggah Suara"}
              </button>
            </form>

            {/* List Suara */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>Daftar Suara Kustom</h3>
              <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem", paddingRight: "0.5rem" }}>
                {sounds.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280", background: "#f9fafb", borderRadius: "8px", border: "1px dashed #e5e7eb" }}>
                    Belum ada suara notifikasi kustom yang diunggah.
                  </div>
                ) : (
                  sounds.map((sound) => (
                    <div key={sound.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <strong style={{ fontSize: "13px", color: "#0f172a" }}>{sound.name}</strong>
                        <small style={{ fontSize: "11px", color: "#64748b" }}>{new Date(sound.created_at).toLocaleString("id-ID")}</small>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handlePlaySound(sound.filename)} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                          <i className="bi bi-play-fill" /> Putar
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteSound(sound.id)} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                          <i className="bi bi-trash" /> Hapus
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      {tutorial.open && (
        <TutorialModal content={TUTORIALS.settings} onClose={tutorial.close} />
      )}
    </div>
  );
}

type DashboardData = {
  from: string;
  to: string;
  summary: {
    total_batches: number;
    total_output: number;
    completed: number;
    paused: number;
    cancelled: number;
    avg_duration: number;
    completion_rate: number;
  };
  daily: Array<{ day: string; output: number; batches: number }>;
  recent: BatchRow[];
  issues: BatchRow[];
  materials: Array<{ name: string; unit: string; qty: number }>;
  machines: Array<{
    machine: string;
    total_batches: number;
    completed: number;
    output: number;
    avg_duration: number;
  }>;
};

export function DynamicDashboard({
  role,
  notify,
  onNavigate,
}: {
  role: string;
  notify: (message: string) => void;
  onNavigate: (view: "history") => void;
}) {
  const [from, setFrom] = useState(() => offsetDate(-7));
  const [to, setTo] = useState(() => offsetDate(0));
  const [data, setData] = useState<DashboardData | null>(null);
  const load = useCallback(async () => {
    const response = await apiFetch<{ data: DashboardData }>(
      `/dashboard?${new URLSearchParams({ from, to })}`,
    );
    setData(response.data);
  }, [from, to]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => notify(error.message)));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load, notify]);
  const maximum = Math.max(
    1,
    ...(data?.daily.map((item) => item.output) || []),
  );
  const metrics = [
    {
      label: "Total Output",
      value: `${Number(data?.summary.total_output || 0).toLocaleString("id-ID")} L`,
      icon: "bi-graph-up-arrow",
      tone: "blue",
    },
    {
      label: "Total Batch",
      value: String(data?.summary.total_batches || 0),
      icon: "bi-box-seam",
      tone: "green",
    },
    {
      label: "Completion Rate",
      value: `${data?.summary.completion_rate || 0}%`,
      icon: "bi-check2-circle",
      tone: "purple",
    },
    {
      label: "Perlu Perhatian",
      value: String(
        Number(data?.summary.paused || 0) +
          Number(data?.summary.cancelled || 0),
      ),
      icon: "bi-exclamation-triangle",
      tone: "orange",
    },
  ];
  return (
    <div className="admin-page">
      <MasterHeader
        kicker="RINGKASAN OPERASIONAL"
        title={`Dashboard ${role.charAt(0).toUpperCase() + role.slice(1)}`}
        text="Seluruh indikator dihitung langsung dari transaksi database sesuai periode terpilih."
        actions={
          <DateRange
            from={from}
            to={to}
            setFrom={setFrom}
            setTo={setTo}
            onApply={() => void load()}
          />
        }
      />
      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span className={`metric-icon ${metric.tone}`}>
              <i className={`bi ${metric.icon}`} />
            </span>
            <div>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <span>
                {from} s/d {to}
              </span>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-card">
          <div className="panel-head">
            <div>
              <h2>Output per Hari</h2>
              <p>Produksi completed pada periode terpilih</p>
            </div>
            <span className="database-pill">
              <i className="bi bi-database-check" /> Live Database
            </span>
          </div>
          <div className="bar-chart">
            {data?.daily.length ? (
              data.daily.map((item) => (
                <div key={item.day}>
                  <span
                    style={{
                      height: `${Math.max(8, (item.output / maximum) * 100)}%`,
                    }}
                  >
                    <em>{Number(item.output).toLocaleString("id-ID")} L</em>
                  </span>
                  <small>
                    {new Date(`${item.day}T00:00:00`).toLocaleDateString(
                      "id-ID",
                      { day: "2-digit", month: "short" },
                    )}
                  </small>
                </div>
              ))
            ) : (
              <p className="empty-state">Tidak ada output pada periode ini.</p>
            )}
          </div>
        </section>
        <section className="panel recent-card">
          <div className="panel-head">
            <div>
              <h2>Batch Terbaru</h2>
              <p>{data?.recent.length || 0} transaksi ditemukan</p>
            </div>
            <button onClick={() => onNavigate("history")}>Lihat semua</button>
          </div>
          <div className="recent-list">
            {data?.recent.map((item) => (
              <div key={item.id}>
                <span
                  className={`recent-status ${item.status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  <i className="bi bi-box-seam" />
                </span>
                <div>
                  <strong>{item.job_name}</strong>
                  <small>
                    {item.id} · {item.operator_name}
                  </small>
                </div>
                <SimpleBadge value={item.status} />
              </div>
            ))}
          </div>
        </section>
        <section className="panel issue-card">
          <div className="panel-head">
            <div>
              <h2>Kendala Produksi</h2>
              <p>Paused dan cancelled pada periode terpilih</p>
            </div>
          </div>
          <div className="issue-list">
            {data?.issues.length ? (
              data.issues.map((item) => (
                <div key={item.id}>
                  <span className="issue-icon orange">
                    <i className="bi bi-exclamation-triangle" />
                  </span>
                  <p>
                    <strong>{item.job_name}</strong>
                    <small>
                      {item.operator_name} · {item.id}
                    </small>
                  </p>
                  <SimpleBadge value={item.status} />
                </div>
              ))
            ) : (
              <p className="empty-state">Tidak ada kendala.</p>
            )}
          </div>
        </section>
        <section className="panel material-card">
          <div className="panel-head">
            <div>
              <h2>Top Bahan Digunakan</h2>
              <p>Akumulasi dari Job pada batch completed</p>
            </div>
          </div>
          {data?.materials.map((material, index) => (
            <div
              className="material-bar"
              key={`${material.name}-${material.unit}`}
            >
              <div>
                <strong>{material.name}</strong>
                <span>
                  {material.qty} {material.unit}
                </span>
              </div>
              <i>
                <em style={{ width: `${Math.max(10, 100 - index * 18)}%` }} />
              </i>
            </div>
          ))}
        </section>
        <section className="panel machine-card" style={{ gridColumn: "span 2" }}>
          <div className="panel-head">
            <div>
              <h2>Analytics Mesin yang Digunakan</h2>
              <p>Penggunaan dan produktivitas mesin operasional pada periode terpilih</p>
            </div>
          </div>
          <div className="responsive-table" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Nama Mesin / Line</th>
                  <th>Total Batch</th>
                  <th>Selesai</th>
                  <th>Total Output</th>
                  <th>Avg Durasi</th>
                </tr>
              </thead>
              <tbody>
                {data?.machines && data.machines.length > 0 ? (
                  data.machines.map((mach, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "#f3f4f6",
                            color: "#4b5563",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px"
                          }}>
                            <i className="bi bi-cpu" />
                          </span>
                          <strong>{mach.machine}</strong>
                        </div>
                      </td>
                      <td><strong>{mach.total_batches}</strong></td>
                      <td><span className="badge badge-success">{mach.completed}</span></td>
                      <td>{Number(mach.output).toLocaleString("id-ID")} L</td>
                      <td>{fmtDuration(mach.avg_duration)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
                      Tidak ada data penggunaan mesin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

type MaterialMovement = {
  id: string;
  material_id: string;
  material_code: string;
  material_name: string;
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

type MaterialMovementSummary = {
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

type MaterialMovementResponse = {
  data: MaterialMovement[];
  summary: MaterialMovementSummary[];
};

export function MaterialLedger({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [from, setFrom] = useState(() => offsetDate(-30));
  const [to, setTo] = useState(() => offsetDate(0));
  const [materialId, setMaterialId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<MaterialMovement[]>([]);
  const [summary, setSummary] = useState<MaterialMovementSummary[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    material_id: "",
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
    if (materialId) params.set("material", materialId);
    if (movementType) params.set("type", movementType);
    const [movementResponse, materialResponse] = await Promise.all([
      apiFetch<MaterialMovementResponse>(`/material-movements?${params}`),
      apiFetch<{ data: Material[] }>("/materials"),
    ]);
    setItems(movementResponse.data);
    setSummary(movementResponse.summary);
    setMaterials(materialResponse.data);
  }, [from, materialId, movementType, to]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => notify(error.message)));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [load, notify]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await apiFetch("/material-movements", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        occurred_at: new Date(form.occurred_at).toISOString(),
      }),
    });
    setShowForm(false);
    setForm({
      material_id: "",
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
    notify("Pergerakan material berhasil dicatat ke ledger.");
  };
  const inCount = items.filter((item) =>
    ["IN", "ADJUSTMENT_IN"].includes(item.movement_type),
  ).length;
  const outCount = items.filter((item) =>
    ["OUT", "ADJUSTMENT_OUT"].includes(item.movement_type),
  ).length;
  const [currentPage, setCurrentPage] = useState(1);
  const remove = async (id: string) => {
    if (!window.confirm("Hapus data pergerakan material ini secara permanen?")) return;
    try {
      await apiFetch(`/material-movements/${id}`, { method: "DELETE" });
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
        title="Penggunaan Material"
        text="Catat material masuk, pemakaian, penyesuaian, waktu, referensi, serta tujuan penggunaannya."
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
      <section className="panel material-ledger-filter">
        <DateRange
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
          onApply={() => void load()}
        />
        <label>
          Material
          <select
            value={materialId}
            onChange={(event) => {
              setMaterialId(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Semua material</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.code} · {material.name}
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
            <option value="IN">Material Masuk</option>
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
            <small>Material Tercatat</small>
            <strong>{summary.length}</strong>
            <span>Saldo dapat ditelusuri</span>
          </div>
        </article>
      </div>
      
      <section className="panel table-panel" style={{ marginBottom: "16px" }}>
        <div className="panel-head" style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1, display: "flex", gap: "10px", alignItems: "center" }}>
            <h2 style={{ minWidth: "220px" }}>Ringkasan Penggunaan Material</h2>
            <div className="editor-search" style={{ margin: 0, flex: 1, maxWidth: "400px" }}>
              <i className="bi bi-search" />
              <input 
                type="search" 
                placeholder="Cari nama atau kode material..." 
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
                <th>Material</th>
                <th>Masuk</th>
                <th>Dipakai</th>
                <th>Saldo Saat Ini</th>
              </tr>
            </thead>
            <tbody>
              {summary.filter(m => 
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                m.code.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((material) => (
                <tr key={material.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--text-main)', fontWeight: 800 }}>{material.code}</strong>
                      <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{material.name}</span>
                    </div>
                  </td>
                  <td><span className="movement-in" style={{ color: "var(--green)", fontWeight: 600 }}>+{Number(material.qty_in).toLocaleString("id-ID")} {material.unit}</span></td>
                  <td><span className="movement-out" style={{ color: "var(--red)", fontWeight: 600 }}>−{Number(material.qty_out).toLocaleString("id-ID")} {material.unit}</span></td>
                  <td><strong>{Number(material.balance).toLocaleString("id-ID")} {material.unit}</strong></td>
                </tr>
              ))}
              {summary.filter(m => 
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                m.code.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    Material tidak ditemukan.
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
                <th>Material</th>
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
                        <strong style={{ fontSize: '16px', color: 'var(--text-main)', fontWeight: 800 }}>{item.material_code}</strong>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{item.material_name}</span>
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
                    Tidak ada transaksi pergerakan material ditemukan.
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
          title="Catat Pergerakan Material"
          subtitle="Semua perubahan stok disimpan beserta waktu, tujuan, dan pencatatnya."
          onClose={() => setShowForm(false)}
          onSubmit={submit}
        >
          <div className="master-form-grid">
            <label>
              Material
              <select
                required
                value={form.material_id}
                onChange={(event) => {
                  const material = materials.find(
                    (item) => item.id === event.target.value,
                  );
                  setForm({
                    ...form,
                    material_id: event.target.value,
                    unit: material?.unit || form.unit,
                  });
                }}
              >
                <option value="">Pilih material</option>
                {materials
                  .filter((material) => material.status === "Active")
                  .map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.code} · {material.name}
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
                <option value="IN">Material Masuk</option>
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
  material_breakdown: Array<{
    code: string;
    name: string;
    unit: string;
    qty: number;
    cost: number;
  }>;
};

export function ReportManager({
  notify,
  authUser,
}: {
  notify: (message: string) => void;
  authUser?: any;
}) {
  const isSuperUser = authUser?.username?.toLowerCase() === "suganda" || authUser?.username?.toLowerCase() === "admin";
  const [from, setFrom] = useState(() => offsetDate(-7));
  const [to, setTo] = useState(() => offsetDate(0));
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<
    "production" | "material" | "finance" | "saved"
  >("production");

  useEffect(() => {
    if (tab === "finance" && !isSuperUser) {
      setTab("production");
    }
  }, [tab, isSuperUser]);
  const [jobFilter, setJobFilter] = useState("");
  const [jobOptions, setJobOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [items, setItems] = useState<BatchRow[]>([]);
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [materialItems, setMaterialItems] = useState<MaterialMovement[]>([]);
  const [materialSummary, setMaterialSummary] = useState<
    MaterialMovementSummary[]
  >([]);
  const [finance, setFinance] = useState<FinanceData>({
    rows: [],
    summary: {
      completed_batches: 0,
      estimated_cost: 0,
      actual_cost: 0,
      variance: 0,
      total_output: 0,
      cost_per_unit: 0,
    },
    material_breakdown: [],
  });
  const [editing, setEditing] = useState<ReportPreset | null>(null);

  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);

  const paginatedReportItems = useMemo(() => {
    const start = (reportPage - 1) * reportPageSize;
    return items.slice(start, start + reportPageSize);
  }, [items, reportPage, reportPageSize]);

  const paginatedMaterialItems = useMemo(() => {
    const start = (reportPage - 1) * reportPageSize;
    return materialItems.slice(start, start + reportPageSize);
  }, [materialItems, reportPage, reportPageSize]);

  const paginatedFinanceRows = useMemo(() => {
    const start = (reportPage - 1) * reportPageSize;
    return finance.rows.slice(start, start + reportPageSize);
  }, [finance.rows, reportPage, reportPageSize]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    if (status) params.set("status", status);
    const financeParams = new URLSearchParams({ from, to });
    if (jobFilter) financeParams.set("job", jobFilter);
    const [
      batchResponse,
      presetResponse,
      movementResponse,
      financeResponse,
      jobsResponse,
    ] = await Promise.all([
      apiFetch<{ data: BatchRow[] }>(`/batches?${params}`),
      apiFetch<{ data: ReportPreset[] }>("/reports"),
      apiFetch<MaterialMovementResponse>(`/material-movements?${params}`),
      apiFetch<{ data: FinanceData }>(`/finance?${financeParams}`),
      apiFetch<{ data: Array<{ id: string; name: string }> }>("/jobs"),
    ]);
    setItems(batchResponse.data);
    setPresets(presetResponse.data);
    setMaterialItems(movementResponse.data);
    setMaterialSummary(movementResponse.summary);
    setFinance(financeResponse.data);
    setJobOptions(jobsResponse.data);
  }, [from, jobFilter, status, to]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => notify(error.message)));
  }, [load, notify]);
  const savePreset = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    await apiFetch(editing.id ? `/reports/${editing.id}` : "/reports", {
      method: editing.id ? "PUT" : "POST",
      body: JSON.stringify(editing),
    });
    setEditing(null);
    await load();
    notify("Konfigurasi report berhasil disimpan.");
  };
  const deletePreset = async (preset: ReportPreset) => {
    if (!window.confirm(`Hapus report ${preset.name}?`)) return;
    await apiFetch(`/reports/${preset.id}`, { method: "DELETE" });
    await load();
    notify("Report tersimpan berhasil dihapus.");
  };
  const exportCsv = () => {
    let rows: unknown[][];
    if (tab === "finance")
      rows = [
        [
          "Batch",
          "Job",
          "Output",
          "Estimasi Material",
          "Actual Material",
          "Variance",
          "Variance %",
          "Cost per Unit",
          "Tanggal",
        ],
        ...finance.rows.map((item) => [
          item.id,
          item.job_name,
          item.output ?? "",
          item.estimated_material_cost,
          item.actual_material_cost,
          item.variance,
          item.variance_percent,
          item.cost_per_unit,
          item.started_at,
        ]),
      ];
    else if (tab === "material")
      rows = [
        [
          "Waktu",
          "Kode",
          "Material",
          "Jenis",
          "Jumlah",
          "Unit",
          "Nilai",
          "Tujuan",
          "Batch",
          "Referensi",
          "Pencatat",
        ],
        ...materialItems.map((item) => [
          item.occurred_at,
          item.material_code,
          item.material_name,
          movementLabel(item.movement_type),
          item.qty,
          item.unit,
          item.total_cost,
          item.purpose,
          item.batch_id || "",
          item.reference,
          item.actor,
        ]),
      ];
    else
      rows = [
        ["Batch", "Job", "Operator", "Status", "Output", "Unit", "Mulai"],
        ...items.map((item) => [
          item.id,
          item.job_name,
          item.operator_name,
          item.status,
          item.output ?? "",
          item.unit,
          item.started_at,
        ]),
      ];
    const blob = new Blob(
      [rows.map((row) => row.map(csvCell).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `automova-${tab}-report-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const completed = items.filter((item) => item.status === "Completed");
  const totalOutput = completed.reduce(
    (sum, item) => sum + Number(item.output || 0),
    0,
  );
  return (
    <div className="admin-page">
      <MasterHeader
        kicker="REPORT & EXPORT"
        title="Report Center"
        text="Satu tempat untuk ringkasan produksi, penggunaan material, dan konfigurasi report periodik."
        actions={
          <>
            {tab !== "saved" && (
              <button
                className="btn btn-light"
                onClick={() =>
                  setEditing({
                    id: "",
                    name: "",
                    report_type:
                      tab === "material"
                        ? "Material Usage"
                        : tab === "finance"
                          ? "Simple Finance"
                          : "Production Summary",
                    from_date: from,
                    to_date: to,
                    status_filter: status,
                    job_filter: "",
                  })
                }
              >
                <i className="bi bi-bookmark-plus" /> Simpan Konfigurasi
              </button>
            )}
            {tab !== "saved" && (
              <button className="btn btn-primary" onClick={exportCsv}>
                <i className="bi bi-download" /> Export CSV
              </button>
            )}
          </>
        }
      />
      <nav className="report-tabs" aria-label="Jenis report">
        <button
          className={tab === "production" ? "active" : ""}
          onClick={() => setTab("production")}
        >
          <i className="bi bi-bar-chart-line" />
          <span>Produksi</span>
        </button>
        <button
          className={tab === "material" ? "active" : ""}
          onClick={() => setTab("material")}
        >
          <i className="bi bi-boxes" />
          <span>Material</span>
        </button>
        {isSuperUser && (
          <button
            className={tab === "finance" ? "active" : ""}
            onClick={() => setTab("finance")}
          >
            <i className="bi bi-cash-coin" />
            <span>Finance</span>
          </button>
        )}
        <button
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
        >
          <i className="bi bi-bookmarks" />
          <span>Report Tersimpan</span>
        </button>
      </nav>
      <section className="panel report-filter-panel">
        <DateRange
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
          onApply={() => void load()}
        />
        {tab === "production" && (
          <select
            className="filter-select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Semua status</option>
            <option>Completed</option>
            <option>Paused</option>
            <option>Cancelled</option>
            <option>In Progress</option>
          </select>
        )}
        {tab === "finance" && (
          <select
            className="filter-select"
            value={jobFilter}
            onChange={(event) => setJobFilter(event.target.value)}
          >
            <option value="">Semua Job</option>
            {jobOptions.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
        )}
        <span className="report-period-note">
          <i className="bi bi-calendar-check" />
          Data {from} sampai {to}
        </span>
      </section>
      {tab === "production" && (
        <div className="report-kpi-row report-kpi-modern">
          <div>
            <small>Total Batch</small>
            <strong>{items.length}</strong>
            <span>Periode terpilih</span>
          </div>
          <div>
            <small>Total Output</small>
            <strong>{totalOutput.toLocaleString("id-ID")} L</strong>
            <span>Dari batch completed</span>
          </div>
          <div>
            <small>Average Duration</small>
            <strong>
              {fmtDuration(
                completed.length
                  ? Math.round(
                      completed.reduce(
                        (sum, item) => sum + item.actual_duration,
                        0,
                      ) / completed.length,
                    )
                  : 0,
              )}
            </strong>
            <span>Per completed batch</span>
          </div>
          <div>
            <small>Completion Rate</small>
            <strong>
              {items.length
                ? Math.round((completed.length / items.length) * 1000) / 10
                : 0}
              %
            </strong>
            <span>Completed / total batch</span>
          </div>
        </div>
      )}
      {tab === "material" && (
        <div className="report-kpi-row report-kpi-modern">
          <div>
            <small>Material Tercatat</small>
            <strong>{materialSummary.length}</strong>
            <span>Jenis material</span>
          </div>
          <div>
            <small>Transaksi Masuk</small>
            <strong>
              {
                materialItems.filter((item) =>
                  ["IN", "ADJUSTMENT_IN"].includes(item.movement_type),
                ).length
              }
            </strong>
            <span>Penerimaan dan adjustment</span>
          </div>
          <div>
            <small>Transaksi Pemakaian</small>
            <strong>
              {
                materialItems.filter((item) =>
                  ["OUT", "ADJUSTMENT_OUT"].includes(item.movement_type),
                ).length
              }
            </strong>
            <span>Job dan pemakaian manual</span>
          </div>
          <div>
            <small>Terhubung Batch</small>
            <strong>
              {materialItems.filter((item) => item.batch_id).length}
            </strong>
            <span>Dapat ditelusuri ke produksi</span>
          </div>
        </div>
      )}
      {tab === "finance" && (
        <div className="finance-kpi-grid">
          <article>
            <span className="finance-kpi-icon estimate">
              <i className="bi bi-calculator" />
            </span>
            <div>
              <small>Estimasi Material</small>
              <strong>{formatRupiah(finance.summary.estimated_cost)}</strong>
              <span>{finance.summary.completed_batches} batch completed</span>
            </div>
          </article>
          <article>
            <span className="finance-kpi-icon actual">
              <i className="bi bi-cash-stack" />
            </span>
            <div>
              <small>Actual Material Cost</small>
              <strong>{formatRupiah(finance.summary.actual_cost)}</strong>
              <span>Berdasarkan ledger pemakaian</span>
            </div>
          </article>
          <article>
            <span
              className={`finance-kpi-icon ${finance.summary.variance > 0 ? "bad" : "good"}`}
            >
              <i className="bi bi-graph-up-arrow" />
            </span>
            <div>
              <small>Variance</small>
              <strong
                className={
                  finance.summary.variance > 0
                    ? "finance-negative"
                    : "finance-positive"
                }
              >
                {formatRupiah(finance.summary.variance)}
              </strong>
              <span>Actual dikurangi estimasi</span>
            </div>
          </article>
          <article>
            <span className="finance-kpi-icon unit">
              <i className="bi bi-speedometer" />
            </span>
            <div>
              <small>Rata-rata Cost per Unit</small>
              <strong>{formatRupiah(finance.summary.cost_per_unit)}</strong>
              <span>Total actual / total output</span>
            </div>
          </article>
        </div>
      )}
      {tab === "saved" && (
        <section className="panel table-panel saved-report-panel">
          <div className="panel-head">
            <div>
              <h2>Report Tersimpan</h2>
              <p>{presets.length} konfigurasi</p>
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Periode</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((preset) => (
                  <tr key={preset.id}>
                    <td>
                      <strong>{preset.name}</strong>
                    </td>
                    <td>{preset.report_type}</td>
                    <td>
                      {preset.from_date} – {preset.to_date}
                    </td>
                    <td>{preset.status_filter || "Semua"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          onClick={() => {
                            setFrom(preset.from_date);
                            setTo(preset.to_date);
                            setStatus(preset.status_filter);
                            setJobFilter(preset.job_filter || "");
                            setTab(
                              preset.report_type === "Material Usage"
                                ? "material"
                                : preset.report_type === "Simple Finance"
                                  ? "finance"
                                  : "production",
                            );
                          }}
                          aria-label="Gunakan report"
                        >
                          <i className="bi bi-play" />
                        </button>
                        <button
                          onClick={() => setEditing({ ...preset })}
                          aria-label="Edit report"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          onClick={() => void deletePreset(preset)}
                          aria-label="Hapus report"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "production" && (
        <section className="panel table-panel report-data-panel">
          <div className="panel-head">
            <div>
              <h2>Data Report</h2>
              <p>{items.length} transaksi sesuai filter</p>
            </div>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Job</th>
                  <th>Operator</th>
                  <th>Status</th>
                  <th>Output</th>
                  <th>Mulai</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReportItems.length ? (
                  paginatedReportItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.job_name}</td>
                      <td>{item.operator_name}</td>
                      <td>
                        <SimpleBadge value={item.status} />
                      </td>
                      <td>
                        {item.output ?? "-"}{" "}
                        {item.output == null ? "" : item.unit}
                      </td>
                      <td>{new Date(item.started_at).toLocaleString("id-ID")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
                      Tidak ada data batch ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={reportPage}
            totalItems={items.length}
            pageSize={reportPageSize}
            onPageChange={setReportPage}
            onPageSizeChange={(size) => {
              setReportPageSize(size);
              setReportPage(1);
            }}
          />
        </section>
      )}
      {tab === "material" && (
        <section className="panel table-panel report-data-panel">
          <div className="panel-head">
            <div>
              <h2>Recap Penggunaan Material</h2>
              <p>
                Masuk, dipakai, saldo, kapan, dan untuk apa pada periode
                terpilih.
              </p>
            </div>
            <span className="database-pill">
              <i className="bi bi-link-45deg" /> Terhubung Job & Batch
            </span>
          </div>
          <div className="material-report-summary">
            {materialSummary.map((material) => (
              <article key={material.id}>
                <header>
                  <span>{material.code}</span>
                  <strong>{material.name}</strong>
                </header>
                <div>
                  <span>
                    <small>Masuk</small>
                    <strong className="movement-in">
                      +{Number(material.qty_in).toLocaleString("id-ID")}{" "}
                      {material.unit}
                    </strong>
                  </span>
                  <span>
                    <small>Dipakai</small>
                    <strong className="movement-out">
                      −{Number(material.qty_out).toLocaleString("id-ID")}{" "}
                      {material.unit}
                    </strong>
                  </span>
                  <span>
                    <small>Saldo Saat Ini</small>
                    <strong>
                      {Number(material.balance).toLocaleString("id-ID")}{" "}
                      {material.unit}
                    </strong>
                  </span>
                </div>
              </article>
            ))}
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Material</th>
                  <th>Jenis</th>
                  <th>Jumlah</th>
                  <th>Tujuan / Batch</th>
                  <th>Pencatat</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMaterialItems.length ? (
                  paginatedMaterialItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {new Date(item.occurred_at).toLocaleString("id-ID")}
                      </td>
                      <td>
                        <strong>{item.material_name}</strong>
                        <small>{item.material_code}</small>
                      </td>
                      <td>
                        <span
                          className={`movement-badge ${item.movement_type.toLowerCase()}`}
                        >
                          {movementLabel(item.movement_type)}
                        </span>
                      </td>
                      <td>
                        {Number(item.qty).toLocaleString("id-ID")} {item.unit}
                      </td>
                      <td>
                        <strong>{item.purpose || "-"}</strong>
                        <small>{item.batch_id || item.reference || "-"}</small>
                      </td>
                      <td>{item.actor || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
                      Tidak ada pergerakan material ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={reportPage}
            totalItems={materialItems.length}
            pageSize={reportPageSize}
            onPageChange={setReportPage}
            onPageSizeChange={(size) => {
              setReportPageSize(size);
              setReportPage(1);
            }}
          />
        </section>
      )}
      {tab === "finance" && (
        <>
          {finance.material_breakdown.length > 0 && (
            <section className="panel table-panel finance-breakdown-panel">
              <div className="panel-head">
                <div>
                  <h2>Breakdown Material Terpakai</h2>
                  <p>Akumulasi pemakaian bahan dari batch completed pada periode terpilih.</p>
                </div>
              </div>
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Nama Material</th>
                      <th>Qty Terpakai</th>
                      <th>Nilai</th>
                      <th>% dari Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.material_breakdown.map((item) => (
                      <tr key={item.code}>
                        <td><span className="batch-link">{item.code}</span></td>
                        <td><strong>{item.name}</strong></td>
                        <td>{Number(item.qty).toLocaleString("id-ID")} {item.unit}</td>
                        <td><strong className="money-value">{formatRupiah(item.cost)}</strong></td>
                        <td>
                          {finance.summary.actual_cost > 0
                            ? `${((item.cost / finance.summary.actual_cost) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {finance.rows.length > 0 && (
            <section className="panel table-panel finance-detail-panel">
              <div className="panel-head">
                <div>
                  <h2>Detail per Batch</h2>
                  <p>{finance.rows.length} batch completed pada periode terpilih.</p>
                </div>
              </div>
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Job</th>
                      <th>Output</th>
                      <th>Estimasi Material</th>
                      <th>Actual Material</th>
                      <th>Variance</th>
                      <th>Variance %</th>
                      <th>Cost / Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFinanceRows.map((item) => (
                      <tr key={item.id}>
                        <td><span className="batch-link">{item.id}</span></td>
                        <td>
                          <strong>{item.job_name}</strong>
                          <small>v{item.job_version}</small>
                        </td>
                        <td>{item.output != null ? `${item.output} ${item.unit}` : "—"}</td>
                        <td>{formatRupiah(item.estimated_material_cost)}</td>
                        <td><strong>{formatRupiah(item.actual_material_cost)}</strong></td>
                        <td>
                          <span className={item.variance > 0 ? "finance-negative" : "finance-positive"}>
                            {item.variance > 0 ? "+" : ""}{formatRupiah(item.variance)}
                          </span>
                        </td>
                        <td>
                          <span className={item.variance_percent > 0 ? "finance-negative" : "finance-positive"}>
                            {item.variance_percent > 0 ? "+" : ""}{item.variance_percent}%
                          </span>
                        </td>
                        <td>{formatRupiah(item.cost_per_unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={reportPage}
                totalItems={finance.rows.length}
                pageSize={reportPageSize}
                onPageChange={setReportPage}
                onPageSizeChange={(size) => {
                  setReportPageSize(size);
                  setReportPage(1);
                }}
              />
            </section>
          )}
          {finance.rows.length === 0 && (
            <section className="panel">
              <div className="empty-state" style={{ padding: "2.5rem", textAlign: "center" }}>
                <i className="bi bi-cash-coin" style={{ fontSize: "36px", opacity: 0.3 }} />
                <p style={{ marginTop: "1rem", color: "var(--muted)" }}>Belum ada batch completed pada periode terpilih.</p>
              </div>
            </section>
          )}
        </>
      )}
      {editing && (
        <EntityModal
          title={editing.id ? "Edit Report" : "Simpan Report Baru"}
          subtitle="Konfigurasi periode dan filter disimpan ke database."
          onClose={() => setEditing(null)}
          onSubmit={savePreset}
        >
          <div className="master-form-grid">
            <label className="full-field">
              Nama Report
              <input
                required
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <label>
              Jenis Report
              <select
                value={editing.report_type}
                onChange={(event) =>
                  setEditing({ ...editing, report_type: event.target.value })
                }
              >
                <option>Production Summary</option>
                <option>Material Usage</option>
                <option>Simple Finance</option>
              </select>
            </label>
            <label>
              Dari
              <input
                type="date"
                value={editing.from_date}
                onChange={(event) =>
                  setEditing({ ...editing, from_date: event.target.value })
                }
              />
            </label>
            <label>
              Sampai
              <input
                type="date"
                value={editing.to_date}
                onChange={(event) =>
                  setEditing({ ...editing, to_date: event.target.value })
                }
              />
            </label>
            <label>
              Status
              <select
                value={editing.status_filter}
                onChange={(event) =>
                  setEditing({ ...editing, status_filter: event.target.value })
                }
              >
                <option value="">Semua</option>
                <option>Completed</option>
                <option>Paused</option>
                <option>Cancelled</option>
              </select>
            </label>
          </div>
        </EntityModal>
      )}
    </div>
  );
}

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  link_view: string;
  created_at: string;
};

export function NotificationCenter({
  role,
  onNavigate,
}: {
  role: string;
  onNavigate: (view: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const load = useCallback(async () => {
    const response = await apiFetch<{ data: NotificationItem[] }>(
      `/notifications?role=${role}`,
    );
    setItems(response.data);
  }, [role]);
  useEffect(() => {
    queueMicrotask(() => void load().catch(() => undefined));
    const timer = window.setInterval(
      () => void load().catch(() => undefined),
      30000,
    );
    return () => window.clearInterval(timer);
  }, [load]);
  const unread = items.filter((item) => !item.is_read).length;
  const openItem = async (item: NotificationItem) => {
    await apiFetch(`/notifications/${item.id}`, { method: "PUT" });
    if (item.link_view) onNavigate(item.link_view);
    setOpen(false);
    await load();
  };
  const readAll = async () => {
    await apiFetch("/notifications/read-all", {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    await load();
  };
  return (
    <div className="notification-center">
      <button
        className="icon-btn notification-btn"
        aria-label="Notifikasi"
        onClick={() => setOpen((value) => !value)}
      >
        <i className="bi bi-bell" />
        {unread > 0 && <span>{unread}</span>}
      </button>
      {open && (
        <section className="notification-panel">
          <div className="notification-panel-head">
            <div>
              <strong>Notifikasi</strong>
              <small>{unread} belum dibaca</small>
            </div>
            <button onClick={() => void readAll()}>Tandai semua dibaca</button>
          </div>
          <div className="notification-list">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  className={item.is_read ? "read" : ""}
                  onClick={() => void openItem(item)}
                >
                  <span className={`notification-type ${item.type}`}>
                    <i
                      className={`bi ${item.type === "warning" ? "bi-exclamation-triangle" : item.type === "success" ? "bi-check-circle" : "bi-info-circle"}`}
                    />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.message}</small>
                    <time>
                      {new Date(item.created_at).toLocaleString("id-ID")}
                    </time>
                  </span>
                </button>
              ))
            ) : (
              <p className="empty-state">Belum ada notifikasi.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function DateRange({
  from,
  to,
  setFrom,
  setTo,
  onApply,
}: {
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="date-range">
      <label>
        Dari
        <input
          type="date"
          value={from}
          max={to}
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      <label>
        Sampai
        <input
          type="date"
          value={to}
          min={from}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      <button className="btn btn-primary" onClick={onApply}>
        <i className="bi bi-funnel" /> Terapkan
      </button>
    </div>
  );
}

const offsetDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const toLocalDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const movementLabel = (type: MaterialMovement["movement_type"]) =>
  ({
    IN: "Material Masuk",
    OUT: "Pemakaian",
    ADJUSTMENT_IN: "Penyesuaian Tambah",
    ADJUSTMENT_OUT: "Penyesuaian Kurang",
  })[type];

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function PriceHistoryModal({
  material,
  items,
  onClose,
}: {
  material: Material;
  items: MaterialPrice[];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop-custom">
      <section className="price-history-modal">
        <div className="entity-modal-head">
          <div>
            <p className="section-kicker">HISTORI HARGA</p>
            <h2>{material.name}</h2>
            <p>
              {material.code} · Harga aktif {formatRupiah(material.unit_price)}{" "}
              per {material.unit}
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup histori harga">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="price-history-list">
          {items.map((item, index) => (
            <article key={item.id}>
              <span className={index === 0 ? "current" : ""}>
                <i className="bi bi-cash-stack" />
              </span>
              <div>
                <strong>{formatRupiah(item.unit_price)}</strong>
                <small>
                  Berlaku{" "}
                  {new Date(item.effective_at).toLocaleString("id-ID")} ·{" "}
                  {item.actor || "Administrator"}
                </small>
                <p>{item.notes || "Perubahan harga material"}</p>
              </div>
              {index === 0 && <em>Aktif</em>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MasterHeader({
  kicker,
  title,
  text,
  actions,
}: {
  kicker: string;
  title: string;
  text: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="header-actions">{actions}</div>
    </div>
  );
}

function EntityModal({
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <div className="modal-backdrop-custom">
      <form className="entity-modal" onSubmit={onSubmit}>
        <div className="entity-modal-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        {children}
        <div className="entity-modal-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary">
            <i className="bi bi-database-check" /> Simpan ke Database
          </button>
        </div>
      </form>
    </div>
  );
}

function SimpleBadge({ value }: { value: string }) {
  const tone = value.toLowerCase().replaceAll(" ", "-");
  return (
    <span className={`status-badge status-${tone}`}>
      <span className="status-dot" />
      {value}
    </span>
  );
}

const fmtDuration = (seconds: number) => {
  const value = Number(seconds || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};
export function GenericMasterList({
  title,
  endpoint,
  hasAreaId,
  hasCode,
  notify,
}: {
  title: string;
  endpoint: string;
  hasAreaId?: boolean;
  hasCode?: boolean;
  notify: (msg: string) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [areas, setAreas] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const res = await apiFetch<{ data: any[] }>(endpoint);
      setItems(res.data);
      if (hasAreaId) {
        const areaRes = await apiFetch<{ data: any[] }>("/master_areas");
        setAreas(areaRes.data);
      }
    } catch (e) {
      notify("Gagal memuat data " + title);
    }
  };

  useEffect(() => {
    void loadData();
  }, [endpoint]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(editing.id ? `${endpoint}/${editing.id}` : endpoint, {
        method: editing.id ? "PUT" : "POST",
        body: JSON.stringify(editing),
      });
      notify(`${title} berhasil disimpan.`);
      setEditing(null);
      void loadData();
    } catch (err) {
      notify("Gagal menyimpan " + title);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus item ini?")) return;
    try {
      await apiFetch(`${endpoint}/${id}`, { method: "DELETE" });
      notify("Berhasil dihapus.");
      void loadData();
    } catch (err) {
      notify("Gagal menghapus.");
    }
  };

  return (
    <div className="admin-page">
      <MasterHeader
        kicker="DATA OPERASIONAL"
        title={`Master ${title}`}
        text={`Kelola data referensi ${title.toLowerCase()} untuk digunakan pada Job dan Ledger.`}
      />
      <section className="panel table-panel slide-up">
      <div className="panel-head">
        <div>
          <h2>Daftar {title}</h2>
          <p>Kelola data master {title.toLowerCase()} untuk operasional.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ name: "", code: "", status: "Active", area_id: "" })}>
          <i className="bi bi-plus-lg" /> Tambah Data
        </button>
      </div>

      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              {hasCode && <th>Kode</th>}
              <th>Nama {title}</th>
              {hasAreaId && <th>Area</th>}
              <th>Status</th>
              <th style={{ width: "100px", textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                {hasCode && <td style={{ fontWeight: 600 }}>{it.code}</td>}
                <td style={{ fontWeight: 500 }}>{it.name}</td>
                {hasAreaId && <td>{areas.find(a => a.id === it.area_id)?.name || it.area_id || "-"}</td>}
                <td>
                  <span className={`status-badge status-${it.status.toLowerCase()}`}>
                    <span className="status-dot" /> {it.status}
                  </span>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn btn-light" style={{ padding: "4px 8px", marginRight: "4px" }} onClick={() => setEditing(it)}>
                    <i className="bi bi-pencil" />
                  </button>
                  <button className="btn btn-light danger-button" style={{ padding: "4px 8px" }} onClick={() => void remove(it.id)}>
                    <i className="bi bi-trash" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={hasAreaId ? 4 : 3} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                  Belum ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EntityModal
          title={editing.id ? `Edit ${title}` : `Tambah ${title}`}
          subtitle={`Lengkapi formulir untuk menyimpan ${title}.`}
          onClose={() => setEditing(null)}
          onSubmit={save}
        >
          <div className="master-form-grid">
            {hasCode && (
              <label className="full-field">
                Kode {title}
                <input
                  type="text"
                  value={editing.code || ""}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  required
                />
              </label>
            )}
            <label className="full-field">
              Nama {title}
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
              />
            </label>
            {hasAreaId && (
              <label className="full-field">
                Area Produksi
                <select
                  value={editing.area_id || ""}
                  onChange={(e) => setEditing({ ...editing, area_id: e.target.value })}
                  required
                >
                  <option value="">-- Pilih Area --</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="full-field">
              Status
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                required
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div className="entity-modal-actions">
            <button type="button" className="btn btn-light" onClick={() => setEditing(null)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              <i className="bi bi-floppy" /> Simpan {title}
            </button>
          </div>
        </EntityModal>
      )}
      </section>
    </div>
  );
}
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
      apiFetch<{ data: Packaging[] }>("/master_packaging"),
    ]);
    setItems(movementResponse.data);
    setSummary(movementResponse.summary);
    setPackagings(packagingResponse.data);
  }, [from, packagingId, movementType, to]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => notify(error.message)));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
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
      <section className="form-grid" style={{ marginBottom: "20px" }}>
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

export function PackagingMaster({
  authUser,
  notify,
}: {
  authUser: any;
  notify: (message: string) => void;
}) {
  const tutorial = useTutorial("packagings");
  const isSuperUser = authUser?.username?.toLowerCase() === "suganda" || authUser?.username?.toLowerCase() === "admin";
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
    min_sku: 0,
  };
  const [items, setItems] = useState<Packaging[]>([]);
  const [form, setForm] = useState<Packaging | null>(null);
  const [query, setQuery] = useState("");
  const [masterUnits, setMasterUnits] = useState<{ id: string; name: string }[]>([]);
  const load = useCallback(async () => {
    try {
      const [response, unitsRes] = await Promise.all([
        apiFetch<{ data: Packaging[] }>("/master_packaging"),
        apiFetch<{ data: { id: string; name: string }[] }>("/master_units")
      ]);
      setItems(response.data);
      setMasterUnits(unitsRes.data);
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
      await apiFetch(editing ? `/master_packaging/${form.id}` : "/master_packaging", {
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
      await apiFetch(`/master_packaging/${packaging.id}`, { method: "DELETE" });
      await load();
      notify(`${packaging.name} berhasil dihapus dari database.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menghapus packaging");
    }
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
                <th>Minimal SKU</th>
                <th>Satuan</th>
                {isSuperUser && <th>Harga Satuan</th>}
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
                      {(() => {
                        const stock = Number((item as any).initial_stock || 0);
                        const isLow = item.min_sku !== undefined && item.min_sku !== null && item.min_sku > 0 && stock <= item.min_sku;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ color: isLow ? '#ef4444' : 'var(--blue)' }}>
                              {stock.toLocaleString("id-ID")}
                            </strong>
                            {isLow && (
                              <span 
                                title={`Stok kritis! Minimal: ${item.min_sku}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#fef08a',
                                  color: '#ca8a04',
                                  borderRadius: '50%',
                                  width: '18px',
                                  height: '18px',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                !
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <strong style={{ color: "var(--muted)", fontWeight: 600 }}>
                        {item.min_sku != null ? item.min_sku.toLocaleString("id-ID") : "0"}
                      </strong>
                    </td>
                    <td>{item.unit}</td>
                    {isSuperUser && (
                      <td>
                        <strong className="money-value">
                          {formatRupiah(item.unit_price)}
                        </strong>
                        <small>per {item.unit}</small>
                      </td>
                    )}
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
                  <td colSpan={isSuperUser ? 9 : 8} style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280" }}>
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
              Minimal SKU
              <input
                type="number"
                step="0.01"
                value={form.min_sku || 0}
                onChange={(e) =>
                  setForm({ ...form, min_sku: Number(e.target.value) })
                }
                placeholder="Contoh: 300"
              />
            </label>
            <label>
              Satuan
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option value="">Pilih</option>
                {masterUnits.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
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
            {isSuperUser && (
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
            )}
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
