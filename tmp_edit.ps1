$content = Get-Content 'src\pages\Inventory\InventoryList.tsx'
$content = $content -replace "const batches = snapshot\?\.batches;", "const batches = snapshot?.batches;`n  const products = snapshot?.products;"
Set-Content -Path 'src\pages\Inventory\InventoryList.tsx' -Value $content
