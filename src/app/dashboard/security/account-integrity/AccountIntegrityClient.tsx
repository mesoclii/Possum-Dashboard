"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type AccountIntegrityConfig = {
  enabled: boolean;
  minAccountAgeDays: number;
  detectionScoreThreshold: number;
  reviewScoreThreshold: number;
  quarantineScoreThreshold: number;
  recentJoinWindowMinutes: number;
  creationClusterWindowMinutes: number;
  waveJoinThreshold: number;
  similarNameThreshold: number;
  comparisonLimit: number;
  fullScanMemberLimit: number;
  maxRecentDetections: number;
  autoApplyReviewRole: boolean;
  autoApplyQuarantineRole: boolean;
  ignoreBots: boolean;
  ignoreStaff: boolean;
  flagNoAvatar: boolean;
  flagBotLikePattern: boolean;
  flagSimilarNames: boolean;
  flagCreationClusters: boolean;
  flagJoinWaves: boolean;
  flagAvatarReuse: boolean;
  emitAuditOnEveryEvaluation: boolean;
  reviewRoleId: string;
  quarantineRoleId: string;
  alertChannelId: string;
  reviewChannelId: string;
  logChannelId: string;
  trustedRoleIds: string[];
  exemptRoleIds: string[];
  exemptUserIds: string[];
  notes: string;
};

const DEFAULTS: AccountIntegrityConfig = {
  enabled: true,
  minAccountAgeDays: 7,
  detectionScoreThreshold: 35,
  reviewScoreThreshold: 55,
  quarantineScoreThreshold: 80,
  recentJoinWindowMinutes: 20,
  creationClusterWindowMinutes: 1440,
  waveJoinThreshold: 4,
  similarNameThreshold: 0.84,
  comparisonLimit: 250,
  fullScanMemberLimit: 0,
  maxRecentDetections: 160,
  autoApplyReviewRole: true,
  autoApplyQuarantineRole: false,
  ignoreBots: true,
  ignoreStaff: true,
  flagNoAvatar: true,
  flagBotLikePattern: true,
  flagSimilarNames: true,
  flagCreationClusters: true,
  flagJoinWaves: true,
  flagAvatarReuse: true,
  emitAuditOnEveryEvaluation: false,
  reviewRoleId: "",
  quarantineRoleId: "",
  alertChannelId: "",
  reviewChannelId: "",
  logChannelId: "",
  trustedRoleIds: [],
  exemptRoleIds: [],
  exemptUserIds: [],
  notes: "",
};

const shell: CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1440 };
const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};
const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};
const label: CSSProperties = {
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

function parseUserList(value: string) {
  return Array.from(new Set(String(value || "").match(/\d{16,20}/g) || []));
}

function rows(entries: any[]) {
  return Array.isArray(entries) ? entries : [];
}

const ROUTING_FIELDS: Array<{
  key: "reviewRoleId" | "quarantineRoleId" | "alertChannelId" | "reviewChannelId" | "logChannelId";
  label: string;
  kind: "role" | "channel";
}> = [
  { key: "reviewRoleId", label: "Review Role", kind: "role" },
  { key: "quarantineRoleId", label: "Quarantine Role", kind: "role" },
  { key: "alertChannelId", label: "Alert Channel", kind: "channel" },
  { key: "reviewChannelId", label: "Review Channel", kind: "channel" },
  { key: "logChannelId", label: "Log Channel", kind: "channel" },
];

export default function AccountIntegrityClient() {
  const {
    guildId,
    guildName,
    config,
    setConfig,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<AccountIntegrityConfig>("security.accountIntegrity", DEFAULTS);

  const actionLock = useRef(false);
  const [actionRunning, setActionRunning] = useState(false);
  const cfg = useMemo(() => ({ ...DEFAULTS, ...(config || {}) }), [config]);
  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );
  const detections = useMemo(() => rows((details as any)?.detections), [details]);
  const recentActivity = useMemo(() => rows((details as any)?.recentActivity), [details]);
  const trackedProfiles = useMemo(() => rows((details as any)?.trackedProfiles), [details]);
  const exemptUserText = useMemo(() => (cfg.exemptUserIds || []).join(", "), [cfg.exemptUserIds]);

  function patch(next: Partial<AccountIntegrityConfig>) {
    setConfig((prev) => ({ ...(prev || cfg), ...next }));
  }

  async function runConfiguredAction(action: "scanGuild" | "clearDetections") {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionRunning(true);
    try {
      const saved = await save();
      if (!saved) return;
      await runAction(action);
    } finally {
      actionLock.current = false;
      setActionRunning(false);
    }
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open this from your guild dashboard.</div>;
  }

  return (
    <div style={shell}>
      <h1 style={{ marginTop: 0, color: "#ff4d4d", textTransform: "uppercase", letterSpacing: "0.1em" }}>Account Integrity Studio</h1>
      <div style={{ color: "#ff9c9c", marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb6b6", marginBottom: 14, lineHeight: 1.6 }}>
        Deep account-risk and alt detection: fresh-account gates, suspicious name clustering, creation-time clusters, join-wave detection,
        avatar reuse hints, review/quarantine role automation, and a clean staff operator feed.
      </div>
      {message ? <div style={{ marginBottom: 10, color: "#ffd27a" }}>{message}</div> : null}
      {loading ? <div style={card}>Loading account integrity engine...</div> : null}

      {!loading ? (
        <>
          <EngineInsights summary={summary} details={details} showDetails />

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Core Controls</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              {[
                ["enabled", "Engine enabled"],
                ["autoApplyReviewRole", "Auto apply review role"],
                ["autoApplyQuarantineRole", "Auto apply quarantine role"],
                ["ignoreBots", "Ignore bots"],
                ["ignoreStaff", "Ignore staff"],
                ["flagNoAvatar", "Flag no-avatar accounts"],
                ["flagBotLikePattern", "Flag bot-like usernames"],
                ["flagSimilarNames", "Flag similar name clusters"],
                ["flagCreationClusters", "Flag creation-time clusters"],
                ["flagJoinWaves", "Flag join waves"],
                ["flagAvatarReuse", "Flag avatar reuse"],
                ["emitAuditOnEveryEvaluation", "Audit every evaluation"],
              ].map(([key, text]) => (
                <label key={key} style={{ color: "#ffdcdc", fontWeight: 700 }}>
                  <input type="checkbox" checked={Boolean((cfg as any)[key])} onChange={(e) => patch({ [key]: e.target.checked } as Partial<AccountIntegrityConfig>)} /> {text}
                </label>
              ))}
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Thresholds</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              {[
                ["minAccountAgeDays", "Minimum Account Age (Days)", 1],
                ["detectionScoreThreshold", "Detection Score Threshold", 1],
                ["reviewScoreThreshold", "Review Score Threshold", 1],
                ["quarantineScoreThreshold", "Quarantine Score Threshold", 1],
                ["recentJoinWindowMinutes", "Recent Join Window (Minutes)", 1],
                ["creationClusterWindowMinutes", "Creation Cluster Window (Minutes)", 1],
                ["waveJoinThreshold", "Join Wave Threshold", 1],
                ["similarNameThreshold", "Name Similarity Threshold", 0.01],
                ["comparisonLimit", "Snapshot Comparison Limit", 1],
                ["fullScanMemberLimit", "Full Scan Member Limit", 1],
                ["maxRecentDetections", "Feed Retention", 1],
              ].map(([key, text, step]) => (
                <div key={key}>
                  <div style={label}>{text}</div>
                  <input style={input} type="number" step={step as number} value={Number((cfg as any)[key] ?? 0)} onChange={(e) => patch({ [key]: Number(e.target.value || 0) } as Partial<AccountIntegrityConfig>)} />
                </div>
              ))}
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Roles And Channels</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              {ROUTING_FIELDS.map(({ key, label: fieldLabel, kind }) => {
                const items = kind === "role" ? roles : textChannels;
                return (
                <div key={key}>
                  <div style={label}>{fieldLabel}</div>
                  <select style={input} value={String(cfg[key] || "")} onChange={(e) => patch({ [key]: e.target.value } as Partial<AccountIntegrityConfig>)}>
                    <option value="">Select {kind}</option>
                    {items.map((entry) => <option key={entry.id} value={entry.id}>{kind === "role" ? `@${entry.name}` : `#${entry.name}`}</option>)}
                  </select>
                </div>
              )})}
            </div>
          </section>

          <section style={card}>
            <div style={{ ...label, marginBottom: 10 }}>Trusted And Exempt Roles</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Trusted Roles</div>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #5f0000", borderRadius: 10, padding: 10 }}>
                  {roles.map((role) => <label key={role.id} style={{ display: "block", color: "#ffdcdc", marginBottom: 6 }}><input type="checkbox" checked={(cfg.trustedRoleIds || []).includes(role.id)} onChange={() => patch({ trustedRoleIds: toggle(cfg.trustedRoleIds || [], role.id) })} /> @{role.name}</label>)}
                </div>
              </div>
              <div>
                <div style={label}>Exempt Roles</div>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #5f0000", borderRadius: 10, padding: 10 }}>
                  {roles.map((role) => <label key={role.id} style={{ display: "block", color: "#ffdcdc", marginBottom: 6 }}><input type="checkbox" checked={(cfg.exemptRoleIds || []).includes(role.id)} onChange={() => patch({ exemptRoleIds: toggle(cfg.exemptRoleIds || [], role.id) })} /> @{role.name}</label>)}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={label}>Exempt User IDs</div>
              <textarea style={{ ...input, minHeight: 90 }} value={exemptUserText} onChange={(e) => patch({ exemptUserIds: parseUserList(e.target.value) })} placeholder="Comma-separated Discord user IDs" />
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={label}>Operator Notes</div>
              <textarea style={{ ...input, minHeight: 110 }} value={cfg.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Use this for internal review notes or how your staff should handle flagged accounts." />
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save Engine"}</button>
              <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void runConfiguredAction("scanGuild")} disabled={saving || actionRunning}>{actionRunning ? "Working..." : "Full Guild Scan"}</button>
              <button style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void runConfiguredAction("clearDetections")} disabled={saving || actionRunning}>Clear Detection Feed</button>
            </div>
          </section>

          <section style={card}><div style={label}>Recent Detections</div>{detections.length ? detections.map((entry: any, index: number) => <div key={entry.id || index} style={{ borderTop: index ? "1px solid #3d0000" : "none", padding: "10px 0" }}><div style={{ color: "#ffe4e4", fontWeight: 700 }}>{entry.title || "Detection"}</div><div style={{ color: "#ffb3b3", lineHeight: 1.6 }}>{entry.value || "No detail."}</div></div>) : <div style={{ color: "#ffb3b3" }}>No detections yet.</div>}</section>
          <section style={card}><div style={label}>Recent Activity</div>{recentActivity.length ? recentActivity.map((entry: any, index: number) => <div key={entry.id || index} style={{ borderTop: index ? "1px solid #3d0000" : "none", padding: "10px 0" }}><div style={{ color: "#ffe4e4", fontWeight: 700 }}>{entry.title || "Activity"}</div><div style={{ color: "#ffb3b3", lineHeight: 1.6 }}>{entry.value || "No detail."}</div></div>) : <div style={{ color: "#ffb3b3" }}>No runtime activity yet.</div>}</section>
          <section style={card}><div style={label}>Tracked Profiles</div>{trackedProfiles.length ? trackedProfiles.map((entry: any, index: number) => <div key={entry.id || index} style={{ borderTop: index ? "1px solid #3d0000" : "none", padding: "10px 0" }}><div style={{ color: "#ffe4e4", fontWeight: 700 }}>{entry.title || "Profile"}</div><div style={{ color: "#ffb3b3", lineHeight: 1.6 }}>{entry.value || "No detail."}</div></div>) : <div style={{ color: "#ffb3b3" }}>No tracked profiles yet.</div>}</section>
        </>
      ) : null}
    </div>
  );
}
