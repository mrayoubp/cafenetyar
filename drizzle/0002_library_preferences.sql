CREATE TABLE library_preferences (identity_id TEXT PRIMARY KEY, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE library_requests (id TEXT PRIMARY KEY, identity_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX library_requests_identity ON library_requests(identity_id,created_at);
