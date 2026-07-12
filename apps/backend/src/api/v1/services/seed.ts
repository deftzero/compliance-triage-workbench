import type { Actor } from "@repo/shared";
import { env } from "../../../config/env.js";
import type { Repositories } from "../repositories/index.js";
import type { AuthService } from "./auth.service.js";
import { CaseService } from "./case.service.js";

export const SEED_PASSWORD = "password123";

export const SEED_USERS = [
  {
    email: "manager@example.com",
    name: "Morgan Chase",
    role: "ComplianceManager",
  },
  { email: "auditor@example.com", name: "Avery Quinn", role: "Auditor" },
  { email: "reporter@example.com", name: "Riley Diaz", role: "Reporter" },
] as const;

/**
 * Gives every role something to look at on first boot. Idempotent: if the
 * manager already exists we assume the store is seeded and bail, so restarting
 * against a real database doesn't duplicate anything.
 */
export async function seed(
  repositories: Repositories,
  auth: AuthService,
): Promise<void> {
  const existing = await repositories.users.findByEmail(SEED_USERS[0].email);
  if (existing) return;

  for (const user of SEED_USERS) {
    await auth.register({ ...user, password: SEED_PASSWORD });
  }

  const manager = await repositories.users.findByEmail(SEED_USERS[0].email);
  const reporter = await repositories.users.findByEmail(SEED_USERS[2].email);
  if (!manager || !reporter) return;

  const asActor = (user: typeof manager): Actor => ({
    id: user.id,
    name: user.name,
    role: user.role,
  });

  const reporterActor = asActor(reporter);
  const managerActor = asActor(manager);
  const cases = new CaseService(repositories.cases, repositories.audit);

  // Reported, low risk — nothing done to it yet.
  await cases.report(reporterActor, {
    title: "Missing expense receipts",
    description:
      "Three expense claims in Q2 were filed without supporting receipts.",
    likelihood: "Low",
    impact: "Low",
    category: "Legal / Insurance",
  });

  // Reported, critical — awaiting triage.
  await cases.report(reporterActor, {
    title: "Customer data shared with unapproved vendor",
    description:
      "A marketing list including customer emails was uploaded to a vendor with no signed DPA.",
    likelihood: "High",
    impact: "High",
    category: "Data breach",
  });

  // Triaged and blocked: high risk, investigation and corrective action open —
  // opening this one shows the full blocker list.
  const conflict = await cases.report(reporterActor, {
    title: "Undisclosed conflict of interest",
    description:
      "A procurement lead approved a contract for a company owned by a relative.",
    likelihood: "Medium",
    impact: "High",
    category: "Staff conduct",
  });
  await cases.triage(managerActor, conflict.id, {
    decision: "Escalated",
    investigationRequired: true,
    correctiveActionRequired: true,
  });

  // Triaged, low risk, nothing outstanding — ready to close.
  const parking = await cases.report(reporterActor, {
    title: "Parking policy misuse",
    description: "A contractor used a reserved visitor parking bay for a week.",
    likelihood: "Low",
    impact: "Low",
    category: "Safety",
  });
  await cases.triage(managerActor, parking.id, {
    decision: "Accepted",
    investigationRequired: false,
    correctiveActionRequired: false,
  });

  // Closed — immutable, and proves the audit trail across a full lifecycle.
  const gifts = await cases.report(reporterActor, {
    title: "Gift from supplier exceeded policy limit",
    description: "A team member accepted event tickets valued above the limit.",
    likelihood: "Medium",
    impact: "Medium",
    category: "Staff conduct",
  });
  await cases.triage(managerActor, gifts.id, {
    decision: "Accepted",
    investigationRequired: true,
    correctiveActionRequired: false,
  });
  await cases.update(managerActor, gifts.id, {
    investigationOutcome: "Tickets were returned; the team member was retrained.",
  });
  await cases.close(managerActor, gifts.id);

  console.log(
    `seeded ${SEED_USERS.length} users (password: ${SEED_PASSWORD}) and 5 cases [persistence=${env.PERSISTENCE}]`,
  );
}
