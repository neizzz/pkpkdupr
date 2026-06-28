import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

let _db: any;

export const getDb = (path: string = "file:./db.sqlite") => {
  if (!_db) {
    const client = createClient({ url: path });
    _db = drizzle(client);
  }
  return _db;
};
