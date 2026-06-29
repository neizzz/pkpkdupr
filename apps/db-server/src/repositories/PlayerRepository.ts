import { players } from "../db/schema";
import { eq } from "drizzle-orm";

export class PlayerRepository {
  constructor(private db: any) {}

  async findById(id: string) {
    return await this.db.select().from(players).where(eq(players.id, id)).get();
  }

  async create(data: any) {
    const now = new Date();
    const newUser = { ...data, createdAt: now, updatedAt: now };
    await this.db.insert(players).values(newUser);
    return this.findById(newUser.id);
  }

  async updateRating(id: string, newRating: number) {
    await this.db.update(players).set({ duprRating: newRating, updatedAt: new Date() }).where(eq(players.id, id));
  }
}
