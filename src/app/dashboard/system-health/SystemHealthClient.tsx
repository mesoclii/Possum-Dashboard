"use client";



import Link from "next/link";
import { useEffect, useState } from "react";

const ENGINE_ROUTE_MAP: Record<string, string> = {
  music: "/dashboard/music",
  heist: "/dashboard/heist",
  onboarding: "/dashboard/security/onboarding",
  verification: "/dashboard/security/verification",
  selfroles: "/dashboard/selfroles",
  vip: "/dashboard/vip",
  store: "/dashboard/economy/store",
  giveaways: "/dashboard/giveaways",
  eventReactor: "/dashboard/event-reactor",
  range: "/dashboard/range",
  tickets: "/dashboard/tickets",
  runtimeRouter: "/dashboard/runtime-router",
  failsafe: "/dashboard/failsafe",
  communityStudio: "/dashboard/community-studio",
  channelFlow: "/dashboard/channel-flow",
  signalRelay: "/dashboard/signal-relay",
};

function severityColor(status: string) {
  if (status === "failing") return "#ff7a7a";
  if (status === "warning") return "#ffb3f0";
  if (status === "disabled") return "#9da6b0";
  return "#ffb3f0";
}

function actionStyle(tone: string) {
  if (tone === "danger") {
    return {
      border: "1px solid #a41414",
      background: "rgba(90,0,0,0.68)",
      color: "#ffd4d4",
    } as const;
  }
  if (tone === "primary") {
    return {
      border: "1px solid #ff2bd6",
      background: "rgba(255,43,214,0.22)",
      color: "#ffd1f5",
    } as const;
  }
  return {
    border: "1px solid #7a0000",
    background: "rgba(20,0,0,0.88)",
    color: "#ffd7d7",
  } as const;
}

function validationTone(ok: boolean | null | undefined) {
  if (ok === true) return "#ffb3f0";
  if (ok === false) return "#ff9b9b";
  return "#ffb3f0";
}

function getGuildId() {
  if (typeof window === "undefined") return "";
  const url = new URLSearchParams(window.location.search).get("guildId") || "";
  const stored = localStorage.getItem("activeGuildId") || "";
  const gid = (url || stored).trim();
  if (gid) localStorage.setItem("activeGuildId", gid);
  return gid;
}

const box: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(130,0,0,0.10)",
  marginBottom: 12
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #7a0000",
  background: "#0c0c0c",
  color: "#ffd7d7"
};

export default function SystemHealthPage() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [msg, setMsg] = useState("");

  const [runtime, setRuntime] = useState<any>(null);
  const [auditCfg, setAuditCfg] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [logKind, setLogKind] = useState("dash-error");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [statusSummary, setStatusSummary] = useState<any>(null);
  const [engineCatalogSummary, setEngineCatalogSummary] = useState<{ engines: number; sections: number } | null>(null);
  const [engineHealth, setEngineHealth] = useState<any>(null);
  const [eventReactorFailures, setEventReactorFailures] = useState<any[]>([]);
  const [engineFailures, setEngineFailures] = useState<any>(null);
  const [bindingReconciliationBusy, setBindingReconciliationBusy] = useState(false);

  async function loadAll(gid: string) {
    if (!gid) return;
    const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11] = await Promise.all([
      fetch(`/api/system/runtime-safety?guildId=${gid}`).then((r) => r.json()),
      fetch(`/api/audit/config?guildId=${gid}`).then((r) => r.json()),
      fetch(`/api/audit/events?guildId=${gid}&limit=200`).then((r) => r.json()),
      fetch(`/api/audit/log-feed?kind=${encodeURIComponent(logKind)}&lines=200`).then((r) => r.json()),
      fetch(`/api/system/snapshots`).then((r) => r.json()).catch(() => ({ snapshots: [] })),
      fetch(`/api/bot/guild-data?guildId=${gid}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/status`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/bot/engine-catalog?guildId=${gid}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/bot/engine-health?guildId=${gid}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/bot/event-reactor-failures?guildId=${gid}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/bot/engine-failures?guildId=${gid}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}))
    ]);
    setRuntime(r1?.config || null);
    setAuditCfg(r2?.config || null);
    setAuditEvents(Array.isArray(r3?.events) ? r3.events : []);
    setLogLines(Array.isArray(r4?.lines) ? r4.lines : []);
    const snap = Array.isArray(r5?.snapshots) ? r5.snapshots : [];
    setSnapshots(snap);
    const nextGuildName = String(r6?.guild?.name || "").trim();
    setGuildName(nextGuildName);
    if (nextGuildName && typeof window !== "undefined") localStorage.setItem("activeGuildName", nextGuildName);
    const status = r7?.status || null;
    setStatusSummary(status);
    const catalogRoot = r8?.catalog || r8?.data?.catalog || null;
    const engineCount = Array.isArray(catalogRoot?.engines) ? catalogRoot.engines.length : 0;
    const sectionCount = Array.isArray(catalogRoot?.dashboardSections) ? catalogRoot.dashboardSections.length : 0;
    setEngineCatalogSummary({ engines: engineCount, sections: sectionCount });
    setEngineHealth(r9?.success ? r9 : null);
    setEventReactorFailures(Array.isArray(r10?.failures) ? r10.failures : []);
    setEngineFailures(r11?.success ? r11?.snapshot || null : null);
  }

  useEffect(() => {
    const gid = getGuildId();
    setGuildId(gid);
    loadAll(gid).catch(() => setMsg("Failed to load health data."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveRuntime() {
    if (!guildId || !runtime) return;
    const r = await fetch("/api/system/runtime-safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, patch: runtime })
    });
    const j = await r.json();
    setMsg(j?.success ? "Runtime safety saved." : j?.error || "Save failed.");
  }

  async function saveAudit() {
    if (!guildId || !auditCfg) return;
    const r = await fetch("/api/audit/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, patch: auditCfg })
    });
    const j = await r.json();
    setMsg(j?.success ? "Audit config saved." : j?.error || "Save failed.");
  }

  async function refreshLogs() {
    const r = await fetch(`/api/audit/log-feed?kind=${encodeURIComponent(logKind)}&lines=200`);
    const j = await r.json();
    setLogLines(Array.isArray(j?.lines) ? j.lines : []);
  }

  async function createSnapshot() {
    const r = await fetch("/api/system/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, note: "manual-health-snapshot" })
    });
    const j = await r.json();
    setMsg(j?.success ? "Snapshot created." : j?.error || "Snapshot failed.");
    const r2 = await fetch(`/api/system/snapshots`);
    const j2 = await r2.json();
    setSnapshots(Array.isArray(j2?.snapshots) ? j2.snapshots : []);
  }

  async function clearEventReactorFailures() {
    if (!guildId) return;
    const r = await fetch("/api/bot/event-reactor-failures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, action: "clear" })
    });
    const j = await r.json();
    setMsg(j?.success ? "Event reactor failures cleared." : j?.error || "Failed to clear event reactor failures.");
    await loadAll(guildId);
  }

  async function runEngineRecovery(engine: string, action: string) {
    if (!guildId) return;
    const r = await fetch("/api/runtime/engine-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, engine, action }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(j?.success ? `${engine} ${action} completed.` : j?.error || `${engine} ${action} failed.`);
    await loadAll(guildId);
  }

  async function applyBindingReconciliation() {
    if (!guildId) return;
    setBindingReconciliationBusy(true);
    try {
      const r = await fetch("/api/bot/binding-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId }),
      });
      const j = await r.json().catch(() => ({}));
      setMsg(j?.success
        ? `Binding cleanup applied (${Number(j?.appliedChangeCount || 0)} changes).`
        : j?.error || "Binding cleanup failed.");
      await loadAll(guildId);
    } finally {
      setBindingReconciliationBusy(false);
    }
  }

  return (
    <div style={{ padding: 18, color: "#ffd7d7" }}>
      <h1 style={{ marginTop: 0, color: "#ff4d4d", letterSpacing: "0.06em" }}>System Health + Ops</h1>
      <p style={{ opacity: 0.9 }}>
        Guild: <b>{guildName || (typeof window !== "undefined" ? (localStorage.getItem("activeGuildName") || guildId) : guildId) || "(none)"}</b>
      </p>
      {msg && <div style={{ marginBottom: 10, color: "#ff8c8c" }}>{msg}</div>}

      {(statusSummary || engineCatalogSummary) && (
        <div style={box}>
          <b>Runtime Summary</b>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>Public Status</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{statusSummary?.overall || "unknown"}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#ffd0d0" }}>{statusSummary?.headline || "No status headline."}</div>
            </div>
            <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>Engine Catalog</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{engineCatalogSummary?.engines ?? 0} engines</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#ffd0d0" }}>{engineCatalogSummary?.sections ?? 0} sections</div>
            </div>
            <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>Audit Events</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{auditEvents.length}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#ffd0d0" }}>Recent config change entries</div>
            </div>
            <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>Log Lines</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{logLines.length}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#ffd0d0" }}>Current log view ({logKind})</div>
            </div>
            <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>Snapshots</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{snapshots.length}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#ffd0d0" }}>Recent backups stored</div>
            </div>
          </div>
        </div>
      )}

      {engineHealth && (
        <div style={box}>
          <b>Engine Health</b>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {[
              ["DB", engineHealth.health?.db],
              ["Memory DB", engineHealth.health?.memory],
              ["AI Provider", engineHealth.health?.ai],
              ["Services", engineHealth.health?.services],
              ["Router", engineHealth.health?.router],
              ["Engines", engineHealth.health?.engines],
            ].map(([label, ok]) => (
              <div key={String(label)} style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>{label}</div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{ok ? "OK" : "WARN"}</div>
              </div>
            ))}
            <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>Heap Used</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>
                {engineHealth.memory ? `${Math.round(Number(engineHealth.memory.heapUsed || 0) / 1024 / 1024)} MB` : "n/a"}
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#ffd0d0" }}>Uptime {engineHealth.uptimeSec || 0}s</div>
            </div>
            <div style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>Event Reactor</div>
              <div style={{ fontWeight: 800, marginTop: 6 }}>{engineHealth.eventReactor?.failureCount || 0} failures</div>
              <button onClick={clearEventReactorFailures} style={{ marginTop: 8 }}>Clear Failures</button>
            </div>
          </div>
        </div>
      )}

      {engineHealth?.validation && (
        <div style={box}>
          <h3 style={{ marginTop: 0, color: "#ff4444" }}>Startup Validation</h3>
          {(() => {
            const bindingReconciliation = engineHealth?.bindingReconciliation || null;
            return bindingReconciliation ? (
              <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: "#0f0f0f", border: "1px solid #300000" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ color: "#ff8c8c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Binding Cleanup Preview</div>
                    <div style={{ color: "#ffdada", fontWeight: 800, marginTop: 6 }}>
                      {bindingReconciliation.totals?.changeCount || 0} cleanup changes ready across {bindingReconciliation.totals?.engineCount || 0} engine{Number(bindingReconciliation.totals?.engineCount || 0) === 1 ? "" : "s"}
                    </div>
                    <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 4 }}>
                      This safely clears broken role/channel/category bindings from live engine config.
                    </div>
                  </div>
                  <button
                    onClick={() => void applyBindingReconciliation()}
                    disabled={bindingReconciliationBusy || !(bindingReconciliation.totals?.changeCount > 0)}
                    style={{
                      borderRadius: 999,
                      padding: "9px 14px",
                      cursor: bindingReconciliationBusy || !(bindingReconciliation.totals?.changeCount > 0) ? "not-allowed" : "pointer",
                      opacity: bindingReconciliationBusy || !(bindingReconciliation.totals?.changeCount > 0) ? 0.65 : 1,
                      ...actionStyle("danger"),
                    }}
                  >
                    {bindingReconciliationBusy ? "Applying..." : "Apply Binding Cleanup"}
                  </button>
                </div>

                {Array.isArray(bindingReconciliation.changes) && bindingReconciliation.changes.length > 0 ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {bindingReconciliation.changes.slice(0, 8).map((change: any, index: number) => (
                      <div key={`binding_change_${index}`} style={{ border: "1px solid #240000", borderRadius: 8, padding: 8 }}>
                        <div style={{ color: "#ffdada", fontWeight: 700 }}>{change.engine || "runtime"} · {change.path || "binding"}</div>
                        <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 4 }}>{change.summary || change.reason || "Pending cleanup."}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, color: "#ffb3f0", fontSize: 12 }}>No cleanup actions are pending right now.</div>
                )}
              </div>
            ) : null;
          })()}
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {[
              ["Env Errors", engineHealth.validation.env?.errors?.length || 0, (engineHealth.validation.env?.errors?.length || 0) === 0],
              ["Env Warnings", engineHealth.validation.env?.warnings?.length || 0, (engineHealth.validation.env?.warnings?.length || 0) === 0],
              ["Missing Intents", engineHealth.validation.intents?.missingRequired?.length || 0, (engineHealth.validation.intents?.missingRequired?.length || 0) === 0],
              ["Missing Bindings", engineHealth.validation.bindings?.totals?.missing || 0, (engineHealth.validation.bindings?.totals?.missing || 0) === 0],
              ["Configured Bindings", engineHealth.validation.bindings?.totals?.configured || 0, true],
              ["Provider Bridge", engineHealth.validation.bridge?.status || "unknown", engineHealth.validation.bridge?.ok],
            ].map(([label, value, ok]) => (
              <div key={String(label)} style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>{label}</div>
                <div style={{ fontWeight: 800, marginTop: 6, color: validationTone(ok as boolean | null | undefined) }}>{String(value)}</div>
              </div>
            ))}
          </div>

          {Array.isArray(engineHealth.validation.intents?.missingRequired) && engineHealth.validation.intents.missingRequired.length > 0 ? (
            <div style={{ marginTop: 12, color: "#ffbdbd", fontSize: 12 }}>
              Missing required intents: {engineHealth.validation.intents.missingRequired.join(", ")}
            </div>
          ) : null}

          {Array.isArray(engineHealth.validation.env?.errors) && engineHealth.validation.env.errors.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#ff8c8c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Env Errors
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {engineHealth.validation.env.errors.slice(0, 8).map((entry: string, index: number) => (
                  <div key={`env_error_${index}`} style={{ border: "1px solid #300000", borderRadius: 8, padding: 8, background: "#0f0f0f", color: "#ffbdbd", fontSize: 12 }}>
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {Array.isArray(engineHealth.validation.bindings?.issues) && engineHealth.validation.bindings.issues.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: "#ff8c8c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Missing or Invalid Guild Bindings
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {engineHealth.validation.bindings.issues.slice(0, 10).map((issue: any, index: number) => (
                  <div key={`binding_issue_${index}`} style={{ border: "1px solid #300000", borderRadius: 8, padding: 8, background: "#0f0f0f" }}>
                    <div style={{ color: "#ffdada", fontWeight: 700 }}>
                      {issue.engine || "runtime"} · {issue.path || issue.kind || "binding"}
                    </div>
                    <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 4 }}>
                      {issue.error || "Configured binding is invalid."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {engineFailures && (
        <div style={box}>
          <h3 style={{ marginTop: 0, color: "#ff4444" }}>Runtime Failure Dashboard</h3>
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {[
              ["Monitored Engines", engineFailures.summary?.monitoredEngines || 0],
              ["Failing", engineFailures.summary?.failing || 0],
              ["Warnings", engineFailures.summary?.warning || 0],
              ["Disabled", engineFailures.summary?.disabled || 0],
              ["Process Failures", engineFailures.summary?.processFailures || 0],
              ["Failure Inbox", engineFailures.summary?.inboxFailures || 0],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ff8c8c" }}>{label}</div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>

          {Array.isArray(engineFailures.processFailures) && engineFailures.processFailures.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: "#ff8c8c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Process Failures
              </div>
              <div style={{ maxHeight: 220, overflow: "auto", background: "#0f0f0f", borderRadius: 10, padding: 10 }}>
                {engineFailures.processFailures.slice(0, 12).map((item: any, index: number) => (
                  <div key={`${item.at || index}_${index}`} style={{ marginBottom: 10, borderBottom: "1px solid #220000", paddingBottom: 8 }}>
                    <div style={{ color: "#ffdada", fontWeight: 700 }}>{item.source || "runtime"} {item.label ? `· ${item.label}` : ""}</div>
                    <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 4 }}>{item.error}</div>
                    <div style={{ color: "#caa", fontSize: 11, marginTop: 4 }}>{item.at || "Unknown time"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
            {[...(engineFailures.engines || [])]
              .sort((a: any, b: any) => {
                const rank = (status: string) => ({ failing: 0, warning: 1, healthy: 2, disabled: 3 }[status] ?? 4);
                return rank(a?.status) - rank(b?.status);
              })
              .map((engine: any) => (
                <div key={engine.engine} style={{ background: "#0f0f0f", borderRadius: 12, padding: 12, border: "1px solid #300000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#ffdada", fontWeight: 800 }}>{engine.displayName}</div>
                      <div style={{ color: severityColor(engine.status), fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
                        {engine.status}
                      </div>
                    </div>
                    <div style={{ color: "#ffbdbd", fontSize: 12 }}>
                      {engine.failureCount || 0} failures · {engine.issueCount || 0} issues
                    </div>
                  </div>

                  {Array.isArray(engine.issues) && engine.issues.length ? (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {engine.issues.slice(0, 4).map((entry: any, index: number) => (
                        <div key={`${engine.engine}_${entry.title}_${index}`} style={{ border: "1px solid #240000", borderRadius: 8, padding: 8 }}>
                          <div style={{ color: severityColor(entry.severity === "error" ? "failing" : entry.severity === "warning" ? "warning" : "healthy"), fontWeight: 700 }}>
                            {entry.title}
                          </div>
                          <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 4 }}>{entry.detail}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, color: "#ffb3f0", fontSize: 12 }}>No current blockers detected.</div>
                  )}

                  {Array.isArray(engine.failures) && engine.failures.length ? (
                    <div style={{ marginTop: 10, border: "1px solid #240000", borderRadius: 8, padding: 8 }}>
                      {engine.failures.slice(0, 3).map((failure: any, index: number) => (
                        <div key={`${engine.engine}_failure_${index}`} style={{ marginBottom: index < Math.min(engine.failures.length, 3) - 1 ? 8 : 0 }}>
                          <div style={{ color: "#ffdada", fontWeight: 700 }}>{failure.event || "runtime"}</div>
                          <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 4 }}>{failure.error}</div>
                          <div style={{ color: "#caa", fontSize: 11, marginTop: 4 }}>
                            {failure.at || "Unknown time"}{failure.requestId ? ` · req ${failure.requestId}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(engine.recoveryActions || []).map((action: any) => (
                      <button
                        key={`${engine.engine}_${action.action}`}
                        onClick={() => void runEngineRecovery(engine.engine, action.action)}
                        style={{
                          borderRadius: 999,
                          padding: "7px 11px",
                          fontSize: 12,
                          cursor: "pointer",
                          ...actionStyle(action.tone || "secondary"),
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                    {ENGINE_ROUTE_MAP[engine.engine] ? (
                      <Link
                        href={`${ENGINE_ROUTE_MAP[engine.engine]}?guildId=${encodeURIComponent(guildId)}`}
                        style={{
                          borderRadius: 999,
                          padding: "7px 11px",
                          fontSize: 12,
                          textDecoration: "none",
                          ...actionStyle("secondary"),
                        }}
                      >
                        Open Engine
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {eventReactorFailures.length > 0 && (
        <div style={box}>
          <h3 style={{ marginTop: 0, color: "#ff4444" }}>Event Reactor Failures</h3>
          <div style={{ maxHeight: 260, overflow: "auto", fontSize: 12, background: "#111", padding: 8, borderRadius: 8 }}>
            {eventReactorFailures.map((f: any, i: number) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div><b>{f.engine || "unknown"}</b> · {f.event || "event"} · {f.at || ""}</div>
                <div style={{ color: "#ffb0b0" }}>{f.error || f.message || "failure"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={box}>
        <b>Quick Links</b>
        <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href={`/dashboard/ai/memory?guildId=${guildId}`}>AI Memory</Link>
          <Link href={`/dashboard/settings/event-routing?guildId=${guildId}`}>Event Routing</Link>
          <Link href={`/dashboard/economy/radio-birthday?guildId=${guildId}`}>Radio</Link>
          <Link href={`/dashboard/achievements?guildId=${guildId}`}>Achievements + Prestige</Link>
        </div>
      </div>

      {runtime && (
        <div style={box}>
          <h3 style={{ marginTop: 0, color: "#ff4444" }}>Runtime Safety (Crash/Cooldown/Rate/Kill)</h3>
          <label><input type="checkbox" checked={!!runtime.active} onChange={(e) => setRuntime((p: any) => ({ ...p, active: e.target.checked }))} /> Active</label>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input style={input} type="number" value={runtime.crashGuard.maxRestartsPerHour} onChange={(e) => setRuntime((p: any) => ({ ...p, crashGuard: { ...p.crashGuard, maxRestartsPerHour: Number(e.target.value || 0) } }))} placeholder="maxRestartsPerHour" />
            <input style={input} type="number" value={runtime.crashGuard.cooldownSeconds} onChange={(e) => setRuntime((p: any) => ({ ...p, crashGuard: { ...p.crashGuard, cooldownSeconds: Number(e.target.value || 0) } }))} placeholder="cooldownSeconds" />
            <input style={input} type="number" value={runtime.rateLimits.commandPerMinute} onChange={(e) => setRuntime((p: any) => ({ ...p, rateLimits: { ...p.rateLimits, commandPerMinute: Number(e.target.value || 0) } }))} placeholder="commandPerMinute" />
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label><input type="checkbox" checked={!!runtime.emergency.globalReadOnly} onChange={(e) => setRuntime((p: any) => ({ ...p, emergency: { ...p.emergency, globalReadOnly: e.target.checked } }))} /> Global Read-Only</label>
            <label><input type="checkbox" checked={!!runtime.emergency.disableAi} onChange={(e) => setRuntime((p: any) => ({ ...p, emergency: { ...p.emergency, disableAi: e.target.checked } }))} /> Disable AI</label>
            <label><input type="checkbox" checked={!!runtime.emergency.disableTts} onChange={(e) => setRuntime((p: any) => ({ ...p, emergency: { ...p.emergency, disableTts: e.target.checked } }))} /> Disable TTS</label>
            <label><input type="checkbox" checked={!!runtime.emergency.disableGames} onChange={(e) => setRuntime((p: any) => ({ ...p, emergency: { ...p.emergency, disableGames: e.target.checked } }))} /> Disable Games</label>
            <label><input type="checkbox" checked={!!runtime.emergency.disableAutomation} onChange={(e) => setRuntime((p: any) => ({ ...p, emergency: { ...p.emergency, disableAutomation: e.target.checked } }))} /> Disable Automation</label>
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={saveRuntime}>Save Runtime Safety</button>
          </div>
        </div>
      )}

      {auditCfg && (
        <div style={box}>
          <h3 style={{ marginTop: 0, color: "#ff4444" }}>Audit Trail Config</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input style={input} type="number" value={auditCfg.retainDays} onChange={(e) => setAuditCfg((p: any) => ({ ...p, retainDays: Number(e.target.value || 0) }))} placeholder="retainDays" />
            <input style={input} value={auditCfg.exportChannelId || ""} onChange={(e) => setAuditCfg((p: any) => ({ ...p, exportChannelId: e.target.value }))} placeholder="exportChannelId" />
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label><input type="checkbox" checked={!!auditCfg.include.featureToggles} onChange={(e) => setAuditCfg((p: any) => ({ ...p, include: { ...p.include, featureToggles: e.target.checked } }))} /> Feature Toggles</label>
            <label><input type="checkbox" checked={!!auditCfg.include.configSaves} onChange={(e) => setAuditCfg((p: any) => ({ ...p, include: { ...p.include, configSaves: e.target.checked } }))} /> Config Saves</label>
            <label><input type="checkbox" checked={!!auditCfg.include.moderation} onChange={(e) => setAuditCfg((p: any) => ({ ...p, include: { ...p.include, moderation: e.target.checked } }))} /> Moderation</label>
            <label><input type="checkbox" checked={!!auditCfg.include.economy} onChange={(e) => setAuditCfg((p: any) => ({ ...p, include: { ...p.include, economy: e.target.checked } }))} /> Economy</label>
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={saveAudit}>Save Audit Config</button>
          </div>
        </div>
      )}

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Audit Trail (Config Change History)</h3>
        <button onClick={() => loadAll(guildId)}>Refresh</button>
        <div style={{ marginTop: 8, maxHeight: 240, overflow: "auto", fontSize: 12, background: "#111", padding: 8, borderRadius: 8 }}>
          {auditEvents.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 6 }}>
              [{e.at}] {e.area} {e.action} {Array.isArray(e.keys) ? `(${e.keys.join(", ")})` : ""}
            </div>
          ))}
          {auditEvents.length === 0 && <div>No audit events yet.</div>}
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Live Logs Viewer</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select style={input} value={logKind} onChange={(e) => setLogKind(e.target.value)}>
            <option value="dash-error">dash-error</option>
            <option value="dash-out">dash-out</option>
            <option value="bot-error">bot-error</option>
            <option value="bot-out">bot-out</option>
          </select>
          <button onClick={refreshLogs}>Refresh Log</button>
        </div>
        <pre style={{ background: "#0b0b0b", color: "#ffc4c4", padding: 10, borderRadius: 8, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap" }}>
{logLines.join("\n")}
        </pre>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0, color: "#ff4444" }}>Snapshots (Backup Surface)</h3>
        <button onClick={createSnapshot}>Create Snapshot</button>
        <div style={{ marginTop: 8, maxHeight: 220, overflow: "auto", background: "#111", padding: 8, borderRadius: 8 }}>
          {(snapshots || []).map((s: any, i: number) => (
            <div key={i} style={{ marginBottom: 6 }}>
              {typeof s === "string" ? s : JSON.stringify(s)}
            </div>
          ))}
          {(!snapshots || snapshots.length === 0) && <div>No snapshots returned.</div>}
        </div>
      </div>
    </div>
  );
}
