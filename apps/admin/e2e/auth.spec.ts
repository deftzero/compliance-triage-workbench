import { ACCOUNTS, cardTitle, expect, test } from "./fixtures";

test.describe("authentication", () => {
  // Auth is not a route: the root layout swaps in the login screen when there
  // is no session, so an unauthenticated visit stays on "/".
  test("shows the login screen in place when there is no session", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(cardTitle(page, "Compliance Triage")).toBeVisible();
    await expect(page.getByText("Sign in to continue.")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("rejects a wrong password and stays put", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Sign in failed")).toBeVisible();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in" }),
    ).toBeVisible();
  });

  test("signs a Compliance Manager in and out", async ({ page }) => {
    await page.goto("/");

    // The form is prefilled with the manager account.
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(ACCOUNTS.manager.name)).toBeVisible();
    await expect(page.getByText("Compliance Manager")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page.getByText("Sign in to continue.")).toBeVisible();
    expect(
      await page.evaluate(() => window.localStorage.getItem("compliance.token")),
    ).toBeNull();
  });

  // The token is never trusted on its own — the `me` query decides. A stale one
  // has to resolve to a signed-out screen, not a half-broken shell.
  test("treats a stale token as signed out", async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem("compliance.token", "stale.garbage.token"),
    );

    await page.goto("/");

    await expect(page.getByText("Sign in to continue.")).toBeVisible();
  });

  test("gives a Reporter their own cases and a way to file one", async ({
    page,
    signInAs,
  }) => {
    await signInAs("reporter");
    await page.goto("/");

    await expect(page.getByRole("link", { name: "My Cases" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report a Case" }).first(),
    ).toBeVisible();
  });

  test("offers an Auditor no way to file a case", async ({
    page,
    signInAs,
  }) => {
    await signInAs("auditor");
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Cases" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report a Case" }),
    ).toHaveCount(0);
  });
});
