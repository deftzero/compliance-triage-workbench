import type { LikelihoodImpact, RiskLevel } from "@repo/shared";
import { caseHeader, expect, selectOption, test } from "./fixtures";

/**
 * Risk is derived, never typed in (R7). The form previews it with the same
 * `calculateRiskLevel` the server uses, so what a reporter is shown before
 * submitting is what the case is actually filed as.
 */
test.describe("reporting a case", () => {
  test.beforeEach(async ({ page, signInAs }) => {
    await signInAs("reporter");
    await page.goto("/cases/new");
  });

  const combinations: [LikelihoodImpact, LikelihoodImpact, RiskLevel][] = [
    ["Low", "Low", "Low"],
    ["Low", "High", "Medium"],
    ["Medium", "Medium", "Medium"],
    ["High", "High", "Critical"],
  ];

  for (const [likelihood, impact, risk] of combinations) {
    test(`previews ${likelihood} likelihood x ${impact} impact as ${risk}`, async ({
      page,
    }) => {
      await selectOption(page, "Likelihood", likelihood);
      await selectOption(page, "Impact", impact);

      // The bordered panel holding the "Calculated risk" caption and the badge.
      const preview = page.getByText("Calculated risk").locator("xpath=../..");
      await expect(preview).toContainText(risk);
    });
  }

  test("files the case and lands on it with the risk the server derived", async ({
    page,
  }) => {
    await page.getByLabel("Title").fill("Bribery allegation");
    await page
      .getByLabel("Description")
      .fill("Cash was offered to a tender official.");
    await selectOption(page, "Likelihood", "High");
    await selectOption(page, "Impact", "High");

    await page.getByRole("button", { name: "Submit report" }).click();

    await expect(
      page.getByRole("heading", { name: "Bribery allegation" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/cases\/[0-9a-f-]{36}$/);

    // Rendered from the mutation's response, so this is the server's number.
    await expect(caseHeader(page)).toContainText("Critical");
    await expect(caseHeader(page)).toContainText("Reported");
  });
});
