"use client";

import { useMemo, useState } from "react";

type Props = {
  title?: string;
  value: unknown;
  onApply: (nextValue: any) => Promise<void> | void;
  disabled?: boolean;
  hint?: string;
};

const shell: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.12)",
  marginTop: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #6f0000",
  background: "#0a0a0a",
  color: "#ffd7d7",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
  fontSize: 12,
};

export default function ConfigJsonEditor({ title, value, onApply, disabled, hint }: Props) {
  const pretty = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  const [raw, setRaw] = useState(pretty);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function applyJson() {
    if (disabled) return;
    setWorking(true);
    setError("");
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      await onApply(parsed);
    } catch (err: any) {
      setError(err?.message || "Invalid JSON.");
    } finally {
      setWorking(false);
    }
  }

  function resetJson() {
    setRaw(pretty);
    setError("");
  }

  return (
    <section style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ color: "#ff8f8f", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {title || "Advanced Config"}
          </div>
          <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 4 }}>
            {hint || "Edit the full config JSON when you need deeper options than the UI exposes."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={resetJson}
            disabled={disabled || working}
            style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
          >
            Reset
          </button>
          <button
            onClick={applyJson}
            disabled={disabled || working}
            style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
          >
            {working ? "Applying..." : "Apply JSON"}
          </button>
        </div>
      </div>
      {error ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{error}</div> : null}
      <textarea
        style={{ ...input, minHeight: 220, marginTop: 10 }}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
    </section>
  );
}
