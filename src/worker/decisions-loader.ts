import type { PluginContext } from "@paperclipai/plugin-sdk";
import {
  buildDecisions,
  type DecisionApprovalRow,
  type DecisionInteractionRow,
  type DecisionIssueLabel,
  type DecisionItem,
} from "../shared/decisions.js";

const CLOSED_STATUSES = new Set(["done", "cancelled"]);

function iso(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Open issues, most recently updated first, capped by the decisionIssueScan setting. */
async function loadOpenIssues(ctx: PluginContext, companyId: string, scanLimit: number) {
  const issues = await ctx.issues.list({ companyId, limit: scanLimit * 3 });
  return issues
    .filter((i) => !CLOSED_STATUSES.has(i.status))
    .sort((a, b) => Date.parse(iso(b.updatedAt)) - Date.parse(iso(a.updatedAt)))
    .slice(0, scanLimit);
}

/** Pending decision cards across a scanned window of open issues. Any single issue's interactions can fail
 * without losing the rest, so each lookup is wrapped rather than failing the whole scan. */
async function loadPendingInteractions(
  ctx: PluginContext,
  companyId: string,
  issues: Array<{ id: string; identifier: string | null; title: string }>,
): Promise<Array<{ row: DecisionInteractionRow; issue: DecisionIssueLabel }>> {
  const results = await Promise.all(
    issues.map(async (issue) => {
      try {
        const rows = await ctx.issues.listInteractions(issue.id, companyId);
        const label = { label: issue.identifier ?? issue.id.slice(0, 8), title: issue.title };
        return rows
          .filter((r) => r.status === "pending")
          .map((r) => ({
            row: {
              id: r.id,
              issueId: issue.id,
              kind: r.kind as DecisionInteractionRow["kind"],
              status: r.status,
              title: r.title ?? null,
              summary: r.summary ?? null,
              createdByAgentId: r.createdByAgentId ?? null,
              createdAt: iso(r.createdAt),
            },
            issue: label,
          }));
      } catch (err) {
        ctx.logger.warn("office: interactions unavailable for issue", { issueId: issue.id, error: String(err).slice(0, 200) });
        return [];
      }
    }),
  );
  return results.flat();
}

export async function loadDecisions(
  ctx: PluginContext,
  companyId: string,
  decisionIssueScan: number,
): Promise<{ items: DecisionItem[] }> {
  const [approvalsRaw, agents, openIssues] = await Promise.all([
    ctx.approvals.list({ companyId }).catch(() => []),
    ctx.agents.list({ companyId, limit: 500 }),
    loadOpenIssues(ctx, companyId, decisionIssueScan),
  ]);

  const approvals: DecisionApprovalRow[] = approvalsRaw.map((a) => ({
    id: a.id,
    type: a.type,
    requestedByAgentId: a.requestedByAgentId,
    status: a.status,
    createdAt: iso(a.createdAt),
  }));

  const interactions = await loadPendingInteractions(ctx, companyId, openIssues);
  const agentNames = new Map(agents.map((a) => [a.id, a.name]));

  return { items: buildDecisions({ approvals, interactions, agentNames }) };
}
