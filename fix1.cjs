const fs = require('fs');  
const f = 'src/pages/Inventory/InventoryList.tsx';  
const lines = fs.readFileSync(f, 'utf8').split('\n');  
lines[133] = lines[133].trimStart();  
fs.writeFileSync(f, lines.join('\n')); 
