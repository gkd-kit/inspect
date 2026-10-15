CREATE TABLE IF NOT EXISTS build_asset (
  build_key TEXT PRIMARY KEY NOT NULL
    CHECK (
      length(CAST(build_key AS BLOB)) BETWEEN 1 AND 256
      AND build_key = trim(build_key)
    ),
  asset_id INTEGER NOT NULL
    CHECK (asset_id BETWEEN 1 AND 2147483647)
) WITHOUT ROWID;
