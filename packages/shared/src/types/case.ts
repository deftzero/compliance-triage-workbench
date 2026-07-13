import type { z } from "zod";
import type {
  auditActionSchema,
  auditEntrySchema,
  caseFilterSchema,
  caseSchema,
  caseStatusSchema,
  closureStatusSchema,
  correctiveActionStatusSchema,
  createCaseSchema,
  fieldChangeSchema,
  likelihoodImpactSchema,
  riskLevelSchema,
  triageDecisionSchema,
  triageInputSchema,
  updateCaseSchema,
} from "../validators/case";

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type CaseStatus = z.infer<typeof caseStatusSchema>;
export type TriageDecision = z.infer<typeof triageDecisionSchema>;
export type CorrectiveActionStatus = z.infer<
  typeof correctiveActionStatusSchema
>;
export type LikelihoodImpact = z.infer<typeof likelihoodImpactSchema>;
export type AuditAction = z.infer<typeof auditActionSchema>;

export type ComplianceCase = z.infer<typeof caseSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type TriageInput = z.infer<typeof triageInputSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type CaseFilter = z.infer<typeof caseFilterSchema>;

export type FieldChange = z.infer<typeof fieldChangeSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type ClosureStatus = z.infer<typeof closureStatusSchema>;
