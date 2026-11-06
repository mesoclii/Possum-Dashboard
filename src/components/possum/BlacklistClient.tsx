"use client";

import { useMemo, useState } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type BlacklistCfg = {
  enabled: boolean;
  autoBan: boolean;
  auditChannelId: string;
  staffRoleIds: string[];
  notes: string;
};

const DEFAULT_CFG: BlacklistCfg = {
  enabled: true,
  autoBan: true,
  auditChannelId: "",
  staffRoleIds: [],
  notes: "",
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1360 };
const card: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};
const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};
const label: React.CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

function toggle(list: string[], id: string) {
  const next = new Set(list || []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return Array.from(next);
}

export default function BlacklistClient() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
    reload,
  } = useGuildEngineEditor<BlacklistCfg>("blacklist", DEFAULT_CFG);

  const [targetUserId, setTargetUserId] = useState("");
  const [targetReason, setTargetReason] = useState("");
  const [removeUserId, setRemoveUserId] = useState("");

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );

  async function addEntry() {
    const userId = targetUserId.trim();
    if (!/^\d{16,20}$/.test(userId)) return;
    const result = await runAction("addEntry", { userId, reason: targetReason.trim() || "Added from dashboard" });
    if (result) {
      setTargetReason("");
      setRemoveUserId(userId);
      void reload();
    }
  }

  async function removeEntry() {
    const userId = removeUserId.trim();
    if (!/^\d{16,20}$/.test(userId)) return;
    const result = await runAction("removeEntry", { userId });
    if (result) {
      setTargetUserId("");
      setRemoveUserId("");
      setTargetReason("");
      void reload();
    }
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={shell}>
      <EngineContractPanel
        engineKey="blacklist"
        intro="Blacklist is the governance deny-list surface. Entries are global, but staff access and audit routing are configured per guild so this page needs to stay operational instead of generic."
        related={[
          { label: "Security", route: "/dashboard/security", reason: "blacklist state feeds the broader governance and threat posture" },
          { label: "Onboarding", route: "/dashboard/security/onboarding", reason: "rejoin/verification enforcement should align with deny-list policy" },
          { label: "Containment", route: "/dashboard/security/containment", reason: "high-risk users often escalate into containment or auto-response flows" },
        ]}
      />

      <div style={{ color: "#ff9999", marginTop: -2, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading blacklist engine...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, enabled: e.target.checked }))} /> Blacklist engine enabled
              </label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.autoBan} onChange={(e) => setCfg((prev) => ({ ...prev, autoBan: e.target.checked }))} /> Auto-ban on add
              </label>
            </div>
            <div style={{ color: "#ffb8b8", fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
              Entries are global, but this page controls whether this guild can manage them, who counts as blacklist staff, and where audit notices are posted.
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Audit Channel</div>
                <select style={input} value={cfg.auditChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, auditChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Blacklist Staff Roles</div>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10, background: "#0a0a0a" }}>
                  {roles.map((role) => (
                    <label key={role.id} style={{ display: "block", color: "#ffdcdc", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={cfg.staffRoleIds.includes(role.id)}
                        onChange={() => setCfg((prev) => ({ ...prev, staffRoleIds: toggle(prev.staffRoleIds, role.id) }))}
                      />{" "}
                      @{role.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Live Blacklist Actions
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Add User ID</div>
                <input style={input} value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="Discord user ID" />
              </div>
              <div>
                <div style={label}>Remove User ID</div>
                <input style={input} value={removeUserId} onChange={(e) => setRemoveUserId(e.target.value)} placeholder="Discord user ID" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={label}>Reason</div>
                <textarea style={{ ...input, minHeight: 90 }} value={targetReason} onChange={(e) => setTargetReason(e.target.value)} placeholder="Reason for deny-list entry" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button onClick={() => void addEntry()} disabled={saving || !/^\d{16,20}$/.test(targetUserId.trim())} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                {saving ? "Working..." : "Add Blacklist Entry"}
              </button>
              <button onClick={() => void removeEntry()} disabled={saving || !/^\d{16,20}$/.test(removeUserId.trim())} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                {saving ? "Working..." : "Remove Entry"}
              </button>
            </div>
          </section>

          <section style={card}>
            <div style={label}>Blacklist Notes</div>
            <textarea
              style={{ ...input, minHeight: 120 }}
              value={cfg.notes || ""}
              onChange={(e) => setCfg((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Guild-specific deny-list policy, who handles appeals, and how blacklist actions should be audited."
            />
          </section>

          <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffb8b8", lineHeight: 1.6, maxWidth: 820 }}>
              This page is now the live guild blacklist operator surface: policy, audit routing, staff delegation, and add/remove actions all run against the actual bot engine.
            </div>
            <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Blacklist"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
