const sqliteTimeColumns = new Set([`ctime`, `mtime`]);
const sqliteTimeIdTables = new Set([`snapshot`, `subs_config`]);
const sqliteSubscriptionIdTables = new Set([`app_visit_log`, `subs_config`]);

export const isSqliteAppIdColumn = (table: string, column: string) => {
  const normalizedColumn = column.toLowerCase();
  return (
    normalizedColumn == `app_id` ||
    (table.toLowerCase() == `app_visit_log` && normalizedColumn == `id`)
  );
};

export const isSqliteSubscriptionIdColumn = (table: string, column: string) => {
  return (
    column.toLowerCase() == `subs_id` &&
    sqliteSubscriptionIdTables.has(table.toLowerCase())
  );
};

export const getSqliteTimeValue = (
  table: string,
  column: string,
  value: unknown,
) => {
  const normalizedColumn = column.toLowerCase();
  const isTimeColumn =
    sqliteTimeColumns.has(normalizedColumn) ||
    (normalizedColumn == `id` && sqliteTimeIdTables.has(table.toLowerCase()));
  if (!isTimeColumn) return;
  if (typeof value != `number` && typeof value != `string`) return;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return;
  const milliseconds =
    Math.abs(timestamp) < 100_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) return;
  return date;
};

const pad = (value: number, length = 2) => {
  return value.toString().padStart(length, `0`);
};

export const formatLocalDateTime = (date: Date) => {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:` +
    `${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  );
};
