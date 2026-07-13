import { CLOSURE_BLOCKERS } from "@repo/shared";
import { blockingAlert, cardTitle, caseHeader, expect, test } from "./fixtures";

/**
 * The blocker strings are imported, never retyped: the API's rejection payload
 * and what the UI renders are the same constants, and this suite would fail if
 * they ever drifted apart.
 */
test.describe("closing a case", () => {
  test.beforeEach(async ({ signInAs }) => {
    await signInAs("manager");
  });

  test("refuses to close until every blocker is cleared, then closes", async ({
    page,
    seedCase,
  }) => {
    const seeded = await seedCase({
      likelihood: "High",
      impact: "High",
      triage: {
        decision: "Escalated",
        investigationRequired: true,
        correctiveActionRequired: true,
      },
    });
    await page.goto(`/cases/${seeded.id}`);

    const closeButton = page.getByRole("button", { name: "Close case" });

    // Everything outstanding is shown at once — not discovered one failed
    // close at a time.
    await expect(closeButton).toBeDisabled();
    await expect(blockingAlert(page)).toContainText(
      CLOSURE_BLOCKERS.reviewNoteRequired,
    );
    await expect(blockingAlert(page)).toContainText(
      CLOSURE_BLOCKERS.investigationOutcomeMissing,
    );
    await expect(blockingAlert(page)).toContainText(
      CLOSURE_BLOCKERS.correctiveActionOpen,
    );

    // R2 — a Critical case cannot close without a review note.
    await page.getByLabel("Review note").fill("Reviewed with legal counsel.");
    await page.getByRole("button", { name: "Save review note" }).click();
    await expect(blockingAlert(page)).not.toContainText(
      CLOSURE_BLOCKERS.reviewNoteRequired,
    );
    await expect(closeButton).toBeDisabled();

    // R3 — an investigation triage asked for cannot close without an outcome.
    await page
      .getByLabel("Investigation outcome")
      .fill("Substantiated; the contract was cancelled.");
    await page.getByRole("button", { name: "Save outcome" }).click();
    await expect(blockingAlert(page)).not.toContainText(
      CLOSURE_BLOCKERS.investigationOutcomeMissing,
    );
    await expect(closeButton).toBeDisabled();

    // R4 — a required corrective action cannot close while it is still open.
    await page.getByRole("button", { name: "Mark action closed" }).click();
    await expect(blockingAlert(page)).toHaveCount(0);

    await expect(
      page.getByText("Ready to close — nothing outstanding."),
    ).toBeVisible();
    await expect(closeButton).toBeEnabled();

    await closeButton.click();

    await expect(caseHeader(page)).toContainText("Closed");
  });

  // R5 — once closed, there is nothing left to act on, for anyone.
  test("leaves a closed case read-only", async ({ page, seedCase }) => {
    const seeded = await seedCase({ triage: {} });
    await page.goto(`/cases/${seeded.id}`);

    await page.getByRole("button", { name: "Close case" }).click();
    await expect(caseHeader(page)).toContainText("Closed");

    await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "This case is closed. It is immutable and accepts no further changes.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Close case" })).toHaveCount(
      0,
    );
    await expect(cardTitle(page, "Review")).toHaveCount(0);
    await expect(cardTitle(page, "Triage")).toHaveCount(0);
    await expect(page.getByLabel("Review note")).toHaveCount(0);
  });

  // R2 only bites at High and Critical — a Low-risk case is ready immediately.
  test("asks a Low-risk case for no review note", async ({
    page,
    seedCase,
  }) => {
    const seeded = await seedCase({
      likelihood: "Low",
      impact: "Low",
      triage: { decision: "Accepted" },
    });
    await page.goto(`/cases/${seeded.id}`);

    await expect(blockingAlert(page)).toHaveCount(0);
    await expect(
      page.getByText("Ready to close — nothing outstanding."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Close case" }).click();

    await expect(caseHeader(page)).toContainText("Closed");
  });
});
