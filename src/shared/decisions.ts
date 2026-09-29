export const DECISIONS_DATA_KEY = "decisions";
export const DECIDE_APPROVAL_ACTION = "decideApproval";
export const RESPOND_DECISION_ACTION = "respondDecision";

export type ApprovalDecisionKind = "approval";
export type InteractionDecisionKind = "suggest_tasks" | "ask_user_questions" | "request_confirmation" | "request_checkbox_confirmation";
export type DecisionKind = ApprovalDecisionKind | InteractionDecisionKind;

/** Kinds the box can resolve with a plain accept/reject click; the rest link out to answer in the issue thread. */
export const RESOLVABLE_INTERACTION_KINDS = new Set<InteractionDecisionKind>(["request_confirmation", "request_checkbox_confirmation"]);

export interface DecisionApprovalRow {
  id: string;
  type: string;
  requestedByAgentId: string | null;
  status: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
}

export interface DecisionInteractionRow {
  id: string;
  issueId: string;
  kind: InteractionDecisionKind;
  status: string;
  title: string | null;
  summary: string | null;
  createdByAgentId: string | null;
  createdAt: string;
  payload?: Record<string, unknown> | null;
}

export interface DecisionIssueLabel {
  label: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  assigneeAgentId?: string | null;
}

export interface DecisionAgent {
  name: string;
  role: string | null;
}

export interface DecisionItem {
  id: string;
  kind: DecisionKind;
  /** approvalId for kind "approval", interactionId for the rest. */
  targetId: string;
  issueId: string | null;
  issueLabel: string | null;
  issueTitle: string | null;
  title: string;
  summary: string;
  requester: string | null;
  createdAt: string;
  resolvable: boolean;
  link: string;
  /** The agent's full question or request, markdown. */
  details: string;
  acceptLabel: string | null;
  rejectLabel: string | null;
  allowReason: boolean;
  requesterRole: string | null;
  issueStatus: string | null;
  issuePriority: string | null;
  assignee: string | null;
  facts: Array<[string, string]>;
}

type Agents = Map<string, DecisionAgent>;

function agentName(agents: Agents, id: string | null | undefined): string | null {
  if (!id) return null;
  return agents.get(id)?.name ?? id;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function humanize(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Flat scalar fields of an approval payload, shown as label/value pairs. */
export function payloadFacts(payload: Record<string, unknown> | null | undefined, skip: string[] = []): Array<[string, string]> {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(([k, v]) => !skip.includes(k) && ["string", "number", "boolean"].includes(typeof v) && String(v).length <= 200)
    .map(([k, v]) => [humanize(k), String(v)]);
}

const APPROVAL_TITLES: Record<string, string> = {
  hire_agent: "Hire agent",
  spend: "Spend approval",
};

/** Pure: normalize one pending approval into a decision item. */
export function summarizeApproval(approval: DecisionApprovalRow, agentNames: Agents): DecisionItem {
  return {
    id: `approval-${approval.id}`,
    kind: "approval",
    targetId: approval.id,
    issueId: null,
    issueLabel: null,
    issueTitle: null,
    title: APPROVAL_TITLES[approval.type] ?? approval.type,
    summary: text(approval.payload?.reason) ?? text(approval.payload?.summary) ?? `${humanize(approval.type)} requested`,
    requester: agentName(agentNames, approval.requestedByAgentId),
    createdAt: approval.createdAt,
    resolvable: true,
    // Approvals have no per-item detail route in this app; the inbox is where a human reviews them.
    link: "/inbox",
    details: text(approval.payload?.description) ?? "",
    acceptLabel: null,
    rejectLabel: null,
    allowReason: true,
    requesterRole: approval.requestedByAgentId ? agentNames.get(approval.requestedByAgentId)?.role ?? null : null,
    issueStatus: null,
    issuePriority: null,
    assignee: null,
    facts: payloadFacts(approval.payload, ["reason", "summary", "description"]),
  };
}

/** Pure: normalize one pending issue-thread interaction (decision card) into a decision item. */
export function summarizeInteraction(
  interaction: DecisionInteractionRow,
  issue: DecisionIssueLabel,
  agentNames: Agents,
): DecisionItem {
  const p = interaction.payload ?? {};
  return {
    id: `interaction-${interaction.id}`,
    kind: interaction.kind,
    targetId: interaction.id,
    issueId: interaction.issueId,
    issueLabel: issue.label,
    issueTitle: issue.title,
    title: interaction.title ?? issue.title,
    summary: interaction.summary ?? "",
    requester: agentName(agentNames, interaction.createdByAgentId),
    createdAt: interaction.createdAt,
    resolvable: RESOLVABLE_INTERACTION_KINDS.has(interaction.kind),
    link: `/issues/${issue.label}`,
    details: text(p.prompt) ?? text(p.description) ?? "",
    acceptLabel: text(p.acceptLabel),
    rejectLabel: text(p.rejectLabel),
    allowReason: p.allowDeclineReason !== false,
    requesterRole: interaction.createdByAgentId ? agentNames.get(interaction.createdByAgentId)?.role ?? null : null,
    issueStatus: issue.status ?? null,
    issuePriority: issue.priority ?? null,
    assignee: agentName(agentNames, issue.assigneeAgentId),
    facts: [],
  };
}

export interface BuildDecisionsParams {
  approvals: DecisionApprovalRow[];
  interactions: Array<{ row: DecisionInteractionRow; issue: DecisionIssueLabel }>;
  agentNames: Agents;
}

/** Pure merge of pending approvals and pending issue interactions into one oldest-first queue. */
export function buildDecisions(params: BuildDecisionsParams): DecisionItem[] {
  const items: DecisionItem[] = [
    ...params.approvals
      .filter((a) => a.status === "pending")
      .map((a) => summarizeApproval(a, params.agentNames)),
    ...params.interactions
      .filter((i) => i.row.status === "pending")
      .map((i) => summarizeInteraction(i.row, i.issue, params.agentNames)),
  ];
  items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return items;
}

export interface DecisionActor {
  type: "user" | "agent" | "system";
  userId: string | null;
}

/** Only a paired board user may decide on the human's behalf; agents and system callers are refused. */
export function requireUserActor(actor: DecisionActor): string {
  if (actor.type !== "user" || !actor.userId) {
    throw new Error("Only a signed-in user can decide this. Refused: caller is not a user.");
  }
  return actor.userId;
}
