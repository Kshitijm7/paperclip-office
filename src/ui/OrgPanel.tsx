import { useEffect, useState } from "react";
import type { Handoff, OfficeAgent, OfficeData } from "../shared/office.js";
import { buildDepartments, buildOrg } from "../shared/org.js";
import { formatSpend, type CostMetric } from "../shared/cost.js";
import { useStore } from "../adapters/store.js";
import { tokens } from "./tokens.js";
import { STATE_COLOR } from "./stateColors.js";

const ROW_H = 30;

function issueCount(agent: OfficeAgent): number {
  return agent.issue ? 1 : 0;
}

function Node({
  agent,
  depth,
  children,
  highlight,
  cost,
}: {
  agent: OfficeAgent;
  depth: number;
  children: React.ReactNode;
  highlight: boolean;
  cost: CostMetric | null;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = !!children && (Array.isArray(children) ? children.length > 0 : true);
  return (
    <div>
      <div
        role="button"
        onClick={() => useStore.getState().select(agent.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: ROW_H,
          paddingLeft: 8 + depth * 16,
          borderLeft: depth > 0 ? `1px solid ${tokens.border}` : "none",
          marginLeft: depth > 0 ? 8 : 0,
          cursor: "pointer",
          borderRadius: tokens.radius,
          background: highlight ? "color-mix(in oklch, var(--primary) 18%, transparent)" : undefined,
          transition: "background 600ms ease",
        }}
      >
        {hasChildren && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            style={{ width: 12, fontSize: 10, color: tokens.mutedForeground, flex: "none", cursor: "pointer" }}
          >
            {open ? "▾" : "▸"}
          </span>
        )}
        {!hasChildren && <span style={{ width: 12, flex: "none" }} />}
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 4,
            flex: "none",
            background: agent.stuck ? STATE_COLOR.stuck : STATE_COLOR[agent.state],
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {agent.name}
        </span>
        <span style={{ fontSize: 11, color: tokens.mutedForeground, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {agent.title ?? agent.role ?? ""}
        </span>
        {agent.issue && (
          <span style={{ fontSize: 11, color: tokens.mutedForeground, marginLeft: "auto", flex: "none", paddingRight: 8 }}>
            {agent.issue.label}
          </span>
        )}
        {cost && (
          <span
            style={{
              fontSize: 11,
              color: tokens.mutedForeground,
              marginLeft: agent.issue ? undefined : "auto",
              flex: "none",
              paddingRight: 8,
            }}
          >
            {formatSpend(agent.costCents, agent.tokens, cost)}
          </span>
        )}
        {issueCount(agent) > 0 && (
          <span
            style={{
              fontSize: 10,
              padding: "0 6px",
              borderRadius: 8,
              background: tokens.accent,
              color: tokens.foreground,
              flex: "none",
            }}
          >
            {issueCount(agent)}
          </span>
        )}
      </div>
      {open && children}
    </div>
  );
}

function Tree({
  ids,
  childrenOf,
  byId,
  depth,
  recentIds,
  cost,
}: {
  ids: string[];
  childrenOf: Map<string, string[]>;
  byId: Map<string, OfficeAgent>;
  depth: number;
  recentIds: Set<string>;
  cost: CostMetric | null;
}) {
  return (
    <>
      {ids.map((id) => {
        const agent = byId.get(id);
        if (!agent) return null;
        const kids = childrenOf.get(id) ?? [];
        return (
          <Node key={id} agent={agent} depth={depth} highlight={recentIds.has(id)} cost={cost}>
            {kids.length > 0 && (
              <Tree ids={kids} childrenOf={childrenOf} byId={byId} depth={depth + 1} recentIds={recentIds} cost={cost} />
            )}
          </Node>
        );
      })}
    </>
  );
}

function FlowList({ handoffs, byId }: { handoffs: Handoff[]; byId: Map<string, OfficeAgent> }) {
  if (handoffs.length === 0) return null;
  return (
    <div style={{ borderTop: `1px solid ${tokens.border}`, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, color: tokens.mutedForeground, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
        Recent handoffs
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {handoffs.slice(0, 8).map((h, i) => (
          <div key={i} style={{ fontSize: 12, color: tokens.mutedForeground }}>
            {byId.get(h.from)?.name ?? h.from} → {byId.get(h.to)?.name ?? h.to} · {h.issue}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgPanel({ data }: { data: OfficeData | null }) {
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data || data.handoffs.length === 0) return;
    const ids = new Set<string>();
    for (const h of data.handoffs) {
      ids.add(h.from);
      ids.add(h.to);
    }
    setRecentIds(ids);
    const timer = setTimeout(() => setRecentIds(new Set()), 2500);
    return () => clearTimeout(timer);
  }, [data?.handoffs]);

  if (!data) return null;
  const cost = (data.settings.showCost ?? true) ? data.settings.costMetric ?? "auto" : null;

  const byId = new Map(data.agents.map((a) => [a.id, a]));
  const agentRows = data.agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    title: a.title,
    reportsTo: a.reportsTo,
    status: "active",
  }));
  const departments = buildDepartments(agentRows);
  const { nodesById } = buildOrg(agentRows);

  const childrenOf = new Map<string, string[]>();
  for (const node of nodesById.values()) {
    if (node.chain.length === 0) continue;
    const parent = node.chain[node.chain.length - 1];
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(node.id);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <div style={{ padding: "0 6px 6px", overflowX: "auto" }}>
        {departments.map((dept) => {
          const topLevel = dept.agentIds.filter((id) => {
            const node = nodesById.get(id);
            const parent = node?.chain[node.chain.length - 1];
            return !parent || !dept.agentIds.includes(parent);
          });
          return (
            <div key={dept.name} style={{ marginTop: 6 }}>
              {dept.name !== "Chief" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: tokens.mutedForeground,
                    padding: "4px 8px",
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  <span>{dept.name}</span>
                  {cost && (
                    <span>{formatSpend(dept.agentIds.reduce((sum, id) => sum + (byId.get(id)?.costCents ?? 0), 0), dept.agentIds.reduce((sum, id) => sum + (byId.get(id)?.tokens ?? 0), 0), cost)}</span>
                  )}
                </div>
              )}
              <Tree ids={topLevel} childrenOf={childrenOf} byId={byId} depth={0} recentIds={recentIds} cost={cost} />
            </div>
          );
        })}
      </div>
      <FlowList handoffs={data.handoffs} byId={byId} />
    </div>
  );
}
