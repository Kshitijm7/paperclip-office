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
}

export interface DecisionIssueLabel {
  label: string;
  title: string;
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
}

function agentName(names: Map<string, string>, id: string | null): string | null {
  if (!id) return null;
  return names.get(id) ?? id;
}

const APPROVAL_TITLES: Record<string, string> = {
  hire_agent: "Hire agent",
  spend: "Spend approval",
};

/** Pure: normalize one pending approval into a decision item. */
export function summarizeApproval(approval: DecisionApprovalRow, agentNames: Map<string, string>): DecisionItem {
  return {
    id: `approval-${approval.id}`,
    kind: "approval",
    targetId: approval.id,
    issueId: null,
    issueLabel: null,
    issueTitle: null,
    title: APPROVAL_TITLES[approval.type] ?? approval.type,
    summary: `${approval.type} requested`,
    requester: agentName(agentNames, approval.requestedByAgentId),
    createdAt: approval.createdAt,
    resolvable: true,
    // Approvals have no per-item detail route in this app; the inbox is where a human reviews them.
    link: "/inbox",
  };
}

/** Pure: normalize one pending issue-thread interaction (decision card) into a decision item. */
export function summarizeInteraction(
  interaction: DecisionInteractionRow,
  issue: DecisionIssueLabel,
  agentNames: Map<string, string>,
): DecisionItem {
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
  };
}

export interface BuildDecisionsParams {
  approvals: DecisionApprovalRow[];
  interactions: Array<{ row: DecisionInteractionRow; issue: DecisionIssueLabel }>;
  agentNames: Map<string, string>;
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
