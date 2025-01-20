import { varchar, json } from "drizzle-orm/pg-core";
import { createTable, timestamps } from "./utils";

export const openAITranscripts = createTable("open_ai_transcript", {
  guid: varchar("guid").primaryKey(),
  transcript: json("transcript"),
  ...timestamps,
});
