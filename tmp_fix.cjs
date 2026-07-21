const fs = require('fs'); 
const f = 'src/pages/Inventory/InventoryList.tsx'; 
const lines = fs.readFileSync(f, 'utf8').split('\n'); 
const target = 'OLD_LINE_MARKER'; 
const fs = require('fs');  
const f = 'src/pages/Inventory/InventoryList.tsx';  
const lines = fs.readFileSync(f, 'utf8').split('\n');  
lines[133] = 'REPLACEMENT_LINE';  
fs.writeFileSync(f, lines.join('\n')); 
