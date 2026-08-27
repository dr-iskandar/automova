const fs = require('fs');
const page = fs.readFileSync('app/page.tsx', 'utf-8');

const insertAfter = (source, target, newBlock) => {
  const parts = source.split(target);
  if (parts.length > 1) {
    return parts[0] + target + '\n' + newBlock + parts[1];
  }
  return source;
};

// 1. addPackaging
const addMaterialRegex = /const addMaterial = \(\) => \{[\s\S]*?unit_price: material.unit_price,\n\s*\}\n\s*\]\n\s*\}\);\n\s*\};\n/m;
const addMaterialMatch = page.match(addMaterialRegex);

let newPage = page;
if (addMaterialMatch) {
  const addPackagingStr = addMaterialMatch[0]
    .replace(/addMaterial/g, 'addPackaging')
    .replace(/materialMaster/g, 'packagingMaster')
    .replace(/selectedMaterial/g, 'selectedPackaging')
    .replace(/material_id/g, 'packaging_id')
    .replace(/Material/g, 'Kemasan')
    .replace(/Material/g, 'Packaging') // This handles other occurrences of Material in string literal
    .replace(/materials/g, 'packagings')
    .replace(/material/g, 'packaging')
    .replace(/kemasans/g, 'packagings'); // in case it messed up materials->kemasans

  newPage = newPage.replace(addMaterialMatch[0], addMaterialMatch[0] + '\n' + addPackagingStr);
}

// 2. updateMaterial
const updateMaterialRegex = /const updateMaterial = \(index: number, patch: Partial<Material>\) => \{[\s\S]*?materials: job\.materials\.map\(\(m, i\) => \(i === index \? \{ \.\.\.m, \.\.\.patch \} : m\)\),\n\s*\}\);\n\s*\};\n/m;
const updateMaterialMatch = newPage.match(updateMaterialRegex);

if (updateMaterialMatch) {
  const updatePackagingStr = updateMaterialMatch[0]
    .replace(/updateMaterial/g, 'updatePackaging')
    .replace(/Material/g, 'Packaging')
    .replace(/materials/g, 'packagings');
    
  newPage = newPage.replace(updateMaterialMatch[0], updateMaterialMatch[0] + '\n' + updatePackagingStr);
}

// 3. addMaterialToDraft
const addMaterialToDraftRegex = /const addMaterialToDraft = \(\) => \{[\s\S]*?unit_price: material.unit_price,\n\s*\}\n\s*\]\n\s*\}\);\n\s*\};\n/m;
const addMaterialToDraftMatch = newPage.match(addMaterialToDraftRegex);

if (addMaterialToDraftMatch) {
  const addPackagingToDraftStr = addMaterialToDraftMatch[0]
    .replace(/addMaterialToDraft/g, 'addPackagingToDraft')
    .replace(/materialMaster/g, 'packagingMaster')
    .replace(/selectedMaterial/g, 'selectedPackaging')
    .replace(/material_id/g, 'packaging_id')
    .replace(/Material/g, 'Kemasan')
    .replace(/materials/g, 'packagings')
    .replace(/material/g, 'packaging');
    
  newPage = newPage.replace(addMaterialToDraftMatch[0], addMaterialToDraftMatch[0] + '\n' + addPackagingToDraftStr);
}

fs.writeFileSync('app/page.tsx', newPage);
