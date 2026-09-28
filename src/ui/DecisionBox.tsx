import { useState } from "react";
import { usePluginData, usePluginAction, useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import { DECISIONS_DATA_KEY, DECIDE_APPROVAL_ACTION, RESPOND_DECISION_ACTION, type DecisionItem } from "../shared/decisions.js";
import { tokens } from "./tokens.js";
import { useStore } from "../adapters/store.js";

const KIND_LABEL: Record<DecisionItem["kind"], string> = {
  approval: "Approval",
  suggest_tasks: "Suggested tasks",
  ask_user_questions: "Question",
  request_confirmation: "Confirmation",
  request_checkbox_confirmation: "Confirmation",
};

function ago(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 7px",
        borderRadius: 8, background: tokens.accent, color: tokens.mutedForeground, flex: "none",
      }}
    >
      {children}
    </span>
  );
}

function DecisionRow({ item, companyId, onDone }: { item: DecisionItem; companyId: string; onDone: (id: string) => void }) {
  const nav = useHostNavigation();
  const decideApproval = usePluginAction(DECIDE_APPROVAL_ACTION);
  const respondDecision = usePluginAction(RESPOND_DECISION_ACTION);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    try {
      if (item.kind === "approval") {
        await decideApproval({ companyId, approvalId: item.targetId, action, note: action === "reject" ? reason || undefined : undefined });
      } else {
        await respondDecision({
          companyId,
          issueId: item.issueId,
          interactionId: item.targetId,
          action: action === "approve" ? "accept" : "reject",
          reason: action === "reject" ? reason || undefined : undefined,
        });
      }
      onDone(item.id);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
      setConfirming(false);
      setRejecting(false);
    }
  }

  return (
    <div style={{ padding: "10px 4px", borderBottom: `1px solid ${tokens.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Badge>{KIND_LABEL[item.kind]}</Badge>
        <span style={{ fontWeight: 500, flex: 1 }}>{item.title}</span>
        <span style={{ color: tokens.mutedForeground, fontSize: 11, whiteSpace: "nowrap" }}>{ago(item.createdAt)}</span>
      </div>
      {item.summary && <div style={{ fontSize: 13, color: tokens.mutedForeground }}>{item.summary}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: tokens.mutedForeground }}>
        {item.requester && <span>from {item.requester}</span>}
        <a {...nav.linkProps(item.link)} style={{ color: "inherit" }}>
          {item.issueLabel ?? "Open inbox"}
        </a>
      </div>
      {err && <div style={{ fontSize: 12, color: tokens.destructive }}>{err}</div>}
      {item.resolvable ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rejecting && (
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              style={{ font: "inherit", fontSize: 12, padding: "5px 8px", border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, background: tokens.background, color: tokens.foreground }}
            />
          )}
          <div style={{ display: "flex", gap: 6 }}>
            {!confirming ? (
              <button disabled={busy} onClick={() => setConfirming(true)} style={btn(tokens.primary)}>
                {item.kind === "approval" ? "Approve" : "Accept"}
              </button>
            ) : (
              <button disabled={busy} onClick={() => act("approve")} style={btn(tokens.primary)}>
                Confirm {item.kind === "approval" ? "approve" : "accept"}
              </button>
            )}
            {!rejecting ? (
              <button disabled={busy} onClick={() => setRejecting(true)} style={btn(tokens.destructive)}>
                Reject
              </button>
            ) : (
              <button disabled={busy} onClick={() => act("reject")} style={btn(tokens.destructive)}>
                Confirm reject
              </button>
            )}
          </div>
        </div>
      ) : (
        <a {...nav.linkProps(item.link)} style={{ ...btn(tokens.border), display: "inline-block", textDecoration: "none", width: "fit-content" }}>
          Answer in issue
        </a>
      )}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    font: "inherit", fontSize: 12, padding: "5px 10px", borderRadius: tokens.radius,
    border: `1px solid ${color}`, background: "transparent", color: "inherit", cursor: "pointer",
  };
}

export function DecisionBox({ companyId }: { companyId: string }) {
  const open = useStore((s) => s.decisionBoxOpen);
  const { data, refresh } = usePluginData<{ items: DecisionItem[] }>(DECISIONS_DATA_KEY, { companyId });
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  if (!open) return null;

  const items = (data?.items ?? []).filter((i) => !removed.has(i.id));

  function onDone(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
    void refresh();
  }

  function close() {
    useStore.setState({ decisionBoxOpen: false });
  }

  return (
    <div
      onClick={close}
      style={{ position: "absolute", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 560px)", maxHeight: "80vh", display: "flex", flexDirection: "column",
          background: tokens.surface, color: tokens.foreground, border: `1px solid ${tokens.border}`, borderRadius: tokens.radius,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${tokens.border}` }}>
          <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>Decisions ({items.length})</span>
          <button onClick={close} aria-label="Close decisions" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}>
            x
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: "0 14px" }}>
          {items.length === 0 ? (
            <div style={{ padding: "20px 4px", color: tokens.mutedForeground, fontSize: 13 }}>Nothing waiting on you.</div>
          ) : (
            items.map((item) => <DecisionRow key={item.id} item={item} companyId={companyId} onDone={onDone} />)
          )}
        </div>
      </div>
    </div>
  );
}
