CREATE TABLE accounts (id TEXT PRIMARY KEY, identity_id TEXT UNIQUE, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','admin','customer')), permissions TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, cafe TEXT NOT NULL DEFAULT '', subscription_end TEXT, last_login INTEGER, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX unique_owner ON accounts(role) WHERE role='owner';
--> statement-breakpoint
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL, mfa_at INTEGER, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE mfa (user_id TEXT PRIMARY KEY REFERENCES accounts(id), secret TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, last_step INTEGER NOT NULL DEFAULT -1);
--> statement-breakpoint
CREATE TABLE audit (id TEXT PRIMARY KEY, actor_id TEXT, actor_name TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT, detail TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX audit_time ON audit(created_at);
--> statement-breakpoint
CREATE TABLE content (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE transactions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id), title TEXT NOT NULL, amount INTEGER NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('income','expense')), created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE tickets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id), subject TEXT NOT NULL, body TEXT NOT NULL, reply TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', updated_at INTEGER NOT NULL);
