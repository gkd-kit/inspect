import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { materializeWalSnapshot } from './wal';

export type SqliteTableMeta = {
  name: string;
  count: number | null;
  sql: string;
};

export type SqliteOpenResult = {
  tables: SqliteTableMeta[];
};

export type SqliteCellValue =
  | number
  | string
  | null
  | { type: `blob`; byteLength: number };

export type SqlitePageResult = {
  columns: string[];
  rows: SqliteCellValue[][];
};

export type SqliteWorkerRequest =
  | {
      id: number;
      type: `open`;
      database: Uint8Array;
      wal?: Uint8Array;
    }
  | {
      id: number;
      type: `page`;
      table: string;
      page: number;
      pageSize: number;
    }
  | { id: number; type: `close` };

export type SqliteWorkerResponse =
  | { id: number; ok: true; result: SqliteOpenResult | SqlitePageResult | null }
  | { id: number; ok: false; error: string };

let database: Database | undefined;
let tableNames = new Set<string>();
let sqlPromise: Promise<SqlJsStatic> | undefined;

const getSql = () => {
  sqlPromise ||= import('sql.js').then(({ default: initSqlJs }) =>
    initSqlJs({ locateFile: () => wasmUrl }),
  );
  return sqlPromise;
};

const quoteIdentifier = (value: string) => {
  return `"${value.replaceAll(`"`, `""`)}"`;
};

const execOne = (sql: string, params?: SqlValue[]) => {
  return database?.exec(sql, params)[0];
};

const openDatabase = async (
  mainFile: Uint8Array,
  walFile?: Uint8Array,
): Promise<SqliteOpenResult> => {
  database?.close();
  const snapshot = materializeWalSnapshot(mainFile, walFile);
  const SQL = await getSql();
  database = new SQL.Database(snapshot);
  database.run(`PRAGMA query_only = ON`);
  const result = execOne(
    `SELECT name, COALESCE(sql, '') FROM sqlite_master ` +
      `WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  const tables = (result?.values || []).map(([name, createSql]) => {
    const tableName = String(name);
    let count: number | null = null;
    try {
      const countResult = execOne(
        `SELECT COUNT(*) FROM ${quoteIdentifier(tableName)}`,
      );
      count = Number(countResult?.values[0]?.[0] || 0);
    } catch {}
    return {
      name: tableName,
      count,
      sql: String(createSql || ``),
    };
  });
  tableNames = new Set(tables.map((table) => table.name));
  return { tables };
};

const getTablePage = (
  table: string,
  page: number,
  pageSize: number,
): SqlitePageResult => {
  if (!database || !tableNames.has(table)) throw new Error(`数据表不存在`);
  page = Math.max(1, Math.floor(page));
  pageSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
  const result = execOne(
    `SELECT * FROM ${quoteIdentifier(table)} LIMIT ? OFFSET ?`,
    [pageSize, (page - 1) * pageSize],
  );
  return {
    columns: result?.columns || [],
    rows: (result?.values || []).map((row) =>
      row.map((value): SqliteCellValue => {
        if (value instanceof Uint8Array) {
          return { type: `blob`, byteLength: value.byteLength };
        }
        return value;
      }),
    ),
  };
};

self.onmessage = async (event: MessageEvent<SqliteWorkerRequest>) => {
  const request = event.data;
  try {
    let result: SqliteOpenResult | SqlitePageResult | null;
    if (request.type == `open`) {
      result = await openDatabase(request.database, request.wal);
    } else if (request.type == `page`) {
      result = getTablePage(request.table, request.page, request.pageSize);
    } else {
      database?.close();
      database = undefined;
      tableNames.clear();
      result = null;
    }
    self.postMessage({
      id: request.id,
      ok: true,
      result,
    } satisfies SqliteWorkerResponse);
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies SqliteWorkerResponse);
  }
};
