const fs = require('fs');
const page = fs.readFileSync('app/page.tsx', 'utf-8');
const packagingsTab = fs.readFileSync('scratch-packagings-tab.tsx', 'utf-8');

const targetStr = '  return (\n    <div className="admin-page">';
const replaced = page.replace(targetStr, packagingsTab + '\n\n' + targetStr);

fs.writeFileSync('app/page.tsx', replaced);
