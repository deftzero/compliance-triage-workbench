import {
  caseFilterSchema,
  createCaseSchema,
  triageInputSchema,
  updateCaseSchema,
  type AuditEntry,
  type ClosureStatus,
  type FieldChange,
} from "@repo/shared";
import { builder, requireActor, type GraphQLContext } from "./builder.js";
import type { CaseView } from "../services/case.service.js";
import {
  AuditActionEnum,
  CaseStatusEnum,
  CorrectiveActionStatusEnum,
  LikelihoodImpactEnum,
  RiskLevelEnum,
  TriageDecisionEnum,
} from "./enums.js";

const ClosureStatusType = builder
  .objectRef<ClosureStatus>("ClosureStatus")
  .implement({
    description:
      "Server-computed closure readiness. The UI renders these blockers; it never derives them itself.",
    fields: (t) => ({
      ready: t.exposeBoolean("ready"),
      blockers: t.exposeStringList("blockers"),
    }),
  });

const FieldChangeType = builder
  .objectRef<FieldChange>("FieldChange")
  .implement({
    fields: (t) => ({
      field: t.exposeString("field"),
      oldValue: t.exposeString("oldValue", { nullable: true }),
      newValue: t.exposeString("newValue", { nullable: true }),
    }),
  });

const AuditEntryType = builder
  .objectRef<AuditEntry>("AuditEntry")
  .implement({
    fields: (t) => ({
      id: t.exposeID("id"),
      caseId: t.exposeID("caseId"),
      action: t.field({ type: AuditActionEnum, resolve: (e) => e.action }),
      actorId: t.exposeID("actorId"),
      actorName: t.exposeString("actorName"),
      actorRole: t.exposeString("actorRole"),
      timestamp: t.exposeString("timestamp"),
      changes: t.field({
        type: [FieldChangeType],
        resolve: (entry) => entry.changes,
      }),
    }),
  });

const CaseType = builder.objectRef<CaseView>("Case").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    description: t.exposeString("description"),
    category: t.exposeString("category", { nullable: true }),

    likelihood: t.field({
      type: LikelihoodImpactEnum,
      resolve: (c) => c.likelihood,
    }),
    impact: t.field({ type: LikelihoodImpactEnum, resolve: (c) => c.impact }),
    riskLevel: t.field({ type: RiskLevelEnum, resolve: (c) => c.riskLevel }),

    status: t.field({ type: CaseStatusEnum, resolve: (c) => c.status }),
    reporterId: t.exposeID("reporterId"),

    triageDecision: t.field({
      type: TriageDecisionEnum,
      nullable: true,
      resolve: (c) => c.triageDecision,
    }),
    triagedAt: t.exposeString("triagedAt", { nullable: true }),
    triagedBy: t.exposeID("triagedBy", { nullable: true }),
    investigationRequired: t.exposeBoolean("investigationRequired", {
      nullable: true,
    }),
    correctiveActionRequired: t.exposeBoolean("correctiveActionRequired", {
      nullable: true,
    }),

    reviewNote: t.exposeString("reviewNote", { nullable: true }),
    investigationOutcome: t.exposeString("investigationOutcome", {
      nullable: true,
    }),
    correctiveActionStatus: t.field({
      type: CorrectiveActionStatusEnum,
      nullable: true,
      resolve: (c) => c.correctiveActionStatus,
    }),

    createdAt: t.exposeString("createdAt"),
    closedAt: t.exposeString("closedAt", { nullable: true }),
    closedBy: t.exposeID("closedBy", { nullable: true }),

    closureStatus: t.field({
      type: ClosureStatusType,
      resolve: (c) => c.closureStatus,
    }),

    auditTrail: t.field({
      type: [AuditEntryType],
      description: "Append-only, newest first.",
      resolve: (complianceCase, _args, context: GraphQLContext) =>
        context.services.cases.listAudit(
          requireActor(context),
          complianceCase.id,
        ),
    }),
  }),
});

builder.queryFields((t) => ({
  cases: t.field({
    type: [CaseType],
    description: "Role-scoped: a Reporter only ever sees their own cases.",
    args: {
      status: t.arg({ type: CaseStatusEnum, required: false }),
      riskLevel: t.arg({ type: RiskLevelEnum, required: false }),
      q: t.arg.string({ required: false }),
    },
    resolve: (_root, args, context: GraphQLContext) => {
      const filter = caseFilterSchema.parse({
        ...(args.status ? { status: args.status } : {}),
        ...(args.riskLevel ? { riskLevel: args.riskLevel } : {}),
        ...(args.q ? { q: args.q } : {}),
      });
      return context.services.cases.list(requireActor(context), filter);
    },
  }),

  case: t.field({
    type: CaseType,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args, context: GraphQLContext) =>
      context.services.cases.getById(requireActor(context), String(args.id)),
  }),
}));

builder.mutationFields((t) => ({
  reportCase: t.field({
    type: CaseType,
    description: "Risk is computed from likelihood and impact, never supplied.",
    args: {
      title: t.arg.string({ required: true }),
      description: t.arg.string({ required: true }),
      likelihood: t.arg({ type: LikelihoodImpactEnum, required: true }),
      impact: t.arg({ type: LikelihoodImpactEnum, required: true }),
      category: t.arg.string({ required: false }),
    },
    resolve: (_root, args, context: GraphQLContext) =>
      context.services.cases.report(
        requireActor(context),
        createCaseSchema.parse({
          title: args.title,
          description: args.description,
          likelihood: args.likelihood,
          impact: args.impact,
          ...(args.category ? { category: args.category } : {}),
        }),
      ),
  }),

  triageCase: t.field({
    type: CaseType,
    args: {
      id: t.arg.id({ required: true }),
      decision: t.arg({ type: TriageDecisionEnum, required: true }),
      investigationRequired: t.arg.boolean({ required: true }),
      correctiveActionRequired: t.arg.boolean({ required: true }),
      likelihood: t.arg({ type: LikelihoodImpactEnum, required: false }),
      impact: t.arg({ type: LikelihoodImpactEnum, required: false }),
    },
    resolve: (_root, args, context: GraphQLContext) =>
      context.services.cases.triage(
        requireActor(context),
        String(args.id),
        triageInputSchema.parse({
          decision: args.decision,
          investigationRequired: args.investigationRequired,
          correctiveActionRequired: args.correctiveActionRequired,
          ...(args.likelihood ? { likelihood: args.likelihood } : {}),
          ...(args.impact ? { impact: args.impact } : {}),
        }),
      ),
  }),

  updateCase: t.field({
    type: CaseType,
    args: {
      id: t.arg.id({ required: true }),
      reviewNote: t.arg.string({ required: false }),
      investigationOutcome: t.arg.string({ required: false }),
      correctiveActionStatus: t.arg({
        type: CorrectiveActionStatusEnum,
        required: false,
      }),
    },
    resolve: (_root, args, context: GraphQLContext) =>
      context.services.cases.update(
        requireActor(context),
        String(args.id),
        updateCaseSchema.parse({
          ...(args.reviewNote !== undefined && args.reviewNote !== null
            ? { reviewNote: args.reviewNote }
            : {}),
          ...(args.investigationOutcome !== undefined &&
          args.investigationOutcome !== null
            ? { investigationOutcome: args.investigationOutcome }
            : {}),
          ...(args.correctiveActionStatus
            ? { correctiveActionStatus: args.correctiveActionStatus }
            : {}),
        }),
      ),
  }),

  closeCase: t.field({
    type: CaseType,
    description:
      "Fails with a CLOSURE_BLOCKED error carrying every outstanding blocker when the case is not ready.",
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args, context: GraphQLContext) =>
      context.services.cases.close(requireActor(context), String(args.id)),
  }),
}));
