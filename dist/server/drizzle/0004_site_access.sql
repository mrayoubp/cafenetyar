CREATE TABLE site_logins (
 id TEXT PRIMARY KEY,
 username TEXT NOT NULL COLLATE NOCASE UNIQUE,
 phone TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 cafe TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','failed')),
 legacy_user_id TEXT UNIQUE,
 request_id TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL REFERENCES accounts(id),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE access_attempts (id TEXT PRIMARY KEY, subject TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX access_attempts_subject ON access_attempts(subject,created_at);
