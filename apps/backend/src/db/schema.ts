import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { FieldChange } from "@repo/shared";

export const userRole = pgEnum("user_role", [
  "ComplianceManager",
  "Auditor",
  "Reporter",
]);
export const riskLevel = pgEnum("risk_level", [
  "Low",
  "Medium",
  "High",
  "Critical",
]);
export const caseStatus = pgEnum("case_status", [
  "Reported",
  "Triaged",
  "Closed",
]);
export const triageDecision = pgEnum("triage_decision", [
  "Accepted",
  "Escalated",
  "Dismissed",
]);
export const correctiveActionStatus = pgEnum("corrective_action_status", [
  "Open",
  "Closed",
]);
export const likelihoodImpact = pgEnum("likelihood_impact", [
  "Low",
  "Medium",
  "High",
]);
export const auditAction = pgEnum("audit_action", [
  "Reported",
  "Triaged",
  "ReviewNoteUpdated",
  "InvestigationOutcomeRecorded",
  "CorrectiveActionUpdated",
  "RiskInputsUpdated",
  "Closed",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("Reporter"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category"),

  likelihood: likelihoodImpact("likelihood").notNull(),
  impact: likelihoodImpact("impact").notNull(),
  riskLevel: riskLevel("risk_level").notNull(),

  status: caseStatus("status").notNull().default("Reported"),
  reporterId: uuid("reporter_id").notNull(),

  triageDecision: triageDecision("triage_decision"),
  triagedAt: timestamp("triaged_at", { withTimezone: true }),
  triagedBy: uuid("triaged_by"),
  investigationRequired: boolean("investigation_required")
    .notNull()
    .default(false),
  correctiveActionRequired: boolean("corrective_action_required")
    .notNull()
    .default(false),

  reviewNote: text("review_note"),
  investigationOutcome: text("investigation_outcome"),
  correctiveActionStatus: correctiveActionStatus("corrective_action_status"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedBy: uuid("closed_by"),
});

/**
 * Append-only. `seq` gives a total order for entries written within the same
 * transaction (a triage emits two), so "newest first" is deterministic rather
 * than dependent on timestamp ties.
 */
export const auditEntries = pgTable("audit_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  seq: integer("seq").generatedAlwaysAsIdentity(),
  caseId: uuid("case_id").notNull(),
  action: auditAction("action").notNull(),
  actorId: uuid("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  changes: jsonb("changes").$type<FieldChange[]>().notNull().default([]),
});

export type UserRow = typeof users.$inferSelect;
export type CaseRow = typeof cases.$inferSelect;
export type AuditRow = typeof auditEntries.$inferSelect;
