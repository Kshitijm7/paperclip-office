import { useState } from "react";
import { usePluginAction, useHostNavigation } from "@paperclipai/plugin-sdk/ui";
import { DECISIONS_DATA_KEY, DECIDE_APPROVAL_ACTION, RESPOND_DECISION_ACTION, type DecisionItem } from "../shared/decisions.js";
import { tokens } from "./tokens.js";
import { useStore } from "../adapters/store.js";

const KIND_LABEL: Record<DecisionItem["kind"], string> = {
  approval: "Approval",
  suggest_tasks: "Suggested tasks",
  ask_user_questions: "Question",
  request_confirmation: "Yes / no",
  request_checkbox_confirmation: "Checklist",
};

const KIND_HINT: Record<DecisionItem["kind"], string> = {
  approval: "An agent needs your sign-off before it can go ahead.",
  suggest_tasks: "An agent proposed new tasks. Review them in the issue.",
  ask_user_questions: "An agent asked questions that need a typed answer in the issue.",
  request_confirmation: "An agent paused and is waiting for your yes or no.",
  request_checkbox_confirmation: "An agent needs you to confirm a checklist.",
};

const GO = tokens.prState.open;
const PRIORITY_COLOR: Record<string, string> = { critical: tokens.destructive, high: "oklch(72% 0.16 60)", medium: tokens.primary, low: tokens.mutedForeground };
const LONG = 480;

function ago(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 999,
        border: `1px solid ${color ?? tokens.border}`, color: color ?? tokens.mutedForeground, fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ color: tokens.foreground }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ fontSize: "0.92em", padding: "0 4px", borderRadius: 4, background: tokens.accent }}>{part.slice(1, -1)}</code>;
        return part;
      })}
    </>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ margin: 0, whiteSpace: "pre-wrap" }}><Inline text={para} /></p>
      ))}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span style={{ color: tokens.mutedForeground }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </>
  );
}

function Option({ tone, label, text }: { tone: string; label: string; text: string }) {
  return (
    <div style={{ flex: 1, minWidth: 180, border: `1px solid ${tone}`, borderRadius: tokens.radius, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: tone, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, marginTop: 2 }}>{text}</div>
    </div>
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
  const [expanded, setExpanded] = useState(false);

  const isApproval = item.kind === "approval";
  const yes = item.acceptLabel ?? (isApproval ? "Approve" : "Accept");
  const no = item.rejectLabel ?? "Reject";
  const details = item.details && item.details !== item.summary ? item.details : "";
  const shown = expanded || details.length <= LONG ? details : `${details.slice(0, LONG).trimEnd()}…`;

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    try {
      if (isApproval) {
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

  function clickYes() {
    if (confirming) return void act("approve");
    setConfirming(true);
    setRejecting(false);
  }

  function clickNo() {
    if (rejecting) return void act("reject");
    setRejecting(true);
    setConfirming(false);
  }

  return (
    <article style={{ border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, background: tokens.background, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Chip>{KIND_LABEL[item.kind]}</Chip>
        {item.issuePriority && <Chip color={PRIORITY_COLOR[item.issuePriority]}>{item.issuePriority} priority</Chip>}
        <span style={{ flex: 1 }} />
        <span title={new Date(item.createdAt).toLocaleString()} style={{ color: tokens.mutedForeground, fontSize: 12 }}>waiting {ago(item.createdAt)}</span>
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>{item.title}</div>
        <div style={{ fontSize: 12, color: tokens.mutedForeground, marginTop: 2 }}>{KIND_HINT[item.kind]}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 3, fontSize: 12.5 }}>
        {item.requester && (
          <Meta label="Asked by">
            <strong>{item.requester}</strong>
            {item.requesterRole && item.requesterRole !== item.requester && <span style={{ color: tokens.mutedForeground }}> · {item.requesterRole}</span>}
          </Meta>
        )}
        {item.issueLabel && (
          <Meta label="Issue">
            <a {...nav.linkProps(item.link)} style={{ color: "inherit" }}>{item.issueLabel}</a>
            {item.issueTitle && item.issueTitle !== item.title && <span> · {item.issueTitle}</span>}
            {item.issueStatus && <span style={{ color: tokens.mutedForeground }}> ({item.issueStatus.replace(/_/g, " ")})</span>}
          </Meta>
        )}
        {item.assignee && item.assignee !== item.requester && <Meta label="Owner">{item.assignee}</Meta>}
        {item.facts.map(([k, v]) => <Meta key={k} label={k}>{v}</Meta>)}
      </div>

      {(details || item.summary) && (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: tokens.surfaceForeground, borderLeft: `3px solid ${tokens.border}`, paddingLeft: 10 }}>
          <Prose text={details ? shown : item.summary} />
          {details.length > LONG && (
            <button onClick={() => setExpanded(!expanded)} style={{ ...btn(tokens.border), border: "none", padding: "4px 0", color: tokens.mutedForeground }}>
              {expanded ? "Show less" : "Read full request"}
            </button>
          )}
        </div>
      )}

      {item.resolvable && (item.acceptLabel || item.rejectLabel) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Option tone={GO} label="If you accept" text={yes} />
          <Option tone={tokens.destructive} label="If you reject" text={no} />
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: tokens.destructive }}>{err}</div>}

      {item.resolvable ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rejecting && item.allowReason && (
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell the agent why (optional)"
              style={{ font: "inherit", fontSize: 12.5, padding: "6px 8px", border: `1px solid ${tokens.border}`, borderRadius: tokens.radius, background: tokens.surface, color: tokens.foreground }}
            />
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button disabled={busy} onClick={clickYes} style={solid(GO)}>{confirming ? `Confirm: ${yes}` : yes}</button>
            <button disabled={busy} onClick={clickNo} style={btn(tokens.destructive)}>{rejecting ? `Confirm: ${no}` : no}</button>
            {(confirming || rejecting) && (
              <button disabled={busy} onClick={() => { setConfirming(false); setRejecting(false); }} style={{ ...btn(tokens.border), border: "none", color: tokens.mutedForeground }}>
                Cancel
              </button>
            )}
            <span style={{ flex: 1 }} />
            <a {...nav.linkProps(item.link)} style={{ fontSize: 12, color: tokens.mutedForeground }}>{isApproval ? "Open inbox" : "Open issue"}</a>
          </div>
        </div>
      ) : (
        <a {...nav.linkProps(item.link)} style={{ ...btn(tokens.border), display: "inline-block", textDecoration: "none", width: "fit-content" }}>
          Answer in issue
        </a>
      )}
    </article>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    font: "inherit", fontSize: 12.5, padding: "6px 12px", borderRadius: tokens.radius,
    border: `1px solid ${color}`, background: "transparent", color: "inherit", cursor: "pointer",
  };
}

function solid(color: string): React.CSSProperties {
  return { ...btn(color), background: color, color: "white", fontWeight: 600 };
}

/** The page owns the decision list so the header button, scene badge and this box always show the same count. */
export function DecisionBox({ companyId, items, onDecided }: { companyId: string; items: DecisionItem[]; onDecided: (id: string) => void }) {
  const open = useStore((s) => s.decisionBoxOpen);
  if (!open) return null;
  const onDone = onDecided;

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
          width: "min(94%, 720px)", maxHeight: "88%", display: "flex", flexDirection: "column",
          background: tokens.surface, color: tokens.foreground, border: `1px solid ${tokens.border}`, borderRadius: tokens.radius,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${tokens.border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Decisions waiting on you ({items.length})</div>
            <div style={{ fontSize: 12, color: tokens.mutedForeground, marginTop: 2 }}>
              These agents paused until you answer. Your choice goes straight back to them and they carry on. Oldest first.
            </div>
          </div>
          <button onClick={close} aria-label="Close decisions" style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {items.length === 0 ? (
            <div style={{ padding: "20px 4px", color: tokens.mutedForeground, fontSize: 13 }}>
              Nothing waiting on you. When an agent asks for a yes/no or an approval, it shows up here.
            </div>
          ) : (
            items.map((item) => <DecisionRow key={item.id} item={item} companyId={companyId} onDone={onDone} />)
          )}
        </div>
      </div>
    </div>
  );
}
