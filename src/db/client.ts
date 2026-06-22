import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://e2e_testora:e2e_testora@localhost:55433/e2e-testing-db";

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
