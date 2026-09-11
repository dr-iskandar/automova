import React from 'react';
import { formatMachineName } from './printable-ticket';

export function PrintableLabel({
  batchNo,
  productCode,
  productName,
  packagingCode,
  expiredDate,
  fillingDate,
  storageLocation,
  output,
  unit,
  specialNotes,
  machine,
}: {
  batchNo: string;
  productCode: string;
  productName: string;
  packagingCode: string;
  expiredDate: string;
  fillingDate: string;
  storageLocation: string;
  output: string | number;
  unit: string;
  specialNotes: string;
  machine?: string;
}) {
  const formattedMachine = formatMachineName(machine);
  return (
    <div className="print-label-container" style={{ display: 'none' }}>
      <div className="print-label-content" style={{ padding: '20px', border: '2px solid #000', width: '10cm', height: '10cm', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>AUTOMOVA</h2>
          <div style={{ fontSize: '12px' }}>PRODUCTION LABEL</div>
        </div>
        
        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold', width: '40%' }}>Product Code</td><td style={{ padding: '4px 0' }}>: {productCode}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Product Name</td><td style={{ padding: '4px 0' }}>: {productName}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Batch No</td><td style={{ padding: '4px 0', fontSize: '18px', fontWeight: 'bold' }}>: {batchNo}</td></tr>
            {formattedMachine && <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Mesin</td><td style={{ padding: '4px 0' }}>: {formattedMachine}</td></tr>}
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Packaging</td><td style={{ padding: '4px 0' }}>: {packagingCode}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Output</td><td style={{ padding: '4px 0' }}>: {output} {unit}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Filling Date</td><td style={{ padding: '4px 0' }}>: {fillingDate}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Expired Date</td><td style={{ padding: '4px 0' }}>: {expiredDate}</td></tr>
            <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>Location</td><td style={{ padding: '4px 0' }}>: {storageLocation}</td></tr>
          </tbody>
        </table>
        
        {specialNotes && (
          <div style={{ marginTop: '10px', borderTop: '1px dashed #000', paddingTop: '10px', fontSize: '12px' }}>
            <strong>Notes:</strong> {specialNotes}
          </div>
        )}
      </div>
    </div>
  );
}
