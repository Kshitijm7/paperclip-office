import { describe, expect, it } from "vitest";
import { loadAgentDetail } from "../src/worker/agent-detail.js";
import type { AgentRow, IssueRow, RunRow } from "../src/shared/office.js";
import type { Agent, PluginContext } from "@paperclipai/plugin-sdk";

const agents = [
  { id: "c", name: "Chief", role: "ceo", title: "Chief", icon: null, status: "active", reportsTo: null } as Agent,
  { id: "a", name: "Writer", role: "engineer", title: null, icon: "pen", status: "running", reportsTo: "c" } as Agent,
];
const agentRows: AgentRow[] = agents.map((a) => ({ id: a.id, name: a.name, role: a.role, title: a.title, reportsTo: a.reportsTo, status: a.status }));
const issueRows: IssueRow[] = [
  { id: "i1", identifier: "SHO-1", title: "Draft", status: "in_progress", assigneeAgentId: "a", parentId: null, updatedAt: "2026-09-28T11:00:00Z" },
  { id: "i2", identifier: "SHO-2", title: "Old", status: "done", assigneeAgentId: "a", parentId: null, updatedAt: "2026-09-27T11:00:00Z" },
];
const runs: RunRow[] = [{ agentId: "a", runId: "r1", status: "running", startedAt: null, finishedAt: null, lastOutputAt: null, excerpt: null }];

function fakeCtx(runRows: Record<string, unknown>[]): PluginContext {
  return { db: { query: async () => runRows } } as unknown as PluginContext;
}

describe("loadAgentDetail", () => {
  it("resolves manager, reports, open/done issues, and recent runs for the target agent", async () => {
    const detail = await loadAgentDetail(
      fakeCtx([{ id: "r1", status: "running", started_at: null, finished_at: null, last_output_at: null, invocation_source: "heartbeat", error: null, stdout_excerpt: "hello" }]),
      "co1",
      "a",
      agents,
      agentRows,
      issueRows,
      runs,
      10,
    );
    expect(detail.agent.icon).toBe("pen");
    expect(detail.manager?.name).toBe("Chief");
    expect(detail.openIssues.map((i) => i.identifier)).toEqual(["SHO-1"]);
    expect(detail.doneIssues.map((i) => i.identifier)).toEqual(["SHO-2"]);
    expect(detail.runs[0].stdoutExcerpt).toBe("hello");
  });

  it("throws for an unknown agent", async () => {
    await expect(loadAgentDetail(fakeCtx([]), "co1", "missing", agents, agentRows, issueRows, runs, 10)).rejects.toThrow();
  });
});
