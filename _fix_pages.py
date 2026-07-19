import os

BASE = r"C:\Users\Solomon\Desktop\Maneger_main\src\pages"

# generic class replacements applied to every page
GENERIC = [
    ("text-slate-900", "text-text-primary"),
    ("text-slate-500", "text-text-muted"),
    ("text-slate-400", "text-text-muted"),
    ("text-slate-700", "text-text-secondary"),
    ("text-slate-600", "text-text-secondary"),
    ("bg-white", "bg-surface"),
    ("border-slate-200", "border-border"),
    ("bg-slate-50", "bg-surface-alt"),
    ("bg-slate-100", "bg-surface-alt"),
    ("bg-slate-200", "bg-border"),
    ("border-slate-100", "border-border"),
    ("text-emerald-600", "text-success"),
    ("text-emerald-700", "text-success"),
    ("text-red-600", "text-danger"),
    ("text-red-500", "text-danger"),
    ("text-amber-700", "text-warning"),
    ("text-amber-600", "text-warning"),
    ("text-blue-600", "text-info"),
    ("text-blue-700", "text-info"),
    ("text-rose-600", "text-danger"),
    ("bg-emerald-50", "bg-success-bg"),
    ("bg-emerald-100", "bg-success-bg"),
    ("bg-amber-50", "bg-warning-bg"),
    ("bg-amber-100", "bg-warning-bg"),
    ("bg-red-50", "bg-danger-bg"),
    ("bg-blue-50", "bg-info-bg"),
    ("bg-rose-50", "bg-danger-bg"),
    ("bg-violet-50", "bg-accent/15"),
    ("text-violet-700", "text-accent-muted"),
    ("bg-zinc-100", "bg-surface-alt"),
    ("text-zinc-500", "text-text-muted"),
    ("bg-zinc-400", "text-text-muted"),
    ("bg-plum-50", "bg-accent/10"),
    ("text-plum-700", "text-accent"),
    ("bg-gold-50", "bg-accent/15"),
    ("text-gold-700", "text-accent-muted"),
    ("text-gold-600", "text-accent-muted"),
    ("border-slate-300", "border-border"),
    ("bg-slate-300", "bg-border"),
    ("text-slate-800", "text-text-primary"),
]

FILES = [
    ("Wallets/Wallets.tsx", []),
    ("Sales/Sales.tsx", []),
    ("Inventory/BatchDetail.tsx", [
        ("bg-gradient-to-br from-plum-600 to-plum-800 text-white border-0",
         "bg-primary text-white border-0"),
        ("text-plum-100", "text-text-secondary"),
        ("text-plum-200", "text-text-muted"),
        ("bg-plum-900/40", "bg-border"),
        ("bg-emerald-400", "bg-success"),
        ("bg-gold-400", "bg-accent"),
        ("bg-emerald-50 border-emerald-200", "bg-success-bg border-success/30"),
        ("bg-emerald-100 text-emerald-700", "bg-success-bg text-success"),
        ("tab === t.key ? 'bg-plum-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'",
         "tab === t.key ? 'bg-primary text-white' : 'bg-surface text-text-secondary border border-border hover:bg-surface-alt'"),
    ]),
    ("Inventory/InventoryList.tsx", []),
    ("Expenses/Expenses.tsx", []),
    ("Customers/Customers.tsx", []),
    ("Suppliers/Suppliers.tsx", []),
    ("Notifications/Notifications.tsx", []),
]

for rel, extra in FILES:
    p = os.path.join(BASE, rel)
    with open(p, "r", encoding="utf-8") as f:
        c = f.read()
    for a, b in GENERIC:
        c = c.replace(a, b)
    for a, b in extra:
        if a in c:
            c = c.replace(a, b)
        else:
            print(f"  WARN not found in {rel}: {a[:50]}")
    with open(p, "w", encoding="utf-8") as f:
        f.write(c)
    print("updated", rel)
print("ALL PAGES BULK DONE")
