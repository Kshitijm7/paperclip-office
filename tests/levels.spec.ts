import { describe, expect, it } from "vitest";
import { computeLevels } from "../src/shared/levels.js";
import type { AgentRow, IssueRow } from "../src/shared/office.js";

const agents: AgentRow[] = [
  { id: "chief", name: "Chief", role: "ceo", title: "Chief", reportsTo: null, status: "active" },
  { id: "director", name: "Director", role: "lead", title: null, reportsTo: "chief", status: "active" },
  { id: "lead", name: "Lead", role: "lead", title: null, reportsTo: "director", status: "active" },
  { id: "senior", name: "Senior", role: "engineer", title: null, reportsTo: "lead", status: "active" },
  { id: "member1", name: "Member1", role: "engineer", title: null, reportsTo: "lead", status: "active" },
  { id: "member2", name: "Member2", role: "engineer", title: null, reportsTo: "lead", status: "active" },
];

function done(id: string, assignee: string): IssueRow {
  return { id, identifier: id, title: id, status: "done", assigneeAgentId: assignee, parentId: null, updatedAt: "2026-09-28T00:00:00Z" };
}

describe("computeLevels", () => {
  it("assigns Chief, Director, Lead by org shape", () => {
    const levels = computeLevels(agents, []);
    expect(levels.get("chief")?.levelName).toBe("Chief");
    expect(levels.get("director")?.levelName).toBe("Director");
    expect(levels.get("lead")?.levelName).toBe("Lead");
    expect(levels.get("lead")?.reportsCount).toBe(3);
  });

  it("promotes the leaf with the most closed issues to Senior", () => {
    const issues = [done("i1", "senior"), done("i2", "senior"), done("i3", "senior")];
    const levels = computeLevels(agents, issues);
    expect(levels.get("senior")?.levelName).toBe("Senior");
    expect(levels.get("member1")?.levelName).toBe("Member");
    expect(levels.get("member2")?.levelName).toBe("Member");
  });

  it("leaves leaves as Member when nobody has closed issues", () => {
    const levels = computeLevels(agents, []);
    expect(levels.get("senior")?.levelName).toBe("Member");
  });

  it("gives every agent a numeric level consistent with its name", () => {
    const levels = computeLevels(agents, []);
    expect(levels.get("chief")?.level).toBe(5);
    expect(levels.get("director")?.level).toBe(4);
    expect(levels.get("lead")?.level).toBe(3);
    expect(levels.get("member1")?.level).toBe(1);
  });
});
