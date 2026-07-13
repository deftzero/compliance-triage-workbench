import { cardTitle, caseHeader, expect, selectOption, test } from "./fixtures";

test.describe("triage", () => {
  test.beforeEach(async ({ signInAs }) => {
    await signInAs("manager");
  });

  test("moves a Reported case to Triaged and records who did it", async ({
    page,
    seedCase,
  }) => {
    const seeded = await seedCase();
    await page.goto(`/cases/${seeded.id}`);

    await expect(caseHeader(page)).toContainText("Reported");
    await expect(cardTitle(page, "Triage")).toBeVisible();

    await selectOption(page, "Decision", "Escalated");
    await page.getByRole("checkbox", { name: "Investigation required" }).check();
    await page.getByRole("button", { name: "Record triage" }).click();

    await expect(caseHeader(page)).toContainText("Triaged");
    // The triage form is done; the review surface takes its place.
    await expect(cardTitle(page, "Review")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Record triage" }),
    ).toHaveCount(0);

    // Saving a triage writes an audit entry — attributed server-side, to the
    // manager who did it, never to whatever a client might have claimed.
    await page.getByRole("link", { name: "Activity Logs" }).click();

    const entry = page.getByRole("listitem").filter({ hasText: "Triaged" });
    await expect(entry.first()).toContainText("Morgan Chase");
    await expect(entry.first()).toContainText("Compliance Manager");
    await expect(entry.first()).toContainText("Reported");
  });

  test("recomputes the risk level when triage adjusts the inputs", async ({
    page,
    seedCase,
  }) => {
    const seeded = await seedCase({ likelihood: "Low", impact: "Low" });
    await page.goto(`/cases/${seeded.id}`);

    await expect(caseHeader(page)).toContainText("Low");

    await selectOption(page, "Likelihood", "High");
    await selectOption(page, "Impact", "High");
    await page.getByRole("button", { name: "Record triage" }).click();

    await expect(caseHeader(page)).toContainText("Critical");

    await page.getByRole("link", { name: "Activity Logs" }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "Risk inputs updated" }),
    ).toContainText("Critical");
  });
});
