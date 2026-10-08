import { afterEach, describe, expect, it, vi } from "vitest";

async function loadManifest(viewOnly: boolean) {
  vi.resetModules();
  vi.stubEnv("OFFICE_VIEW_ONLY", viewOnly ? "1" : "");
  return (await import("../src/manifest.js")).default;
}

describe("view-only manifest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for no write permission over company data", async () => {
    const m = await loadManifest(true);
    for (const c of [
      "issues.create",
      "issues.update",
      "issues.wakeup",
      "issue.comments.create",
      "approvals.respond",
      "issue.interactions.respond",
      "agent.tools.register",
      "database.namespace.write",
    ]) {
      expect(m.capabilities).not.toContain(c);
    }
    expect(m.tools ?? []).toHaveLength(0);
  });

  it("declares both database capabilities the host requires with a database block", async () => {
    const m = await loadManifest(true);
    expect(m.database).toBeDefined();
    expect(m.capabilities).toContain("database.namespace.migrate");
    expect(m.capabilities).toContain("database.namespace.read");
  });
});
