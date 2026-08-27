  // ─── Helper: render packagings tab inside modal ───────────────────────────
  const renderPackagingsTab = (
    selectedPkgs: Packaging[],
    onAdd: () => void,
    onRemove: (i: number) => void,
    onUpdatePkg: (i: number, p: Partial<Packaging>) => void,
  ) => (
    <div className="jm-packagings-tab">
      <div className="jm-pkg-picker-section">
        <div className="jm-pkg-picker-head">
          <span><i className="bi bi-boxes" /> Pilih dari Packaging Master</span>
          <small>Klik pada baris kemasan untuk memilih</small>
        </div>
        <div className="kemasan-option-table-wrapper">
          <table className="kemasan-option-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th>Kode</th>
                <th>Nama Packaging</th>
                <th>Default Qty</th>
                <th>Satuan</th>
                <th>Harga Satuan</th>
                <th style={{ textAlign: "right", paddingRight: "1.5rem" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {kemasanMaster.map((mat) => {
                const used = selectedPkgs.some((m) => m.kemasan_id === mat.id);
                const isSel = selectedPackaging === mat.id;