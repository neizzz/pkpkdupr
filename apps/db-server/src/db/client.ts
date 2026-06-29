import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";

let _client: Client | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

const resolveDbPath = () => process.env.DB_FILE_PATH || "file:./db.sqlite";

export const getDbClient = () => {
  if (!_client) {
    _client = createClient({ url: resolveDbPath() });
  }
  return _client;
};

export const getDb = () => {
  if (!_db) {
    _db = drizzle(getDbClient());
  }
  return _db;
};
