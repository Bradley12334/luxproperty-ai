import { type Brief, type InsertBrief, briefs } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface IStorage {
  getBrief(id: number): Promise<Brief | undefined>;
  getAllBriefs(): Promise<Brief[]>;
  createBrief(brief: InsertBrief): Promise<Brief>;
}

export class DatabaseStorage implements IStorage {
  async getBrief(id: number): Promise<Brief | undefined> {
    return db.select().from(briefs).where(eq(briefs.id, id)).get();
  }

  async getAllBriefs(): Promise<Brief[]> {
    return db.select().from(briefs).all();
  }

  async createBrief(brief: InsertBrief): Promise<Brief> {
    return db.insert(briefs).values(brief).returning().get();
  }
}

export const storage = new DatabaseStorage();
