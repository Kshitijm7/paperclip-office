import { describe, expect, it } from "vitest";
import { buildFleetHealth, formatFleetHealth, type FleetRun } from "../src/worker/fleet-health.js";

const NOW = new Date("2026-09-30T12:00:00Z");
const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const run = (agentId: string, cached: number, secs: number, wakeReason: string | null = null): FleetRun => ({
  agentId, startedAt: at(30), finishedAt: new Date(Date.parse(at(30)) + secs * 1000).toISOString(), cachedInputTokens: cached, costUsd: cached / 1_000_000, wakeReason,
});

const agents = [
  { id: "p", name: "Platform", status: "running", runtimeConfig: { heartbeat: { sessionCompaction: { enabled: true } } } },
  { id: "q", name: "QA", status: "error", runtimeConfig: { heartbeat: {} } },
  { id: "x", name: "Old", status: "terminated", runtimeConfig: {} },
];

describe("fleet health", () => {
  const runs = [run("p", 142_000_000, 600), run("p", 2_000_000, 40, "issue_monitor_due"), run("q", 10_000_000, 30, "issue_continuation_needed")];
  const issues = [
    { title: "Courier: hand MYS-1 to QA", status: "done", createdAt: at(60) },
    { title: "Courier: MYS-2", status: "todo", createdAt: at(120) },
    { title: "Courier: ancient", status: "done", createdAt: at(60 * 48) },
    { title: "Fix login", status: "todo", createdAt: at(10) },
  ];
  const approvals = [{ id: "a1", type: "hire_agent", createdAt: at(466 * 60) }, { id: "a2", type: "approve_plan", createdAt: at(60) }];
  const h = buildFleetHealth(runs, agents, issues, approvals, NOW);

  it("ranks spenders by cached tokens per run and flags replaying sessions", () => {
    expect(h.spenders[0]).toMatchObject({ agentId: "p", runs: 2, maxCached: 142_000_000 });
    expect(formatFleetHealth(h, (id) => id).join("\n")).toContain("latest run replayed too much history");
  });

  it("counts short runs and wake reasons per agent", () => {
    expect(h.churn.find((c) => c.agentId === "p")).toMatchObject({ short: 1, monitorDue: 1, continuation: 0 });
    expect(h.churn.find((c) => c.agentId === "q")).toMatchObject({ short: 1, continuation: 1 });
  });

  it("lists agents in error, agents missing rotation, relay issues and the oldest approvals", () => {
    expect(h.inError).toEqual(["q"]);
    expect(h.missingRotation).toEqual(["q"]);
    expect(h.relay).toEqual({ total: 2, open: 1 });
    expect(h.oldestApprovals[0]).toEqual({ id: "a1", type: "hire_agent", ageHours: 466 });
  });
});
