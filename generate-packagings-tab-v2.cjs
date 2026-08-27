const fs = require('fs');
const content = fs.readFileSync('app/page.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('// ─── Helper: render materials tab inside modal ────────────────────────────'));
const endIdx = lines.findIndex((l, idx) => idx > startIdx && l === '  );'); // the end of renderMaterialsTab

const materialsTabStr = lines.slice(startIdx, endIdx + 1).join('\n');

let packagingsTabStr = materialsTabStr
  .replace(/\/\/\s*───\s*Helper:\s*render\s*materials\s*tab\s*inside\s*modal\s*────────────────────────────/g, '// ─── Helper: render packagings tab inside modal ───────────────────────────')
  .replace(/renderMaterialsTab/g, 'renderPackagingsTab')
  .replace(/selectedMats/g, 'selectedPkgs')
  .replace(/Material\[\]/g, 'Packaging[]')
  .replace(/Material/g, 'Packaging')
  .replace(/jm-materials-tab/g, 'jm-packagings-tab')
  .replace(/jm-mat-picker/g, 'jm-pkg-picker')
  .replace(/Material Master/g, 'Master Kemasan')
  .replace(/material/g, 'packaging')
  .replace(/Bahan Baku/g, 'Kemasan')
  .replace(/Bahan/g, 'Kemasan')
  .replace(/bahan/g, 'kemasan')
  .replace(/packagingMaster/g, 'packagingMaster') // in case
  .replace(/selectedPackaging/g, 'selectedPackaging') // in case
  .replace(/packaging_id/g, 'packaging_id')
  .replace(/onUpdateMat/g, 'onUpdatePkg');

// Remove the broken inserted one
const cleanPageStr = content.replace(/\/\/ ─── Helper: render packagings tab inside modal ───────────────────────────[\s\S]*?(?=  return \(\n    <div className="admin-page">)/, '');

// Insert the complete one
const targetStr = '  return (\n    <div className="admin-page">';
const replaced = cleanPageStr.replace(targetStr, packagingsTabStr + '\n\n' + targetStr);

fs.writeFileSync('app/page.tsx', replaced);
