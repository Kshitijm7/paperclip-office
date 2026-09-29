export const ACTIVITY_DATA_KEY = "activity";

export type ActivityType =
  | "run_started"
  | "run_finished"
  | "run_failed"
  | "issue_created"
  | "issue_status_changed"
  | "comment_posted"
  | "approval_requested"
  | "approval_decided";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  at: string;
  agentId: string | null;
  agentName: string | null;
  issueId: string | null;
  issueLabel: string | null;
  text: string;
}

export interface ActivityIssueRow {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ActivityCommentRow {
  id: string;
  issueId: string;
  authorAgentId: string | null;
  createdAt: string;
}

export interface ActivityRunRow {
  id: string;
  agentId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ActivityApprovalRow {
  id: string;
  type: string;
  requestedByAgentId: string | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface BuildActivityParams {
  issues: ActivityIssueRow[];
  comments: ActivityCommentRow[];
  runs: ActivityRunRow[];
  approvals: ActivityApprovalRow[];
  agentNames: Map<string, string>;
  issueLabels: Map<string, { label: string; title: string }>;
  since: Date;
  limit: number;
}

function name(names: Map<string, string>, id: string | null): string | null {
  if (!id) return null;
  return names.get(id) ?? id;
}

function label(labels: Map<string, { label: string; title: string }>, id: string): { label: string; title: string } | null {
  return labels.get(id) ?? null;
}

function inWindow(iso: string | null, sinceMs: number): iso is string {
  return iso !== null && Date.parse(iso) >= sinceMs;
}

/** Pure merge of raw rows into a newest-first activity feed. No history is stored, so issue events are
 * derived honestly from current status + timestamps: "created" when created_at is in window, else
 * "updated to <status>" when updated_at is in window. */
export function buildActivity(params: BuildActivityParams): ActivityEvent[] {
  const sinceMs = params.since.getTime();
  const events: ActivityEvent[] = [];

  for (const issue of params.issues) {
    const lbl = label(params.issueLabels, issue.id) ?? { label: issue.identifier ?? issue.id, title: issue.title };
    if (inWindow(issue.createdAt, sinceMs)) {
      events.push({
        id: `issue-created-${issue.id}`,
        type: "issue_created",
        at: issue.createdAt,
        agentId: null,
        agentName: null,
        issueId: issue.id,
        issueLabel: lbl.label,
        text: `${lbl.label} created: ${issue.title}`,
      });
    } else if (inWindow(issue.updatedAt, sinceMs)) {
      events.push({
        id: `issue-updated-${issue.id}-${issue.updatedAt}`,
        type: "issue_status_changed",
        at: issue.updatedAt,
        agentId: null,
        agentName: null,
        issueId: issue.id,
        issueLabel: lbl.label,
        text: `${lbl.label} updated to ${issue.status}`,
      });
    }
  }

  for (const comment of params.comments) {
    if (!inWindow(comment.createdAt, sinceMs)) continue;
    const lbl = label(params.issueLabels, comment.issueId);
    events.push({
      id: `comment-${comment.id}`,
      type: "comment_posted",
      at: comment.createdAt,
      agentId: comment.authorAgentId,
      agentName: name(params.agentNames, comment.authorAgentId),
      issueId: comment.issueId,
      issueLabel: lbl?.label ?? null,
      text: `commented on ${lbl?.label ?? comment.issueId}`,
    });
  }

  for (const run of params.runs) {
    if (inWindow(run.startedAt, sinceMs)) {
      events.push({
        id: `run-started-${run.id}`,
        type: "run_started",
        at: run.startedAt,
        agentId: run.agentId,
        agentName: name(params.agentNames, run.agentId),
        issueId: null,
        issueLabel: null,
        text: "run started",
      });
    }
    if (inWindow(run.finishedAt, sinceMs)) {
      const failed = run.status === "failed";
      events.push({
        id: `run-finished-${run.id}`,
        type: failed ? "run_failed" : "run_finished",
        at: run.finishedAt,
        agentId: run.agentId,
        agentName: name(params.agentNames, run.agentId),
        issueId: null,
        issueLabel: null,
        text: failed ? "run failed" : "run finished",
      });
    }
  }

  for (const approval of params.approvals) {
    if (inWindow(approval.createdAt, sinceMs)) {
      events.push({
        id: `approval-requested-${approval.id}`,
        type: "approval_requested",
        at: approval.createdAt,
        agentId: approval.requestedByAgentId,
        agentName: name(params.agentNames, approval.requestedByAgentId),
        issueId: null,
        issueLabel: null,
        text: `${approval.type} approval requested`,
      });
    }
    if (approval.status !== "pending" && inWindow(approval.decidedAt, sinceMs)) {
      events.push({
        id: `approval-decided-${approval.id}`,
        type: "approval_decided",
        at: approval.decidedAt,
        agentId: approval.requestedByAgentId,
        agentName: name(params.agentNames, approval.requestedByAgentId),
        issueId: null,
        issueLabel: null,
        text: `${approval.type} approval ${approval.status}`,
      });
    }
  }

  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return events.slice(0, params.limit);
}

/** Pure: approvals still awaiting a decision, oldest first, for an "ask me" style board. */
export function pendingApprovals(approvals: ActivityApprovalRow[]): ActivityApprovalRow[] {
  return approvals
    .filter((a) => a.status === "pending")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
