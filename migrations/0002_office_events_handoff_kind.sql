-- Which kind of envelope a 'handoff' row is: 'reassign', 'delegate' or 'return' (HandoffKind in src/shared/office.ts).
-- NULL on rows written before this migration; the worker then sends the envelope without a kind.
-- Checksum-recorded by the host: never edit after release, add a new numbered migration instead.
ALTER TABLE office_events ADD COLUMN IF NOT EXISTS handoff_kind text;
