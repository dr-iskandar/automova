const fs = require('fs');
const content = fs.readFileSync('app/page.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('// ─── Helper: render materials tab inside modal ────────────────────────────'));
const endIdx = lines.findIndex((l, idx) => idx > startIdx && l.includes('  return ('));

const materialsTabStr = lines.slice(startIdx, endIdx).join('\n');

let packagingsTabStr = materialsTabStr
  .replace(/\/\/\s*───\s*Helper:\s*render\s*materials\s*tab\s*inside\s*modal\s*────────────────────────────/g, '// ─── Helper: render packagings tab inside modal ───────────────────────────')
  .replace(/renderMaterialsTab/g, 'renderPackagingsTab')
  .replace(/selectedMats/g, 'selectedPkgs')
  .replace(/Material\[\]/g, 'Packaging[]')
  .replace(/Material/g, 'Packaging')
  .replace(/jm-materials-tab/g, 'jm-packagings-tab')
  .replace(/jm-mat-picker/g, 'jm-pkg-picker')
  .replace(/Material Master/g, 'Master Kemasan')
  .replace(/material/g, 'kemasan')
  .replace(/Bahan Baku/g, 'Kemasan')
  .replace(/Bahan/g, 'Kemasan')
  .replace(/bahan/g, 'kemasan')
  .replace(/materialMaster/g, 'packagingMaster')
  .replace(/selectedMaterial/g, 'selectedPackaging')
  .replace(/setSelectedMaterial/g, 'setSelectedPackaging')
  .replace(/material_id/g, 'packaging_id')
  .replace(/onUpdateMat/g, 'onUpdatePkg');

fs.writeFileSync('scratch-packagings-tab.tsx', packagingsTabStr);
