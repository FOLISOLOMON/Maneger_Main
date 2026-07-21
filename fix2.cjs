const fs = require('fs');  
const f = 'src/pages/Inventory/InventoryList.tsx';  
const lines = fs.readFileSync(f, 'utf8').split('\n');  
lines[133] = '                     '.concat(lines[133]);  
fs.writeFileSync(f, lines.join('\n')); 
