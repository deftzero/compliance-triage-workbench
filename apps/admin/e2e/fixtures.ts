import type {
  LikelihoodImpact,
  TriageDecision,
  TriageInput,
} from "@repo/shared";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { API_URL } from "../playwright.config";

/**
 * State is arranged over the API and only the behaviour under test is driven
 * through the UI. That keeps every spec independent of the five seeded cases
 * and of each other, so the suite is safe to run fully parallel against one
 * shared backend. The corollary: never assert on list or dashboard *counts* —
 * a spec in another worker may be adding cases at the same moment.
 */
const SEED_PASSWORD = "password123";

/** The key `src/lib/graphql.ts` reads the bearer token from. */
const TOKEN_KEY = "compliance.token";

export type SeedRole = "manager" | "auditor" | "reporter";

export const ACCOUNTS: Record<SeedRole, { email: string; name: string }> = {
  manager: { email: "manager@example.com", name: "Morgan Chase" },
  auditor: { email: "auditor@example.com", name: "Avery Quinn" },
  reporter: { email: "reporter@example.com", name: "Riley Diaz" },
};

async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (body.errors || !body.data) {
    throw new Error(
      `GraphQL request failed: ${body.errors?.map((e) => e.message).join("; ")}`,
    );
  }
  return body.data;
}

const tokens = new Map<SeedRole, Promise<string>>();

/** Cached per worker — logging in three times per spec file is pure latency. */
function tokenFor(role: SeedRole): Promise<string> {
  const cached = tokens.get(role);
  if (cached) return cached;

  const pending = gql<{ login: { token: string } }>(
    `mutation ($email: String!, $password: String!) {
      login(email: $email, password: $password) { token }
    }`,
    { email: ACCOUNTS[role].email, password: SEED_PASSWORD },
  ).then((data) => data.login.token);

  tokens.set(role, pending);
  return pending;
}

export type SeededCase = { id: string; title: string };

type SeedCaseInput = {
  title?: string;
  likelihood?: LikelihoodImpact;
  impact?: LikelihoodImpact;
  /** Triage it as the manager straight after filing it. */
  triage?: Partial<TriageInput> & { decision?: TriageDecision };
};

export const test = base.extend<{
  /** Puts a real bearer token in localStorage, so specs skip the login form. */
  signInAs: (role: SeedRole) => Promise<void>;
  /** Files a case as the reporter, optionally triaging it as the manager. */
  seedCase: (input?: SeedCaseInput) => Promise<SeededCase>;
}>({
  signInAs: async ({ page }, use) => {
    await use(async (role) => {
      const token = await tokenFor(role);
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [TOKEN_KEY, token] as const,
      );
    });
  },

  seedCase: async ({}, use) => {
    await use(async (input = {}) => {
      const title =
        input.title ?? `Case ${Math.random().toString(36).slice(2, 10)}`;

      const reporter = await tokenFor("reporter");
      const { reportCase } = await gql<{ reportCase: SeededCase }>(
        `mutation ($title: String!, $description: String!, $likelihood: LikelihoodImpact!, $impact: LikelihoodImpact!) {
          reportCase(title: $title, description: $description, likelihood: $likelihood, impact: $impact) { id title }
        }`,
        {
          title,
          description: "Filed by the end-to-end suite.",
          likelihood: input.likelihood ?? "Low",
          impact: input.impact ?? "Low",
        },
        reporter,
      );

      if (input.triage) {
        const manager = await tokenFor("manager");
        await gql(
          `mutation ($id: ID!, $decision: TriageDecision!, $investigationRequired: Boolean!, $correctiveActionRequired: Boolean!) {
            triageCase(id: $id, decision: $decision, investigationRequired: $investigationRequired,
                       correctiveActionRequired: $correctiveActionRequired) { id }
          }`,
          {
            id: reportCase.id,
            decision: input.triage.decision ?? "Accepted",
            investigationRequired: input.triage.investigationRequired ?? false,
            correctiveActionRequired:
              input.triage.correctiveActionRequired ?? false,
          },
          manager,
        );
      }

      return reportCase;
    });
  },
});

export { expect };

/**
 * shadcn here is Base UI, not Radix: a Select is a button plus a portalled
 * popup, so `selectOption()` does nothing. Click the trigger, then the option.
 */
export async function selectOption(
  page: Page,
  label: string,
  option: string,
): Promise<void> {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The one-line case header: title, risk badge and status badge together. */
export function caseHeader(page: Page): Locator {
  return page.getByRole("heading", { level: 1 }).locator("xpath=..");
}

/**
 * A card's title. shadcn's CardTitle is a plain div with no heading role, so
 * `getByRole("heading")` would silently match nothing — and a `toHaveCount(0)`
 * written against it would pass for the wrong reason.
 */
export function cardTitle(page: Page, name: string): Locator {
  return page
    .locator('[data-slot="card-title"]')
    .filter({ hasText: new RegExp(`^${name}$`) });
}

/**
 * The blocker list in the closure panel. The details rail renders the same
 * blockers, so scoping to the alert is what keeps the assertion unambiguous.
 */
export function blockingAlert(page: Page): Locator {
  return page.getByRole("alert").filter({ hasText: "Blocking closure" });
}
