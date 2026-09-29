import type { PluginContext, PluginPerformActionContext } from "@paperclipai/plugin-sdk";
import { DECIDE_APPROVAL_ACTION, RESPOND_DECISION_ACTION, requireUserActor } from "../shared/decisions.js";

export function registerDecisions(ctx: PluginContext): void {
  ctx.actions.register(DECIDE_APPROVAL_ACTION, async (params, context: PluginPerformActionContext) => {
    const actorUserId = requireUserActor({ type: context.actor.type, userId: context.actor.userId });
    const companyId = String(params.companyId ?? context.companyId ?? "");
    const approvalId = String(params.approvalId ?? "");
    const action = params.action === "reject" ? "reject" : "approve";
    if (!companyId || !approvalId) throw new Error("companyId and approvalId are required");

    const { approval, applied } = await ctx.approvals.decide(
      approvalId,
      { action, actorUserId, decisionNote: typeof params.note === "string" ? params.note : null },
      companyId,
    );
    return { applied, status: approval.status };
  });

  ctx.actions.register(RESPOND_DECISION_ACTION, async (params, context: PluginPerformActionContext) => {
    const actorUserId = requireUserActor({ type: context.actor.type, userId: context.actor.userId });
    const companyId = String(params.companyId ?? context.companyId ?? "");
    const issueId = String(params.issueId ?? "");
    const interactionId = String(params.interactionId ?? "");
    const action = params.action === "reject" ? "reject" : "accept";
    if (!companyId || !issueId || !interactionId) throw new Error("companyId, issueId and interactionId are required");

    const { interaction, applied } = await ctx.issues.respondInteraction(
      issueId,
      interactionId,
      { action, actorUserId, reason: typeof params.reason === "string" ? params.reason : null },
      companyId,
    );
    return { applied, status: interaction.status };
  });
}
