const fs = require('fs');
const content = fs.readFileSync('app/master-data.tsx', 'utf-8');
const lines = content.split('\n');

const extract = (startPrefix, endPrefix) => {
  const startIdx = lines.findIndex(l => l.includes(startPrefix));
  const endIdx = lines.findIndex((l, idx) => idx > startIdx && l.includes(endPrefix));
  return lines.slice(startIdx, endIdx).join('\n');
};

let master = extract('export function MaterialMaster', 'export function UserMaster');
let ledger = extract('export function MaterialLedger', 'export function ReportManager');

// Types (which are before MaterialLedger)
const typesStart = lines.findIndex(l => l.includes('type MaterialMovement = {'));
const typesEnd = lines.findIndex((l, idx) => idx > typesStart && l.includes('export function MaterialLedger'));
let types = lines.slice(typesStart, typesEnd).join('\n');

const transform = (text) => {
  return text
    .replace(/Material/g, 'Packaging')
    .replace(/material/g, 'packaging')
    .replace(/Bahan Baku/g, 'Kemasan')
    .replace(/bahan baku/g, 'kemasan')
    .replace(/Bahan/g, 'Kemasan')
    .replace(/bahan/g, 'kemasan')
    .replace(/materials/g, 'master_packaging') // for apiFetch('/materials' -> '/master_packaging')
    // except apiFetch('/master_packaging-movements') which should be '/packaging-movements'
    .replace(/\/master_packaging-movements/g, '/packaging-movements');
};

let transformed = transform(types) + '\n' + transform(ledger) + '\n' + transform(master);

// Remove priceHistory entirely from the transformed string
transformed = transformed.replace(/const \[priceHistory, setPriceHistory\] = useState[^;]+;/g, '');
transformed = transformed.replace(/const openPriceHistory = async[^}]+};/g, '');
// Remove the <PriceHistoryModal ... /> block
transformed = transformed.replace(/\{priceHistory && \(\s*<PriceHistoryModal[\s\S]*?\/>\s*\)\}/g, '');
// Remove the buttons to open price history
transformed = transformed.replace(/<button[^>]*onClick=\{\(e\) => \{ e\.stopPropagation\(\); openPriceHistory\(item\); \}\}[^>]*>[\s\S]*?<\/button>/g, '');

fs.writeFileSync('scratch-packaging.tsx', transformed);
