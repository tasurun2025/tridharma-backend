CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT,
  prodi TEXT,
  nidn TEXT
);

CREATE TABLE IF NOT EXISTS dosen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  prodi TEXT,
  nidn TEXT
);

CREATE TABLE IF NOT EXISTS kegiatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  prodi TEXT,
  user_name TEXT,
  user_id INTEGER,
  data_json TEXT,
  file_path TEXT,
  created_at TEXT
);
