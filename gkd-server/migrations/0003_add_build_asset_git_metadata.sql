ALTER TABLE build_asset ADD COLUMN commit_id TEXT
  CHECK (
    commit_id IS NULL
    OR (
      length(CAST(commit_id AS BLOB)) BETWEEN 1 AND 64
      AND commit_id = trim(commit_id)
    )
  );

ALTER TABLE build_asset ADD COLUMN tag TEXT
  CHECK (
    tag IS NULL
    OR (
      length(CAST(tag AS BLOB)) BETWEEN 1 AND 256
      AND tag = trim(tag)
    )
  );
