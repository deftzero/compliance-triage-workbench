import {
  CASE_CLOSED_MESSAGE,
  CLOSURE_BLOCKERS,
  type CaseStatus,
  type ClosureStatus,
  type CorrectiveActionStatus,
  type LikelihoodImpact,
  type RiskLevel,
  type Role,
  type TriageDecision,
} from "@repo/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  dataOf,
  errorOf,
  startTestServer,
  type TestServer,
} from "./helpers/graphql-client.js";

/**
 * The whole stack over HTTP: Express, Yoga's bearer-token context, the Pothos
 * resolvers, the Zod re-parse of every argument, and `maskError`. The service
 * unit tests prove the rules; these prove a client is actually told about them,
 * with the `extensions.code` and `extensions.blockers` contract intact.
 */
let api: TestServer;

const MANAGER = "manager@example.com";
const AUDITOR = "auditor@example.com";
const REPORTER = "reporter@example.com";

let manager: string;
let auditor: string;
let reporter: string;

beforeAll(async () => {
  api = await startTestServer();
  [manager, auditor, reporter] = await Promise.all([
    api.login(MANAGER),
    api.login(AUDITOR),
    api.login(REPORTER),
  ]);
});

afterAll(async () => {
  await api.close();
});

type CaseShape = {
  id: string;
  status: CaseStatus;
  riskLevel: RiskLevel;
  reporterId: string;
  likelihood: LikelihoodImpact;
  impact: LikelihoodImpact;
  triageDecision: TriageDecision | null;
  reviewNote: string | null;
  investigationOutcome: string | null;
  correctiveActionStatus: CorrectiveActionStatus | null;
  closedAt: string | null;
  closureStatus: ClosureStatus;
};

const CASE_FIELDS = `
  id status riskLevel reporterId likelihood impact
  triageDecision reviewNote investigationOutcome correctiveActionStatus
  closedAt closureStatus { ready blockers }
`;

const REPORT = `
  mutation ($title: String!, $description: String!, $likelihood: LikelihoodImpact!, $impact: LikelihoodImpact!) {
    reportCase(title: $title, description: $description, likelihood: $likelihood, impact: $impact) { ${CASE_FIELDS} }
  }`;

const TRIAGE = `
  mutation ($id: ID!, $decision: TriageDecision!, $investigationRequired: Boolean!,
            $correctiveActionRequired: Boolean!, $likelihood: LikelihoodImpact, $impact: LikelihoodImpact) {
    triageCase(id: $id, decision: $decision, investigationRequired: $investigationRequired,
               correctiveActionRequired: $correctiveActionRequired, likelihood: $likelihood, impact: $impact) { ${CASE_FIELDS} }
  }`;

const UPDATE = `
  mutation ($id: ID!, $reviewNote: String, $investigationOutcome: String, $correctiveActionStatus: CorrectiveActionStatus) {
    updateCase(id: $id, reviewNote: $reviewNote, investigationOutcome: $investigationOutcome,
               correctiveActionStatus: $correctiveActionStatus) { ${CASE_FIELDS} }
  }`;

const CLOSE = `mutation ($id: ID!) { closeCase(id: $id) { ${CASE_FIELDS} } }`;

const GET_CASE = `query ($id: ID!) { case(id: $id) { ${CASE_FIELDS} } }`;

/** Files a fresh case as the seeded reporter, so no test depends on another. */
async function report(
  likelihood: LikelihoodImpact = "Low",
  impact: LikelihoodImpact = "Low",
  token = reporter,
): Promise<CaseShape> {
  const response = await api.gql<{ reportCase: CaseShape }>(
    REPORT,
    {
      title: "Expense claim without receipt",
      description: "A claim was filed with no supporting receipt.",
      likelihood,
      impact,
    },
    token,
  );
  return dataOf(response).reportCase;
}

async function triage(
  id: string,
  input: {
    decision?: TriageDecision;
    investigationRequired?: boolean;
    correctiveActionRequired?: boolean;
  } = {},
): Promise<CaseShape> {
  const response = await api.gql<{ triageCase: CaseShape }>(
    TRIAGE,
    {
      id,
      decision: input.decision ?? "Accepted",
      investigationRequired: input.investigationRequired ?? false,
      correctiveActionRequired: input.correctiveActionRequired ?? false,
    },
    manager,
  );
  return dataOf(response).triageCase;
}

describe("authentication", () => {
  it("issues a token for a seeded account", async () => {
    const response = await api.gql<{
      login: { token: string; user: { email: string; role: Role } };
    }>(
      `mutation ($email: String!, $password: String!) {
        login(email: $email, password: $password) { token user { email role } }
      }`,
      { email: MANAGER, password: "password123" },
    );

    const { login } = dataOf(response);
    expect(login.token).toBeTypeOf("string");
    expect(login.user).toEqual({ email: MANAGER, role: "ComplianceManager" });
  });

  it("rejects a wrong password without saying whether the account exists", async () => {
    const response = await api.gql(
      `mutation ($email: String!, $password: String!) {
        login(email: $email, password: $password) { token }
      }`,
      { email: MANAGER, password: "wrong-password" },
    );

    const error = errorOf(response);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Invalid email or password");
  });

  it("turns an anonymous request away from `me`", async () => {
    const error = errorOf(await api.gql(`query { me { id } }`));

    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("You must be signed in.");
  });

  // The context resolves a bad token to a null actor rather than throwing, so
  // the request is anonymous — not a 500.
  it("treats a garbage bearer token as anonymous, not as a crash", async () => {
    const error = errorOf(
      await api.gql(`query { me { id } }`, {}, "not-a-real-token"),
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("resolves `me` to the token's owner", async () => {
    const response = await api.gql<{ me: { email: string; role: Role } }>(
      `query { me { email role } }`,
      {},
      auditor,
    );

    expect(dataOf(response).me).toEqual({ email: AUDITOR, role: "Auditor" });
  });
});

describe("reporting a case (R7)", () => {
  it("derives Critical risk from High likelihood and High impact", async () => {
    const filed = await report("High", "High");

    expect(filed.riskLevel).toBe("Critical");
    expect(filed.status).toBe("Reported");
  });

  it("attributes the case to the caller, not to anything they sent", async () => {
    const filed = await report();
    const me = dataOf(
      await api.gql<{ me: { id: string } }>(`query { me { id } }`, {}, reporter),
    ).me;

    expect(filed.reporterId).toBe(me.id);
  });

  // The strongest form of "server-authoritative": there is no argument to send.
  // The request dies in validation, before a resolver could even ignore it.
  it("has no riskLevel argument for a client to set", async () => {
    const response = await api.gql(
      `mutation {
        reportCase(title: "t", description: "d", likelihood: Low, impact: Low, riskLevel: Critical) { id }
      }`,
      {},
      reporter,
    );

    expect(errorOf(response).code).toBe("GRAPHQL_VALIDATION_FAILED");
  });

  it("refuses an Auditor filing a case", async () => {
    const response = await api.gql(
      REPORT,
      {
        title: "t",
        description: "d",
        likelihood: "Low",
        impact: "Low",
      },
      auditor,
    );

    expect(errorOf(response).code).toBe("FORBIDDEN");
  });

  it("reports which field failed validation", async () => {
    const response = await api.gql(
      REPORT,
      { title: "", description: "d", likelihood: "Low", impact: "Low" },
      reporter,
    );

    const error = errorOf(response);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.issues).toContainEqual({
      path: "title",
      message: "Title is required",
    });
  });
});

describe("triage (R6)", () => {
  it("moves a Reported case to Triaged for a Compliance Manager", async () => {
    const filed = await report();
    const triaged = await triage(filed.id, { decision: "Escalated" });

    expect(triaged.status).toBe("Triaged");
    expect(triaged.triageDecision).toBe("Escalated");
  });

  it.each([
    ["a Reporter", () => reporter, "FORBIDDEN"],
    ["an Auditor", () => auditor, "FORBIDDEN"],
    ["an anonymous caller", () => undefined, "UNAUTHORIZED"],
  ])("refuses %s", async (_who, tokenFor, code) => {
    const filed = await report();

    const response = await api.gql(
      TRIAGE,
      {
        id: filed.id,
        decision: "Accepted",
        investigationRequired: false,
        correctiveActionRequired: false,
      },
      tokenFor(),
    );

    expect(errorOf(response).code).toBe(code);
  });

  it("recomputes risk when triage adjusts the inputs, and says so in the same response", async () => {
    const filed = await report("Low", "Low");
    expect(filed.riskLevel).toBe("Low");

    const triaged = dataOf(
      await api.gql<{ triageCase: CaseShape }>(
        TRIAGE,
        {
          id: filed.id,
          decision: "Escalated",
          investigationRequired: false,
          correctiveActionRequired: false,
          likelihood: "High",
          impact: "High",
        },
        manager,
      ),
    ).triageCase;

    expect(triaged.riskLevel).toBe("Critical");
    // The raised risk immediately demands a review note — the client learns
    // that from the same payload, without a second round trip.
    expect(triaged.closureStatus.blockers).toEqual([
      CLOSURE_BLOCKERS.reviewNoteRequired,
    ]);
  });
});

describe("closing a case (R1-R4)", () => {
  it("blocks a case that was never triaged (R1)", async () => {
    const filed = await report();

    const error = errorOf(await api.gql(CLOSE, { id: filed.id }, manager));
    expect(error.code).toBe("CLOSURE_BLOCKED");
    expect(error.blockers).toEqual([CLOSURE_BLOCKERS.notTriaged]);
  });

  // The §5 contract: everything outstanding, in one round trip.
  it("returns every outstanding blocker at once, not just the first", async () => {
    const filed = await report("High", "High");
    await triage(filed.id, {
      decision: "Escalated",
      investigationRequired: true,
      correctiveActionRequired: true,
    });

    const error = errorOf(await api.gql(CLOSE, { id: filed.id }, manager));

    expect(error.code).toBe("CLOSURE_BLOCKED");
    expect(error.blockers).toEqual([
      CLOSURE_BLOCKERS.reviewNoteRequired,
      CLOSURE_BLOCKERS.investigationOutcomeMissing,
      CLOSURE_BLOCKERS.correctiveActionOpen,
    ]);
  });

  it("clears blockers one at a time until the case closes", async () => {
    const filed = await report("High", "High");
    await triage(filed.id, {
      decision: "Escalated",
      investigationRequired: true,
      correctiveActionRequired: true,
    });

    const update = async (input: Record<string, unknown>) =>
      dataOf(
        await api.gql<{ updateCase: CaseShape }>(
          UPDATE,
          { id: filed.id, ...input },
          manager,
        ),
      ).updateCase;

    // R2 — a review note is what High/Critical risk demands.
    let current = await update({ reviewNote: "Reviewed with legal." });
    expect(current.closureStatus.blockers).toEqual([
      CLOSURE_BLOCKERS.investigationOutcomeMissing,
      CLOSURE_BLOCKERS.correctiveActionOpen,
    ]);

    // R3 — the investigation triage asked for needs an outcome.
    current = await update({ investigationOutcome: "Substantiated." });
    expect(current.closureStatus.blockers).toEqual([
      CLOSURE_BLOCKERS.correctiveActionOpen,
    ]);

    // R4 — the corrective action itself has to be closed.
    current = await update({ correctiveActionStatus: "Closed" });
    expect(current.closureStatus).toEqual({ ready: true, blockers: [] });

    const closed = dataOf(
      await api.gql<{ closeCase: CaseShape }>(CLOSE, { id: filed.id }, manager),
    ).closeCase;

    expect(closed.status).toBe("Closed");
    expect(closed.closedAt).not.toBeNull();
  });

  // `reviewNote` has no minimum length, so this passes Zod — the domain has to
  // be the thing that catches it, and it reports a blocker, not a bad request.
  it("does not accept a whitespace-only review note as a review note (R2)", async () => {
    const filed = await report("High", "High");
    await triage(filed.id);

    const updated = dataOf(
      await api.gql<{ updateCase: CaseShape }>(
        UPDATE,
        { id: filed.id, reviewNote: "   " },
        manager,
      ),
    ).updateCase;
    expect(updated.closureStatus.blockers).toEqual([
      CLOSURE_BLOCKERS.reviewNoteRequired,
    ]);

    const error = errorOf(await api.gql(CLOSE, { id: filed.id }, manager));
    expect(error.code).toBe("CLOSURE_BLOCKED");
  });

  it("blocks the case again if a corrective action is reopened (R4)", async () => {
    const filed = await report();
    await triage(filed.id, { correctiveActionRequired: true });

    const done = dataOf(
      await api.gql<{ updateCase: CaseShape }>(
        UPDATE,
        { id: filed.id, correctiveActionStatus: "Closed" },
        manager,
      ),
    ).updateCase;
    expect(done.closureStatus.ready).toBe(true);

    const reopened = dataOf(
      await api.gql<{ updateCase: CaseShape }>(
        UPDATE,
        { id: filed.id, correctiveActionStatus: "Open" },
        manager,
      ),
    ).updateCase;

    expect(reopened.closureStatus.blockers).toEqual([
      CLOSURE_BLOCKERS.correctiveActionOpen,
    ]);
    expect(errorOf(await api.gql(CLOSE, { id: filed.id }, manager)).code).toBe(
      "CLOSURE_BLOCKED",
    );
  });

  it("asks a Low-risk case for no review note at all (R2)", async () => {
    const filed = await report("Low", "Low");
    const triaged = await triage(filed.id);

    expect(triaged.closureStatus).toEqual({ ready: true, blockers: [] });

    const closed = dataOf(
      await api.gql<{ closeCase: CaseShape }>(CLOSE, { id: filed.id }, manager),
    ).closeCase;
    expect(closed.status).toBe("Closed");
  });

  it("refuses a Reporter closing their own case (R6)", async () => {
    const filed = await report();
    await triage(filed.id);

    const response = await api.gql(CLOSE, { id: filed.id }, reporter);
    expect(errorOf(response).code).toBe("FORBIDDEN");
  });
});

describe("a closed case is immutable (R5/R8)", () => {
  async function closedCase(): Promise<CaseShape> {
    const filed = await report();
    await triage(filed.id);
    return dataOf(
      await api.gql<{ closeCase: CaseShape }>(CLOSE, { id: filed.id }, manager),
    ).closeCase;
  }

  it("refuses an edit", async () => {
    const closed = await closedCase();

    const error = errorOf(
      await api.gql(UPDATE, { id: closed.id, reviewNote: "tampering" }, manager),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe(CASE_CLOSED_MESSAGE);
  });

  it("refuses a re-triage", async () => {
    const closed = await closedCase();

    const error = errorOf(
      await api.gql(
        TRIAGE,
        {
          id: closed.id,
          decision: "Dismissed",
          investigationRequired: false,
          correctiveActionRequired: false,
        },
        manager,
      ),
    );
    expect(error.code).toBe("FORBIDDEN");
  });

  // Rejected as immutable rather than as unready — and so closedAt, which the
  // audit trail is anchored to, is written exactly once (R8).
  it("refuses a re-close and leaves closedAt untouched", async () => {
    const closed = await closedCase();

    const error = errorOf(await api.gql(CLOSE, { id: closed.id }, manager));
    expect(error.code).toBe("FORBIDDEN");
    expect(error.code).not.toBe("CLOSURE_BLOCKED");

    const reloaded = dataOf(
      await api.gql<{ case: CaseShape }>(GET_CASE, { id: closed.id }, manager),
    ).case;
    expect(reloaded.closedAt).toBe(closed.closedAt);
  });

  // A finished case is not "ready to close" — but nothing is outstanding on it
  // either. Reporting `notTriaged` here would be a lie about a triaged case.
  it("reports nothing outstanding, while still not being ready to close", async () => {
    const closed = await closedCase();

    expect(closed.closureStatus).toEqual({ ready: false, blockers: [] });
  });
});

describe("audit trail (R9/R10)", () => {
  const TRAIL = `
    query ($id: ID!) {
      case(id: $id) {
        auditTrail { action actorId actorName actorRole changes { field oldValue newValue } }
      }
    }`;

  type Entry = {
    action: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    changes: { field: string; oldValue: string | null; newValue: string | null }[];
  };

  async function trailOf(id: string, token = manager): Promise<Entry[]> {
    const response = await api.gql<{ case: { auditTrail: Entry[] } }>(
      TRAIL,
      { id },
      token,
    );
    return dataOf(response).case.auditTrail;
  }

  it("writes one Triaged entry, attributed to the manager who triaged", async () => {
    const filed = await report();
    await triage(filed.id, { decision: "Escalated" });

    const triaged = (await trailOf(filed.id)).filter(
      (entry) => entry.action === "Triaged",
    );

    expect(triaged).toHaveLength(1);
    expect(triaged[0]?.actorName).toBe("Morgan Chase");
    expect(triaged[0]?.actorRole).toBe("ComplianceManager");
    expect(triaged[0]?.changes).toContainEqual({
      field: "status",
      oldValue: "Reported",
      newValue: "Triaged",
    });
  });

  // Both entries carry the same timestamp, so only insertion order can put them
  // in the right sequence.
  it("is newest-first, even when one operation writes two entries", async () => {
    const filed = await report("Low", "Low");
    await api.gql(
      TRIAGE,
      {
        id: filed.id,
        decision: "Accepted",
        investigationRequired: false,
        correctiveActionRequired: false,
        likelihood: "High",
        impact: "High",
      },
      manager,
    );

    const actions = (await trailOf(filed.id)).map((entry) => entry.action);
    expect(actions).toEqual(["Triaged", "RiskInputsUpdated", "Reported"]);
  });

  it("leaves no trace of a rejected mutation", async () => {
    const filed = await report();

    await api.gql(
      TRIAGE,
      {
        id: filed.id,
        decision: "Accepted",
        investigationRequired: false,
        correctiveActionRequired: false,
      },
      auditor,
    );

    const actions = (await trailOf(filed.id)).map((entry) => entry.action);
    expect(actions).toEqual(["Reported"]);
  });
});

describe("access scoping", () => {
  const LIST = `query { cases { id reporterId } }`;

  /** A second Reporter, so "someone else's case" is a real thing to test. */
  async function otherReporter(): Promise<string> {
    const email = `other-${crypto.randomUUID()}@example.com`;
    const response = await api.gql<{ register: { token: string } }>(
      `mutation ($email: String!, $name: String!, $password: String!, $role: Role) {
        register(email: $email, name: $name, password: $password, role: $role) { token }
      }`,
      { email, name: "Sam Vale", password: "password123", role: "Reporter" },
    );
    return dataOf(response).register.token;
  }

  it("shows a Reporter only their own cases, and everyone else all of them", async () => {
    const theirs = await report("Low", "Low", await otherReporter());

    const mine = dataOf(
      await api.gql<{ cases: { id: string }[] }>(LIST, {}, reporter),
    ).cases;
    const managerSees = dataOf(
      await api.gql<{ cases: { id: string }[] }>(LIST, {}, manager),
    ).cases;

    expect(mine.map((c) => c.id)).not.toContain(theirs.id);
    expect(managerSees.map((c) => c.id)).toContain(theirs.id);
  });

  // Reading someone else's case is forbidden; *mutating* it is a 404. The
  // difference is deliberate — a Reporter must not be able to probe for the
  // existence of cases that aren't theirs by watching the error change.
  it("hides the existence of another Reporter's case from a write, but not from a read", async () => {
    const theirs = await report("Low", "Low", await otherReporter());

    const read = errorOf(await api.gql(GET_CASE, { id: theirs.id }, reporter));
    expect(read.code).toBe("FORBIDDEN");

    const write = errorOf(
      await api.gql(UPDATE, { id: theirs.id, reviewNote: "x" }, reporter),
    );
    expect(write.code).toBe("NOT_FOUND");
  });

  it("404s an id that does not exist", async () => {
    const error = errorOf(
      await api.gql(GET_CASE, { id: crypto.randomUUID() }, manager),
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("lets an Auditor read any case but change nothing", async () => {
    const filed = await report();

    const read = dataOf(
      await api.gql<{ case: CaseShape }>(GET_CASE, { id: filed.id }, auditor),
    ).case;
    expect(read.id).toBe(filed.id);

    const write = errorOf(
      await api.gql(UPDATE, { id: filed.id, reviewNote: "no" }, auditor),
    );
    expect(write.code).toBe("FORBIDDEN");
  });
});
