import type { OfficeAgent, OfficeData } from "../src/shared/office.js";
import type { DecisionItem } from "../src/shared/decisions.js";
import type { ActivityEvent } from "../src/shared/activity.js";
import type { AgentDetail } from "../src/worker/agent-detail.js";
import type { RecognitionData, AgentStats } from "../src/worker/recognition.js";
import type { EffectiveLayout } from "../src/shared/layout.js";
import { DEFAULTS } from "../src/shared/settings.js";
import { LAYOUT_PRESETS } from "../src/layout/presets.js";

export const COMPANY_ID = "demo-northwind";
export const COMPANY_PREFIX = "NWR";

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();

interface Seed {
  id: string;
  name: string;
  role: string | null;
  title: string | null;
  reportsTo: string | null;
  department: string;
  isChief?: boolean;
  state: OfficeAgent["state"];
  stuck?: boolean;
  stuckReason?: string | null;
  sinceMin?: number;
  issue?: { id: string; label: string; title: string; status: string } | null;
  thought?: string | null;
  levelName: OfficeAgent["levelName"];
  level: number;
  reportsCount?: number;
  progress?: number | null;
  queueDepth?: number;
  oldestWaitMinutes?: number | null;
  costTodayCents?: number;
  tokensToday?: number;
  overBudget?: boolean;
  productivity?: number;
  efficiency?: number;
  flag?: string | null;
}

const seeds: Seed[] = [
  { id: "ceo", name: "Priya Kapoor", role: "chief", title: "CEO", reportsTo: null, department: "Chief", isChief: true, state: "thinking", thought: "Reviewing Q3 roadmap priorities", levelName: "Chief", level: 5, reportsCount: 4, productivity: 82, efficiency: 90 },

  { id: "eng-lead", name: "Marcus Webb", role: "lead", title: "Engineering Lead", reportsTo: "ceo", department: "Engineering", state: "working", thought: "Reviewing PR for OAuth login", issue: { id: "i1", label: "NWR-101", title: "Add OAuth login", status: "in_progress" }, levelName: "Director", level: 4, reportsCount: 5, progress: 0.6, queueDepth: 3, oldestWaitMinutes: 220, productivity: 78, efficiency: 64 },
  { id: "eng-1", name: "Sara Chen", role: "member", title: "Backend Engineer", reportsTo: "eng-lead", department: "Engineering", state: "working", thought: "Writing integration tests for auth flow", issue: { id: "i1", label: "NWR-101", title: "Add OAuth login", status: "in_progress" }, levelName: "Senior", level: 2, progress: 0.4, queueDepth: 2, costTodayCents: 340, tokensToday: 182_000, productivity: 62, efficiency: 71 },
  { id: "eng-2", name: "Devon Ruiz", role: "member", title: "Frontend Engineer", reportsTo: "eng-lead", department: "Engineering", state: "thinking", thought: "Planning checkout test fix", issue: { id: "i2", label: "NWR-102", title: "Fix flaky checkout test", status: "in_progress" }, levelName: "Member", level: 1, queueDepth: 1, productivity: 45, efficiency: 58 },
  { id: "eng-3", name: "Amara Osei", role: "member", title: "Backend Engineer", reportsTo: "eng-lead", department: "Engineering", state: "blocked", thought: "Waiting on API key approval", issue: { id: "i3", label: "NWR-103", title: "Rate limit the webhook endpoint", status: "blocked" }, levelName: "Member", level: 1, queueDepth: 2, oldestWaitMinutes: 340, productivity: 30, efficiency: 25, flag: "blocked on approval" },
  { id: "eng-4", name: "Liam Foster", role: "member", title: "Platform Engineer", reportsTo: "eng-lead", department: "Engineering", state: "working", thought: "Migrating queue workers to v2", issue: { id: "i4", label: "NWR-104", title: "Migrate job queue to v2", status: "in_progress" }, levelName: "Senior", level: 2, progress: 0.85, costTodayCents: 512, tokensToday: 260_000, productivity: 100, efficiency: 88 },
  { id: "eng-5", name: "Nadia Hassan", role: "member", title: "Backend Engineer", reportsTo: "eng-lead", department: "Engineering", state: "idle", levelName: "Member", level: 1, queueDepth: 4, productivity: 12, efficiency: 0, flag: "idle with work waiting" },

  { id: "design-lead", name: "Oliver Grant", role: "lead", title: "Design Lead", reportsTo: "ceo", department: "Design", state: "working", thought: "Polishing onboarding flow mockups", issue: { id: "i5", label: "NWR-105", title: "Redesign onboarding flow", status: "in_progress" }, levelName: "Lead", level: 3, reportsCount: 2, progress: 0.3, queueDepth: 2, productivity: 70, efficiency: 66 },
  { id: "design-1", name: "Ines Moreau", role: "member", title: "Product Designer", reportsTo: "design-lead", department: "Design", state: "thinking", thought: "Exploring empty-state illustrations", levelName: "Member", level: 1, productivity: 40, efficiency: 55 },
  { id: "design-2", name: "Tariq Ahmed", role: "member", title: "Product Designer", reportsTo: "design-lead", department: "Design", state: "idle", levelName: "Member", level: 1, productivity: 18, efficiency: 0 },

  { id: "qa-lead", name: "Hana Suzuki", role: "lead", title: "QA Lead", reportsTo: "ceo", department: "QA", state: "blocked", thought: "Blocked on staging environment reset", issue: { id: "i6", label: "NWR-106", title: "Stabilize staging environment", status: "blocked" }, levelName: "Lead", level: 3, reportsCount: 2, queueDepth: 4, oldestWaitMinutes: 500, productivity: 60, efficiency: 30, flag: "blocked on NWR-106" },
  { id: "qa-1", name: "Bruno Alves", role: "member", title: "QA Engineer", reportsTo: "qa-lead", department: "QA", state: "working", thought: "Running regression suite on checkout", issue: { id: "i2", label: "NWR-102", title: "Fix flaky checkout test", status: "in_progress" }, levelName: "Senior", level: 2, progress: 0.7, productivity: 66, efficiency: 74 },
  { id: "qa-2", name: "Grace Lindqvist", role: "member", title: "QA Engineer", reportsTo: "qa-lead", department: "QA", state: "working", thought: "no output for 42 min", stuck: true, stuckReason: "no output for 42 min", issue: { id: "i7", label: "NWR-107", title: "Add e2e coverage for billing", status: "in_progress" }, sinceMin: 42, levelName: "Member", level: 1, queueDepth: 1, productivity: 55, efficiency: 20, flag: "no output for 42 min" },

  { id: "growth-lead", name: "Felix Bauer", role: "lead", title: "Growth Lead", reportsTo: "ceo", department: "Growth", state: "thinking", thought: "Drafting referral program brief", levelName: "Lead", level: 3, reportsCount: 2, queueDepth: 1, productivity: 48, efficiency: 52 },
  { id: "growth-1", name: "Yuki Tanaka", role: "member", title: "Growth Marketer", reportsTo: "growth-lead", department: "Growth", state: "idle", levelName: "Member", level: 1, productivity: 22, efficiency: 0 },
  { id: "growth-2", name: "Carla Mendes", role: "member", title: "Lifecycle Marketer", reportsTo: "growth-lead", department: "Growth", state: "idle", levelName: "Member", level: 1, productivity: 15, efficiency: 0 },
];

function buildAgent(s: Seed): OfficeAgent {
  return {
    id: s.id,
    needsApproval: false,
    name: s.name,
    role: s.role,
    title: s.title,
    reportsTo: s.reportsTo,
    managerId: s.reportsTo,
    department: s.department,
    isChief: !!s.isChief,
    state: s.state,
    stuck: !!s.stuck,
    stuckReason: s.stuckReason ?? null,
    since: s.sinceMin !== undefined ? minsAgo(s.sinceMin) : s.state === "idle" ? null : minsAgo(8),
    issue: s.issue ?? null,
    runId: s.state === "idle" ? null : `run-${s.id}`,
    thought: s.thought ?? null,
    justFinished: false,
    level: s.level,
    levelName: s.levelName,
    reportsCount: s.reportsCount ?? 0,
    progress: s.progress ?? null,
    queueDepth: s.queueDepth ?? 0,
    oldestWaitMinutes: s.oldestWaitMinutes ?? null,
    costCents: (s.costTodayCents ?? 0) * 6,
    costTodayCents: s.costTodayCents ?? 0,
    tokens: (s.tokensToday ?? 0) * 6,
    tokensToday: s.tokensToday ?? 0,
    overBudget: !!s.overBudget,
    scores: { productivity: s.productivity ?? 0, efficiency: s.efficiency ?? 0, flag: s.flag ?? null, lastCheckedAt: minsAgo(2) },
  };
}

export const AGENTS: OfficeAgent[] = seeds.map(buildAgent);

const layoutSpec = LAYOUT_PRESETS[0].spec;
export const LAYOUT: EffectiveLayout = {
  theme: "free",
  preset: "departments",
  spec: layoutSpec,
  presets: LAYOUT_PRESETS.map((p) => ({ id: p.id, label: p.label })),
  agent: null,
  request: null,
};

export const OFFICE_DATA: OfficeData = {
  generatedAt: new Date(now).toISOString(),
  stuckMinutes: 10,
  agents: AGENTS,
  tasks: AGENTS.filter((a) => a.issue).map((a) => ({
    id: a.issue!.id,
    status: a.issue!.status === "done" ? "done" : a.issue!.status === "blocked" ? "blocked" : a.issue!.status === "todo" ? "todo" : "doing",
    assignee: a.id,
  })),
  handoffs: [
    { from: "eng-lead", to: "eng-1", issue: "NWR-101", at: minsAgo(3) },
    { from: "design-lead", to: "design-1", issue: "NWR-105", at: minsAgo(9) },
  ],
  approvals: [],
  settings: { ...DEFAULTS, theme: "free" },
  budgetIncidents: [
    { id: "b1", scopeType: "agent", scopeId: "qa-2", scopeName: "Grace Lindqvist", metric: "tokens_per_day", amountLimit: 500_000, amountObserved: 612_000, status: "open" },
  ],
  layout: LAYOUT,
};

export const DECISIONS: DecisionItem[] = [
  {
    id: "interaction-1",
    kind: "request_confirmation",
    targetId: "interaction-1",
    issueId: "i4",
    issueLabel: "NWR-104",
    issueTitle: "Migrate job queue to v2",
    title: "Cut over the job queue now?",
    summary: "The new queue has run in shadow mode for 48 hours with no errors.",
    requester: "Liam Foster",
    createdAt: minsAgo(14),
    resolvable: true,
    link: "/issues/NWR-104",
    details:
      "Shadow mode has processed 1.2M jobs on the v2 queue with zero failed deliveries and p99 latency down 35%. I'd like to flip the primary flag and retire the old workers this afternoon.\n\nRolling back means re-enabling the old workers, which are still warm, so this is low risk.",
    acceptLabel: "Cut over now",
    rejectLabel: "Wait another day",
    allowReason: true,
    requesterRole: "member",
    issueStatus: "in_progress",
    issuePriority: "high",
    assignee: "Liam Foster",
    facts: [],
  },
  {
    id: "approval-1",
    kind: "approval",
    targetId: "approval-1",
    issueId: null,
    issueLabel: null,
    issueTitle: null,
    title: "Hire agent",
    summary: "Add a second QA engineer to unblock the regression backlog.",
    requester: "Hana Suzuki",
    createdAt: minsAgo(38),
    resolvable: true,
    link: "/inbox",
    details: "",
    acceptLabel: null,
    rejectLabel: null,
    allowReason: true,
    requesterRole: "lead",
    issueStatus: null,
    issuePriority: null,
    assignee: null,
    facts: [
      ["Role", "QA Engineer"],
      ["Department", "QA"],
      ["Monthly budget", "$400"],
      ["Reports to", "Hana Suzuki"],
    ],
  },
  {
    id: "interaction-2",
    kind: "ask_user_questions",
    targetId: "interaction-2",
    issueId: "i5",
    issueLabel: "NWR-105",
    issueTitle: "Redesign onboarding flow",
    title: "Two questions before I continue",
    summary: "Need direction on copy tone and whether to keep the progress bar.",
    requester: "Oliver Grant",
    createdAt: minsAgo(70),
    resolvable: false,
    link: "/issues/NWR-105",
    details:
      "1. Should onboarding copy stay formal (current) or shift to a friendlier tone, matching the new marketing site?\n2. The current flow shows a 4-step progress bar. Keep it, or switch to a single continuous scroll like the Figma exploration in the issue?",
    acceptLabel: null,
    rejectLabel: null,
    allowReason: false,
    requesterRole: "lead",
    issueStatus: "in_progress",
    issuePriority: "medium",
    assignee: "Oliver Grant",
    facts: [],
  },
];

export const ACTIVITY: ActivityEvent[] = [
  { id: "a1", type: "run_finished", at: minsAgo(2), agentId: "eng-4", agentName: "Liam Foster", issueId: "i4", issueLabel: "NWR-104", text: "run finished" },
  { id: "a2", type: "comment_posted", at: minsAgo(5), agentId: "eng-1", agentName: "Sara Chen", issueId: "i1", issueLabel: "NWR-101", text: "commented on NWR-101" },
  { id: "a3", type: "issue_status_changed", at: minsAgo(11), agentId: null, agentName: null, issueId: "i2", issueLabel: "NWR-102", text: "NWR-102 updated to in_progress" },
  { id: "a4", type: "approval_requested", at: minsAgo(38), agentId: "qa-lead", agentName: "Hana Suzuki", issueId: null, issueLabel: null, text: "hire_agent approval requested" },
  { id: "a5", type: "run_failed", at: minsAgo(55), agentId: "qa-2", agentName: "Grace Lindqvist", issueId: null, issueLabel: null, text: "run failed" },
  { id: "a6", type: "issue_created", at: minsAgo(90), agentId: null, agentName: null, issueId: "i7", issueLabel: "NWR-107", text: "NWR-107 created: Add e2e coverage for billing" },
  { id: "a7", type: "run_started", at: minsAgo(95), agentId: "design-1", agentName: "Ines Moreau", issueId: null, issueLabel: null, text: "run started" },
];

function statFor(id: string, closed: number, succeeded: number, failed: number): AgentStats {
  const a = AGENTS.find((x) => x.id === id)!;
  return { agentId: id, name: a.name, department: a.department, closed, succeeded, failed, handoffsSent: 0, score: closed * 3 + succeeded - failed };
}

export const RECOGNITION: RecognitionData = {
  generatedAt: new Date(now).toISOString(),
  employeeOfWeek: statFor("eng-4", 6, 14, 1),
  employeeOfMonth: statFor("eng-lead", 21, 48, 3),
  leaderboard: [statFor("eng-4", 6, 14, 1), statFor("qa-1", 5, 11, 2), statFor("eng-1", 4, 9, 0), statFor("design-lead", 3, 7, 1), statFor("qa-lead", 2, 5, 0)],
  mostReliable: { agentId: "eng-4", name: "Liam Foster", successRate: 0.93, runs: 42 },
  byDepartment: [statFor("eng-lead", 21, 48, 3), statFor("design-lead", 8, 19, 1), statFor("qa-lead", 11, 22, 4), statFor("growth-lead", 3, 6, 0)],
};

export function agentDetail(agentId: string): AgentDetail {
  const office = AGENTS.find((a) => a.id === agentId) ?? AGENTS[0];
  const seed = seeds.find((s) => s.id === office.id)!;
  const manager = seed.reportsTo ? AGENTS.find((a) => a.id === seed.reportsTo) ?? null : null;
  const reports = AGENTS.filter((a) => a.reportsTo === office.id).map((a) => ({ id: a.id, name: a.name }));
  return {
    agent: { id: office.id, name: office.name, role: office.role, title: office.title, status: office.state === "idle" ? "active" : "active", icon: null },
    office,
    manager: manager ? { id: manager.id, name: manager.name } : null,
    reports,
    openIssues: office.issue ? [{ id: office.issue.id, identifier: office.issue.label, title: office.issue.title, status: office.issue.status }] : [],
    doneIssues: [{ id: "done-1", identifier: `${COMPANY_PREFIX}-090`, title: "Set up CI pipeline", status: "done" }],
    runs: office.state === "idle"
      ? []
      : [
          {
            runId: `run-${office.id}`,
            status: office.stuck ? "running" : "running",
            startedAt: minsAgo(seed.sinceMin ?? 8),
            finishedAt: null,
            lastOutputAt: office.state === "working" ? minsAgo(1) : null,
            invocationSource: "issue",
            error: null,
            stdoutExcerpt: office.thought ?? "Working…",
          },
        ],
    cost: office.costTodayCents > 0 ? "auto" : null,
  };
}
