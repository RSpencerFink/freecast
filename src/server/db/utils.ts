import { pgTableCreator, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
export const createTable = pgTableCreator((name) => `freecast_${name}`);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
};
