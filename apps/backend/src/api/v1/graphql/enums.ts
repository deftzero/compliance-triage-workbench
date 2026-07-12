import {
  auditActionSchema,
  caseStatusSchema,
  correctiveActionStatusSchema,
  likelihoodImpactSchema,
  riskLevelSchema,
  roleSchema,
  triageDecisionSchema,
} from "@repo/shared";
import { builder } from "./builder.js";

// Enum members come straight off the Zod schemas, so the GraphQL schema can
// never drift from the domain's idea of what the valid values are.
export const RoleEnum = builder.enumType("Role", {
  values: roleSchema.options,
});

export const RiskLevelEnum = builder.enumType("RiskLevel", {
  values: riskLevelSchema.options,
});

export const CaseStatusEnum = builder.enumType("CaseStatus", {
  values: caseStatusSchema.options,
});

export const TriageDecisionEnum = builder.enumType("TriageDecision", {
  values: triageDecisionSchema.options,
});

export const CorrectiveActionStatusEnum = builder.enumType(
  "CorrectiveActionStatus",
  { values: correctiveActionStatusSchema.options },
);

export const LikelihoodImpactEnum = builder.enumType("LikelihoodImpact", {
  values: likelihoodImpactSchema.options,
});

export const AuditActionEnum = builder.enumType("AuditAction", {
  values: auditActionSchema.options,
});
