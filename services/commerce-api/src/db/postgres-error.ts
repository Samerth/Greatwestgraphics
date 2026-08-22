const SQLSTATE = /^[0-9A-Z]{5}$/;

/**
 * Walks `error` / `error.cause` for a Postgres SQLSTATE.
 *
 * postgres.js raises `PostgresError` with `code: "42703"`. Drizzle sometimes
 * wraps that, so the code can sit one or two causes down.
 */
export function postgresSqlState(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string" && SQLSTATE.test(record.code)) {
      return record.code;
    }
    current = record.cause;
  }
  return undefined;
}

/**
 * Human message for undefined_column (42703). The staff inbox previously
 * surfaced Fastify's generic 500, which hid that staging was one ALTER
 * TABLE behind the ORM.
 */
export function schemaDriftMessage(error: unknown): string | undefined {
  if (postgresSqlState(error) !== "42703") return undefined;
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const message = (current as { message?: unknown }).message;
    if (typeof message === "string") {
      const match = message.match(/column ["'`]?([a-zA-Z0-9_]+)["'`]? does not exist/i);
      if (match) {
        return `The database is missing column ${match[1]}. Apply pending Drizzle migrations.`;
      }
    }
    current = (current as { cause?: unknown }).cause;
  }
  return "The database schema is behind the API. Apply pending Drizzle migrations.";
}

/**
 * RDS managed passwords rotate. The API secret snapshots DATABASE_URL once,
 * so ECS keeps the old password and Postgres answers 28P01.
 */
export function databaseAuthMessage(error: unknown): string | undefined {
  if (postgresSqlState(error) !== "28P01") return undefined;
  return "The API could not authenticate to the database. Refresh the API secret DATABASE_URL from the RDS master-user secret.";
}
