CREATE TABLE catalog_items (
  id TEXT PRIMARY KEY, cafe_id TEXT NOT NULL, title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('product','service')),
  unit TEXT NOT NULL, sku TEXT, price_toman INTEGER NOT NULL CHECK(price_toman BETWEEN 0 AND 1000000000),
  cost_toman INTEGER NOT NULL DEFAULT 0 CHECK(cost_toman BETWEEN 0 AND 1000000000),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity BETWEEN 0 AND 1000000000),
  low_stock INTEGER NOT NULL DEFAULT 5 CHECK(low_stock BETWEEN 0 AND 1000000000),
  archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
  request_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(cafe_id,sku), UNIQUE(cafe_id,request_id)
);
--> statement-breakpoint
CREATE INDEX catalog_cafe ON catalog_items(cafe_id,archived);
--> statement-breakpoint
CREATE TABLE finance_entries (
  id TEXT PRIMARY KEY, cafe_id TEXT NOT NULL, created_by TEXT NOT NULL,
  title TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('income','expense')),
  category TEXT NOT NULL, method TEXT NOT NULL,
  amount_toman INTEGER NOT NULL CHECK(amount_toman BETWEEN 1 AND 1000000000),
  discount_toman INTEGER NOT NULL DEFAULT 0 CHECK(discount_toman>=0),
  note TEXT NOT NULL DEFAULT '', occurred_at INTEGER NOT NULL, operator_name TEXT NOT NULL,
  created_at INTEGER NOT NULL, voided_at INTEGER, voided_by TEXT,
  request_id TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(cafe_id,request_id)
);
--> statement-breakpoint
CREATE INDEX finance_cafe_date ON finance_entries(cafe_id,occurred_at);
--> statement-breakpoint
CREATE TABLE finance_lines (
  id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES finance_entries(id),
  item_id TEXT REFERENCES catalog_items(id), title TEXT NOT NULL, unit TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity>0), unit_price INTEGER NOT NULL CHECK(unit_price>=0),
  line_total INTEGER NOT NULL CHECK(line_total>=0)
);
--> statement-breakpoint
CREATE INDEX finance_lines_entry ON finance_lines(entry_id);
--> statement-breakpoint
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY, cafe_id TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES catalog_items(id),
  delta INTEGER NOT NULL CHECK(delta<>0), kind TEXT NOT NULL,
  reason TEXT NOT NULL, entry_id TEXT REFERENCES finance_entries(id),
  actor_id TEXT NOT NULL, created_at INTEGER NOT NULL, request_id TEXT NOT NULL,
  UNIQUE(cafe_id,request_id)
);
--> statement-breakpoint
CREATE INDEX stock_cafe_date ON stock_movements(cafe_id,created_at);
--> statement-breakpoint
CREATE TABLE finance_voids(entry_id TEXT PRIMARY KEY REFERENCES finance_entries(id), cafe_id TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE inventory_audit(id TEXT PRIMARY KEY, cafe_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, created_at INTEGER NOT NULL);
