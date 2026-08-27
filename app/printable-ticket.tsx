import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { createPortal } from "react-dom";

export function PrintableTicket({
  batch,
}: {
  batch: {
    batch_no: string;
    job_name: string;
    operator: string;
    line: string;
    start_time: string;
    end_time?: string;
    output_qty: number;
    unit: string;
    status: string;
    product_code?: string;
    storage_location?: string;
    filling_date?: string;
    expired_date?: string;
    special_notes?: string;
  } | null;
}) {
  if (!batch || typeof document === "undefined") return null;

  const qrText = `Kode Drum: ${batch.product_code || "N/A"}\nBatch no: ${batch.batch_no}\nEstimasi Hasil: ${batch.output_qty} ${batch.unit}\nLokasi: ${batch.storage_location || "-"}\nFilling: ${batch.filling_date || "-"}\nExpired: ${batch.expired_date || "-"}\nCatatan: ${batch.special_notes || "-"}`;

  return createPortal(
    <div className="printable-ticket" aria-hidden="true">
      <header className="ticket-header">
        <div className="ticket-title-group">
          <h1>AUTOMOVA</h1>
          <h2>PRODUCTION ROUTING TICKET</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
          <QRCodeSVG
            value={qrText}
            size={48}
            level="M"
            includeMargin={false}
          />
          {batch.end_time && (
            <span style={{ fontSize: "8px", fontWeight: "bold", fontFamily: "monospace", whiteSpace: "nowrap", marginTop: "2px" }}>
              SELESAI: {new Date(batch.end_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(/\./g, ":")}
            </span>
          )}
        </div>
      </header>

      <div className="ticket-section">
        <div className="ticket-row" style={{ marginBottom: '4px' }}>
          <span className="ticket-label">Kode Drum:</span>
          <strong className="ticket-value uppercase" style={{ fontSize: '1.2rem' }}>{batch.product_code || "N/A"}</strong>
        </div>
        <div className="ticket-row">
          <span className="ticket-label">Batch ID:</span>
          <strong className="ticket-value uppercase">{batch.batch_no}</strong>
        </div>
        <div className="ticket-row">
          <span className="ticket-label">Job Name:</span>
          <strong className="ticket-value">{batch.job_name}</strong>
        </div>
        <div className="ticket-row">
          <span className="ticket-label">Operator:</span>
          <strong className="ticket-value">{batch.operator} ({batch.line})</strong>
        </div>
      </div>

      <div className="ticket-section">
        <div className="ticket-row">
          <span className="ticket-label">Quantity:</span>
          <strong className="ticket-value">{batch.output_qty} {batch.unit}</strong>
        </div>
      </div>

      <div className="ticket-section">
        <div className="ticket-row">
          <span className="ticket-label">Penyimpanan:</span>
          <strong className="ticket-value">{batch.storage_location || "-"}</strong>
        </div>
        <div className="ticket-row">
          <span className="ticket-label">Tgl Filling:</span>
          <strong className="ticket-value">{batch.filling_date || "-"}</strong>
        </div>
        <div className="ticket-row">
          <span className="ticket-label">Tgl Expired:</span>
          <strong className="ticket-value">{batch.expired_date || "-"}</strong>
        </div>
        <div className="ticket-row">
          <span className="ticket-label">Catatan:</span>
          <strong className="ticket-value">{batch.special_notes || "-"}</strong>
        </div>
      </div>

      <div className="ticket-section">
        <div className="ticket-row">
          <span className="ticket-label">Date:</span>
          <strong className="ticket-value">
            {new Date(batch.end_time || batch.start_time).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).toUpperCase()}
          </strong>
        </div>
      </div>

      <div className="ticket-section">
        <span className="ticket-label">Status:</span>
        <strong className="ticket-value uppercase">{batch.status}</strong>
      </div>

      <footer className="ticket-footer">
        <Barcode
          value={batch.batch_no}
          width={1.5}
          height={25}
          fontSize={10}
          margin={0}
          displayValue={true}
        />
      </footer>
    </div>,
    document.body
  );
}
