import { matches } from "../db/schema";
import { eq } from "drizzle-orm";

export class MatchRepository {
  constructor(private db: any) {}

  async findById(id: string) {
    return await this.db.select().from(matches).where(eq(matches.id, id)).get();
  }

  async create(data: any) {
    const now = new Date();
    const newUser = { ...data, createdAt: now, updatedAt: now };
    await this.db.insert(matches).values(newUser);
    return this.findById(newUser.id);
  }
}
