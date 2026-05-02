import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportConfigsTable = pgTable("report_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sysId: text("sys_id").notNull(),
  filterQuery: text("filter_query").notNull().default(""),
  fields: text("fields").notNull().default(""),
  verifiedTitle: text("verified_title"),
  verifiedTable: text("verified_table"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReportConfigSchema = createInsertSchema(reportConfigsTable).omit({
  id: true,
  verifiedTitle: true,
  verifiedTable: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const updateReportConfigSchema = insertReportConfigSchema.partial();

export type InsertReportConfig = z.infer<typeof insertReportConfigSchema>;
export type UpdateReportConfig = z.infer<typeof updateReportConfigSchema>;
export type ReportConfig = typeof reportConfigsTable.$inferSelect;
