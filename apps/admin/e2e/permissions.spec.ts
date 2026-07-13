import { expect, test } from "./fixtures";

/**
 * Hiding a control is a courtesy, not a control: the backend rejects the same
 * actions independently, which the GraphQL e2e suite asserts. What matters here
 * is that the UI never offers a button that would only fail.
 */
test.describe("role permissions", () => {
  test("gives an Auditor a read-only case, with nothing to triage or close", async ({
    page,
    signInAs,
    seedCase,
  }) => {
    const seeded = await seedCase();
    await signInAs("auditor");
    await page.goto(`/cases/${seeded.id}`);

    await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Auditors have read-only access to every case."),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Record triage" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close case" })).toHaveCount(
      0,
    );
  });

  test("turns an Auditor away from the report form", async ({
    page,
    signInAs,
  }) => {
    await signInAs("auditor");
    await page.goto("/cases/new");

    await expect(
      page.getByText("Auditors have read-only access."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit report" }),
    ).toHaveCount(0);
  });

  test("gives a Reporter no way to triage the case they filed", async ({
    page,
    signInAs,
    seedCase,
  }) => {
    const seeded = await seedCase();
    await signInAs("reporter");
    await page.goto(`/cases/${seeded.id}`);

    await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Only a Compliance Manager can triage, update, or close a case.",
      ),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Record triage" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close case" })).toHaveCount(
      0,
    );
  });
});
