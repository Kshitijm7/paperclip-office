-- office_events: an append-only log of what happened in the office, one row per event.
-- The host runs this inside the plugin's own namespace and records its checksum:
-- never edit it after release, add a new numbered migration instead.
--
-- The first kind is 'handoff': an envelope from one agent to another, exactly as
-- diffHandoffs in src/shared/office.ts detects it. Replay reads the same rows.
CREATE TABLE IF NOT EXISTS office_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id    text        NOT NULL,
  kind          text        NOT NULL,
  occurred_at   timestamptz NOT NULL,
  from_agent_id text,
  to_agent_id   text,
  issue_id      text,
  issue_label   text
);

CREATE INDEX IF NOT EXISTS office_events_company_kind_time
  ON office_events (company_id, kind, occurred_at);
