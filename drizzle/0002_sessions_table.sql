-- Migration: Add sessions table for grammY conversation persistence
CREATE TABLE IF NOT EXISTS sessions (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
