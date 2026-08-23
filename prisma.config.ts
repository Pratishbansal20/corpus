import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// `quiet: true` suppresses dotenv's own console output, which as of dotenv
// 17 includes a randomly-picked self-promotional "tip" line on every load
// (e.g. pointing at dotenvx.com / vestauth.com). Confirmed by reading
// node_modules/dotenv/lib/main.js: it's a static array of strings passed to
// console.log, no network call involved, so this is unwanted log noise in
// build/CI output, not a security issue. Suppressed at the source instead
// of just ignoring it.
loadEnv({ quiet: true });

// Prisma 7 reads connection config from here (not from the schema's datasource).
// The CLI uses this URL for `migrate`, `db push`, and introspection; the runtime
// client connects via the pg driver adapter in src/lib/db/prisma.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
});
