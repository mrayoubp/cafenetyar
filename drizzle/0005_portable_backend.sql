CREATE TABLE account_credentials (
 user_id TEXT PRIMARY KEY REFERENCES accounts(id), username TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL, iterations INTEGER NOT NULL,
 recovery_hash TEXT, updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE cafes (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, province TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
 address TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE cafe_memberships (
 user_id TEXT PRIMARY KEY REFERENCES accounts(id), cafe_id TEXT NOT NULL REFERENCES cafes(id),
 kind TEXT NOT NULL CHECK(kind IN ('owner','employee')), title TEXT NOT NULL DEFAULT '',
 permissions TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX memberships_cafe ON cafe_memberships(cafe_id);
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN cafe_id TEXT;
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'other';
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';
--> statement-breakpoint
ALTER TABLE tickets ADD COLUMN number TEXT;
--> statement-breakpoint
CREATE TABLE ticket_messages (id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES tickets(id),user_id TEXT NOT NULL,author_name TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE rate_services (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,unit TEXT NOT NULL DEFAULT 'مورد',price_toman INTEGER,meta TEXT NOT NULL DEFAULT '{}',active INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE rate_overrides (cafe_id TEXT NOT NULL,service_id TEXT NOT NULL REFERENCES rate_services(id),value TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(cafe_id,service_id));
--> statement-breakpoint
CREATE TABLE rate_history (id TEXT PRIMARY KEY,cafe_id TEXT NOT NULL,service_id TEXT NOT NULL,actor_id TEXT NOT NULL,value TEXT NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE rate_suggestions (id TEXT PRIMARY KEY,cafe_id TEXT NOT NULL,user_id TEXT NOT NULL,service_id TEXT NOT NULL,value TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE agent_conversations (id TEXT PRIMARY KEY,cafe_id TEXT NOT NULL,user_id TEXT NOT NULL,title TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE agent_messages (id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES agent_conversations(id),role TEXT NOT NULL,content TEXT NOT NULL,sources TEXT NOT NULL DEFAULT '[]',calculation TEXT,model TEXT,feedback TEXT,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE import_records (source_id TEXT PRIMARY KEY,cafe_id TEXT NOT NULL,created_by TEXT NOT NULL,created_at INTEGER NOT NULL);
