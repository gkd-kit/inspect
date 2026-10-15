-- Matches the existing production D1 schema. Request validation guarantees
-- that newly written values are positive, non-null safe integers.
CREATE TABLE IF NOT EXISTS snapshot (
  id INTEGER PRIMARY KEY,
  import_id INTEGER
);

