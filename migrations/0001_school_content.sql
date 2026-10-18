CREATE TABLE IF NOT EXISTS school_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO school_settings (key, value) VALUES
  ('school_name', 'Little''s Valley Preparatory School'),
  ('phone', '011 2833 2578'),
  ('address', 'Plot no, 31-A, Chand Nagar Main Rd, DDA Colony, Chand Nagar, Vishnu Garden, Delhi, 110018'),
  ('status', 'Temporarily closed'),
  ('about', 'Little''s Valley Preparatory School is listed as a preparatory school in the Chand Nagar neighbourhood of West Delhi.'),
  ('visit_note', 'Call to confirm the school''s current opening status and visiting hours.'),
  ('closure_notice', 'The listing provided for this school currently says “Temporarily closed.” Please call before visiting.');

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  image_key TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS teachers_public_order ON teachers (published, updated_at DESC);

CREATE TABLE IF NOT EXISTS school_notices (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('notice', 'event')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  publish_on TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS school_notices_public_order
  ON school_notices (published, publish_on DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS school_highlights (
  id TEXT PRIMARY KEY,
  school_year TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS school_highlights_public_order
  ON school_highlights (published, school_year DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0
);
