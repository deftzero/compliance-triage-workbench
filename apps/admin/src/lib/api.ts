import type {
  AuditEntry,
  CaseFilter,
  ClosureStatus,
  ComplianceCase,
  CreateCaseInput,
  PublicUser,
  TriageInput,
  UpdateCaseInput,
} from "@repo/shared";
import { request } from "./graphql";

/** Exactly what the backend's Case type resolves to. */
export type CaseView = ComplianceCase & { closureStatus: ClosureStatus };

const CASE_FIELDS = `
  id
  title
  description
  category
  likelihood
  impact
  riskLevel
  status
  reporterId
  triageDecision
  triagedAt
  investigationRequired
  correctiveActionRequired
  reviewNote
  investigationOutcome
  correctiveActionStatus
  createdAt
  closedAt
  closureStatus { ready blockers }
`;

export async function login(email: string, password: string) {
  const data = await request<{
    login: { token: string; user: PublicUser };
  }>(
    `mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        token
        user { id email name role createdAt }
      }
    }`,
    { email, password },
  );
  return data.login;
}

export async function fetchMe(): Promise<PublicUser> {
  const data = await request<{ me: PublicUser }>(
    `query Me { me { id email name role createdAt } }`,
  );
  return data.me;
}

export async function fetchCases(filter: CaseFilter): Promise<CaseView[]> {
  const data = await request<{ cases: CaseView[] }>(
    `query Cases($status: CaseStatus, $riskLevel: RiskLevel, $q: String) {
      cases(status: $status, riskLevel: $riskLevel, q: $q) { ${CASE_FIELDS} }
    }`,
    {
      status: filter.status ?? null,
      riskLevel: filter.riskLevel ?? null,
      q: filter.q?.trim() ? filter.q.trim() : null,
    },
  );
  return data.cases;
}

export async function fetchCase(id: string): Promise<CaseView> {
  const data = await request<{ case: CaseView }>(
    `query Case($id: ID!) { case(id: $id) { ${CASE_FIELDS} } }`,
    { id },
  );
  return data.case;
}

export async function fetchAuditTrail(id: string): Promise<AuditEntry[]> {
  const data = await request<{ case: { auditTrail: AuditEntry[] } }>(
    `query AuditTrail($id: ID!) {
      case(id: $id) {
        auditTrail {
          id action actorName actorRole timestamp
          changes { field oldValue newValue }
        }
      }
    }`,
    { id },
  );
  return data.case.auditTrail;
}

export async function reportCase(input: CreateCaseInput): Promise<CaseView> {
  const data = await request<{ reportCase: CaseView }>(
    `mutation ReportCase(
      $title: String!, $description: String!,
      $likelihood: LikelihoodImpact!, $impact: LikelihoodImpact!, $category: String
    ) {
      reportCase(
        title: $title, description: $description,
        likelihood: $likelihood, impact: $impact, category: $category
      ) { ${CASE_FIELDS} }
    }`,
    { ...input, category: input.category ?? null },
  );
  return data.reportCase;
}

export async function triageCase(
  id: string,
  input: TriageInput,
): Promise<CaseView> {
  const data = await request<{ triageCase: CaseView }>(
    `mutation TriageCase(
      $id: ID!, $decision: TriageDecision!,
      $investigationRequired: Boolean!, $correctiveActionRequired: Boolean!,
      $likelihood: LikelihoodImpact, $impact: LikelihoodImpact
    ) {
      triageCase(
        id: $id, decision: $decision,
        investigationRequired: $investigationRequired,
        correctiveActionRequired: $correctiveActionRequired,
        likelihood: $likelihood, impact: $impact
      ) { ${CASE_FIELDS} }
    }`,
    {
      id,
      ...input,
      likelihood: input.likelihood ?? null,
      impact: input.impact ?? null,
    },
  );
  return data.triageCase;
}

export async function updateCase(
  id: string,
  input: UpdateCaseInput,
): Promise<CaseView> {
  const data = await request<{ updateCase: CaseView }>(
    `mutation UpdateCase(
      $id: ID!, $reviewNote: String, $investigationOutcome: String,
      $correctiveActionStatus: CorrectiveActionStatus
    ) {
      updateCase(
        id: $id, reviewNote: $reviewNote,
        investigationOutcome: $investigationOutcome,
        correctiveActionStatus: $correctiveActionStatus
      ) { ${CASE_FIELDS} }
    }`,
    {
      id,
      reviewNote: input.reviewNote ?? null,
      investigationOutcome: input.investigationOutcome ?? null,
      correctiveActionStatus: input.correctiveActionStatus ?? null,
    },
  );
  return data.updateCase;
}

/** Rejects with an ApiError whose `blockers` lists everything outstanding. */
export async function closeCase(id: string): Promise<CaseView> {
  const data = await request<{ closeCase: CaseView }>(
    `mutation CloseCase($id: ID!) { closeCase(id: $id) { ${CASE_FIELDS} } }`,
    { id },
  );
  return data.closeCase;
}
