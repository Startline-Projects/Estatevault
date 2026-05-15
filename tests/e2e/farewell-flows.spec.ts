import { test, expect } from "@playwright/test";

test.describe("farewell video flows", () => {
  test.fixme("client uploads farewell video — stored encrypted", async ({ page }) => {
    // TODO: navigate /dashboard/farewell, upload mp4, assert DB row + storage object
  });

  test.fixme("client re-records farewell — replaces previous", async ({ page }) => {
    // TODO
  });

  test.fixme("/farewell/[clientId] renders for trustee post-unlock", async ({ page }) => {
    // TODO
  });

  test.fixme("owner-veto cancels playback within veto window", async ({ page }) => {
    // TODO: trigger veto, assert player blocked
  });

  test.fixme("owner-veto expires — playback resumes", async ({ page }) => {
    // TODO
  });
});
