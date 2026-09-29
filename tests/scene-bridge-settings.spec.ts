import { describe, expect, it } from "vitest";
import { buildOffice, type AgentRow, type IssueRow, type RunRow } from "../src/shared/office.js";
import { DEFAULTS } from "../src/shared/settings.js";
import { toSceneAgents } from "../src/ui/scene-bridge.js";

const now = new Date("2026-09-28T12:00:00Z");

const agents: AgentRow[] = [
  { id: "c", name: "Chief", role: "ceo", title: "Chief", reportsTo: null, status: "active" },
  { id: "a", name: "Idle One", role: "engineer", title: null, reportsTo: "c", status: "idle" },
  { id: "b", name: "Idle Two", role: "engineer", title: null, reportsTo: "c", status: "idle" },
  { id: "d", name: "Working", role: "engineer", title: null, reportsTo: "c", status: "running" },
];
const runs: RunRow[] = [
  { agentId: "d", runId: "r1", status: "running", startedAt: now.toISOString(), finishedAt: null, lastOutputAt: now.toISOString(), excerpt: "Editing file.ts" },
];
const issues: IssueRow[] = [
  { id: "i1", identifier: "SHO-1", title: "Ship it", status: "in_progress", assigneeAgentId: "d", parentId: null, updatedAt: now.toISOString() },
];

function officeWith(idleRoaming: (typeof DEFAULTS)["idleRoaming"]) {
  return buildOffice(agents, runs, issues, now, 10, { ...DEFAULTS, idleRoaming });
}

describe("toSceneAgents idleRoaming", () => {
  it("lively leaves idle agents roaming", () => {
    const scene = toSceneAgents(officeWith("lively"), { ...DEFAULTS, idleRoaming: "lively" });
    expect(scene.find((s) => s.id === "a")?.status).toBe("idle");
    expect(scene.find((s) => s.id === "b")?.status).toBe("idle");
  });

  it("off seats every idle agent at their desk", () => {
    const scene = toSceneAgents(officeWith("off"), { ...DEFAULTS, idleRoaming: "off" });
    expect(scene.find((s) => s.id === "a")?.status).toBe("waiting");
    expect(scene.find((s) => s.id === "b")?.status).toBe("waiting");
  });

  it("calm seats a deterministic half of idle agents, same result every call", () => {
    const settings = { ...DEFAULTS, idleRoaming: "calm" as const };
    const office = officeWith("calm");
    const first = toSceneAgents(office, settings).map((s) => [s.id, s.status]);
    const second = toSceneAgents(office, settings).map((s) => [s.id, s.status]);
    expect(first).toEqual(second);
    const idleStatuses = first.filter(([id]) => id === "a" || id === "b").map(([, status]) => status);
    expect(idleStatuses.every((s) => s === "waiting" || s === "idle")).toBe(true);
  });
});

describe("toSceneAgents bubbles", () => {
  const office = buildOffice(agents, runs, issues, now, 10, DEFAULTS);

  it("activity (default) shows the thought or the issue", () => {
    const scene = toSceneAgents(office, { ...DEFAULTS, bubbles: "activity" });
    expect(scene.find((s) => s.id === "d")?.action).toBe("Editing file.ts");
  });

  it("issue shows the issue label and title, not the thought", () => {
    const scene = toSceneAgents(office, { ...DEFAULTS, bubbles: "issue" });
    expect(scene.find((s) => s.id === "d")?.action).toBe("SHO-1 Ship it");
  });

  it("output shows only the thought", () => {
    const scene = toSceneAgents(office, { ...DEFAULTS, bubbles: "output" });
    expect(scene.find((s) => s.id === "d")?.action).toBe("Editing file.ts");
    expect(scene.find((s) => s.id === "a")?.action).toBe("");
  });

  it("none blanks every bubble", () => {
    const scene = toSceneAgents(office, { ...DEFAULTS, bubbles: "none" });
    expect(scene.every((s) => s.action === "" && s.lastPrompt === undefined)).toBe(true);
  });
});

describe("toSceneAgents roleAttire", () => {
  const office = buildOffice(agents, runs, issues, now, 10, DEFAULTS);

  it("picks an outfit from the role's category when on", () => {
    const scene = toSceneAgents(office, { ...DEFAULTS, roleAttire: true });
    // every "engineer" role agent should land on a character from the engineer cast
    for (const id of ["a", "b", "d"]) {
      expect(["kevin", "andy"]).toContain(scene.find((s) => s.id === id)?.character);
    }
  });

  it("is deterministic for the same company", () => {
    const first = toSceneAgents(office, { ...DEFAULTS, roleAttire: true }).map((s) => s.character);
    const second = toSceneAgents(office, { ...DEFAULTS, roleAttire: true }).map((s) => s.character);
    expect(first).toEqual(second);
  });

  it("off falls back to round-robin cast assignment", () => {
    const scene = toSceneAgents(office, { ...DEFAULTS, roleAttire: false });
    expect(scene.find((s) => s.id === "a")?.character).not.toBe(undefined);
  });
});
