import { describe, expect, it } from "vitest";
import { buildOffice, diffHandoffs, type AgentRow, type IssueRow, type RunRow } from "../src/shared/office.js";
import { toSceneAgents } from "../src/ui/scene-bridge.js";

const now = new Date("2026-09-28T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();

const agents: AgentRow[] = [
  { id: "c", name: "Chief", role: "ceo", title: "Chief", reportsTo: null, status: "active" },
  { id: "a", name: "Writer", role: "engineer", title: null, reportsTo: "c", status: "running" },
  { id: "b", name: "Editor", role: "engineer", title: null, reportsTo: "c", status: "idle" },
  { id: "d", name: "Stalled", role: "engineer", title: null, reportsTo: "c", status: "running" },
  { id: "e", name: "Waiting", role: "engineer", title: null, reportsTo: "c", status: "idle" },
];
const runs: RunRow[] = [
  { agentId: "a", runId: "r1", status: "running", startedAt: ago(3), finishedAt: null, lastOutputAt: ago(1), excerpt: "Editing src/app.ts" },
  { agentId: "d", runId: "r2", status: "running", startedAt: ago(30), finishedAt: null, lastOutputAt: ago(25), excerpt: null },
  { agentId: "c", runId: "r3", status: "queued", startedAt: null, finishedAt: null, lastOutputAt: null, excerpt: null },
];
const issues: IssueRow[] = [
  { id: "i1", identifier: "SHO-1", title: "Draft", status: "in_progress", assigneeAgentId: "a", parentId: null, updatedAt: ago(2) },
  { id: "i2", identifier: "SHO-2", title: "Review", status: "blocked", assigneeAgentId: "e", parentId: null, updatedAt: ago(5) },
];

describe("buildOffice", () => {
  const office = buildOffice(agents, runs, issues, now, 10);
  const byId = Object.fromEntries(office.agents.map((a) => [a.id, a]));

  it("maps runs and issues to states", () => {
    expect(byId.a.state).toBe("working");
    expect(byId.c.state).toBe("thinking");
    expect(byId.b.state).toBe("idle");
    expect(byId.e.state).toBe("blocked");
  });

  it("flags a run with no output past the threshold as stuck", () => {
    expect(byId.d.stuck).toBe(true);
    expect(byId.d.stuckReason).toBe("no output for 25 min");
    expect(byId.a.stuck).toBe(false);
  });

  it("uses the last excerpt line as the thought and the top of the org as chief", () => {
    expect(byId.a.thought).toBe("Editing src/app.ts");
    expect(byId.c.isChief).toBe(true);
  });

  it("places the same company identically every time", () => {
    const shuffled = buildOffice([...agents].reverse(), runs, issues, now, 10);
    expect(toSceneAgents(shuffled).map((a) => [a.id, a.character])).toEqual(
      toSceneAgents(office).map((a) => [a.id, a.character]),
    );
  });
});

describe("diffHandoffs", () => {
  it("emits an envelope on reassignment and on a new child issue", () => {
    const next: IssueRow[] = [
      { ...issues[0], assigneeAgentId: "b" },
      issues[1],
      { id: "i3", identifier: "SHO-3", title: "Sub", status: "todo", assigneeAgentId: "d", parentId: "i1", updatedAt: ago(0) },
    ];
    expect(diffHandoffs(issues, next, now).map((h) => `${h.from}>${h.to}`)).toEqual(["a>b", "b>d"]);
    expect(diffHandoffs(undefined, next, now)).toEqual([]);
  });
});
