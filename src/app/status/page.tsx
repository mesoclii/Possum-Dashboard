"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { PublicLiveHealth, LiveHealthStatus } from "@/lib/publicLiveHealth";

type StatusState = "online" | "maintenance" | "offline" | "unknown";
type ServiceStatus = {
  id: string;
  label: string;
  summary: string;
  status: StatusState;
  updatedAt: string;
};
type PublicStatus = {
  overall: StatusState;
  headline: string;
  message: string;
  updatedAt: string;
  services: ServiceStatus[];
};
type SessionState = {
  loggedIn: boolean;
  isMasterOwner: boolean;
  user?: { id: string; username: string; globalName: string | null } | null;
};

const shell: CSSProperties = {
  minHeight: "100vh",
  background:
    "transparent",
  color: "#ffd9d9",
  padding: "32px 24px 60px",
};

const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,0.34)",
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(110,0,0,0.18), rgba(0,0,0,0.72))",
  padding: 18,
};

function colorForStatus(status: StatusState | LiveHealthStatus) {
  if (status === "online") return { border: "#ff2bd6", text: "#ffd1f5", bg: "rgba(255,43,214,0.18)" };
  if (status === "maintenance") return { border: "#ff2a4d", text: "#ffd1f5", bg: "rgba(255,42,77,0.2)" };
  if (status === "offline") return { border: "#7a1010", text: "#ffc0c0", bg: "rgba(120,0,0,0.22)" };
  return { border: "#665d7a", text: "#ded7f1", bg: "rgba(80,70,105,0.2)" };
}

export default function StatusPage() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [liveHealth, setLiveHealth] = useState<PublicLiveHealth | null>(null);
  const [session, setSession] = useState<SessionState>({ loggedIn: false, isMasterOwner: false });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [statusRes, sessionRes] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }).catch(() => null),
        fetch("/api/auth/session?brief=1", { cache: "no-store" }).catch(() => null),
      ]);
      const statusJson = await statusRes?.json().catch(() => ({}));
      const sessionJson = await sessionRes?.json().catch(() => ({}));
      setStatus(statusJson?.status || null);
      setLiveHealth(statusJson?.liveHealth || null);
      setSession({
        loggedIn: Boolean(sessionJson?.loggedIn),
        isMasterOwner: Boolean(sessionJson?.isMasterOwner),
        user: sessionJson?.user || null,
      });
    })();
  }, []);

  const canEdit = session.loggedIn && session.isMasterOwner;
  const overallTone = useMemo(() => colorForStatus(status?.overall || "unknown"), [status?.overall]);
  const liveTone = useMemo(() => colorForStatus(liveHealth?.status || "unknown"), [liveHealth?.status]);

  async function saveStatus() {
    if (!canEdit || !status) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Failed to save public status.");
      }
      setStatus(json.status || status);
      setMessage("Public status updated.");
    } catch (error: any) {
      setMessage(error?.message || "Failed to save public status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={shell}>
      <div style={{ maxWidth: 1380, margin: "0 auto" }}>
        <section style={{ ...card, marginBottom: 20, padding: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ color: "#ff9c9c", fontSize: 14, letterSpacing: "0.24em", textTransform: "uppercase" }}>
                Live System Status
              </div>
              <h1
                style={{
                  margin: "10px 0 12px",
                  color: "#ff4545",
                  fontSize: "clamp(2.7rem, 6vw, 5.2rem)",
                  lineHeight: 0.94,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  textShadow: "0 0 24px rgba(255,0,0,0.42)",
                }}
              >
                Possum
                <br />
                Status
                <br />
                Board
              </h1>
              <div style={{ maxWidth: 900, color: "#ffd5d5", lineHeight: 1.7 }}>
                Live runtime checks come from the Operations Agent. The public status below is an owner-published notice;
                it is kept separate from measured service health. Logged-in master owner sessions can update that notice.
              </div>
            </div>

            <div
              style={{
                ...card,
                margin: 0,
                minWidth: 260,
                borderColor: overallTone.border,
                background: overallTone.bg,
              }}
            >
              <div style={{ color: "#ffb2b2", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                Owner-published status
              </div>
              <div style={{ color: overallTone.text, fontSize: 34, fontWeight: 900, textTransform: "uppercase", marginTop: 8 }}>
                {status?.overall || "unknown"}
              </div>
              <div style={{ color: "#ffd4d4", marginTop: 10 }}>{status?.headline || "Loading system status..."}</div>
            </div>
          </div>
          {message ? <div style={{ color: "#ffd37a", marginTop: 14 }}>{message}</div> : null}
        </section>

        <section style={{ ...card, marginBottom: 20, borderColor: liveTone.border, background: liveTone.bg }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#ff9c9c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                Live Runtime Checks · Operations Agent
              </div>
              <div style={{ color: liveTone.text, fontSize: 27, fontWeight: 900, textTransform: "uppercase", marginTop: 8 }}>
                {liveHealth?.status || "unknown"}
              </div>
              <div style={{ color: "#ffd4d4", marginTop: 8 }}>
                {liveHealth?.message || "Live health data is loading."}
              </div>
              <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 8 }}>
                Sample: {liveHealth?.checkedAt ? new Date(liveHealth.checkedAt).toLocaleString() : "unavailable"}
                {liveHealth ? ` · ${liveHealth.freshness}` : ""}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, flex: "1 1 620px" }}>
              {(liveHealth?.checks || []).map((check) => {
                const tone = colorForStatus(check.status);
                return (
                  <div key={check.id} style={{ border: `1px solid ${tone.border}`, borderRadius: 12, padding: 12, background: "rgba(0,0,0,0.28)" }}>
                    <div style={{ color: "#ffd7d7", fontWeight: 800 }}>{check.label}</div>
                    <div style={{ color: tone.text, fontSize: 12, fontWeight: 900, marginTop: 6, textTransform: "uppercase" }}>{check.status}</div>
                    <div style={{ color: "#ffb7b7", fontSize: 11, marginTop: 6 }}>
                      {check.checkedAt ? `Checked ${new Date(check.checkedAt).toLocaleTimeString()}` : "No verified sample"}
                    </div>
                  </div>
                );
              })}
              {!liveHealth ? <div style={{ color: "#ffd4d4" }}>No verified live checks are available.</div> : null}
            </div>
          </div>
        </section>

        {status ? (
          <>
            <section style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(320px,0.9fr)", gap: 18 }}>
                <div>
                  <div style={{ color: "#ff9c9c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                    Owner-published Message
                  </div>
                  <div style={{ color: "#ffd7d7", fontSize: 24, fontWeight: 900, marginTop: 10 }}>{status.headline}</div>
                  <div style={{ color: "#ffd0d0", lineHeight: 1.7, marginTop: 12 }}>{status.message}</div>
                  <div style={{ color: "#ffb7b7", fontSize: 12, marginTop: 12 }}>
                    Last updated: {status.updatedAt ? new Date(status.updatedAt).toLocaleString() : "Not updated yet"}
                  </div>
                </div>

                {canEdit ? (
                  <div style={{ ...card, margin: 0 }}>
                    <div style={{ color: "#ff9c9c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Owner Controls
                    </div>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <select
                        value={status.overall}
                        onChange={(event) => setStatus((prev) => (prev ? { ...prev, overall: event.target.value as StatusState } : prev))}
                        style={{ background: "#0b0b0b", color: "#ffd7d7", border: "1px solid rgba(255,0,0,0.4)", borderRadius: 10, padding: 12 }}
                      >
                        <option value="unknown">Not reported</option>
                        <option value="online">Online</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="offline">Offline</option>
                      </select>
                      <input
                        value={status.headline}
                        onChange={(event) => setStatus((prev) => (prev ? { ...prev, headline: event.target.value } : prev))}
                        style={{ background: "#0b0b0b", color: "#ffd7d7", border: "1px solid rgba(255,0,0,0.4)", borderRadius: 10, padding: 12 }}
                        placeholder="Headline"
                      />
                      <textarea
                        value={status.message}
                        onChange={(event) => setStatus((prev) => (prev ? { ...prev, message: event.target.value } : prev))}
                        style={{ minHeight: 110, background: "#0b0b0b", color: "#ffd7d7", border: "1px solid rgba(255,0,0,0.4)", borderRadius: 10, padding: 12 }}
                      />
                      <button
                        type="button"
                        onClick={() => void saveStatus()}
                        disabled={saving}
                        style={{
                          borderRadius: 12,
                          border: "1px solid #ff3f3f",
                          background: "linear-gradient(90deg, #ff3f3f, #ff7f3f)",
                          color: "#1c0000",
                          padding: "12px 14px",
                          fontWeight: 900,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          cursor: saving ? "wait" : "pointer",
                        }}
                      >
                        {saving ? "Saving..." : "Save Public Status"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ ...card, margin: 0 }}>
                    <div style={{ color: "#ff9c9c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Visibility
                    </div>
                    <div style={{ color: "#ffd0d0", lineHeight: 1.7, marginTop: 12 }}>
                      This owner-published notice is public. Only the master owner login can change it; live checks are shown separately above.
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section style={{ marginBottom: 10 }}>
              <p style={{ color: "#ffb7b7", fontSize: 12, margin: "0 0 12px" }}>
                These service labels are owner-published notices. Use Live Runtime Checks above for monitored API, gateway, and database health.
              </p>
            </section>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              {status.services.map((service) => {
                const tone = colorForStatus(service.status);
                return (
                  <div key={service.id} style={{ ...card, borderColor: tone.border, background: tone.bg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ color: "#ff5454", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {service.label}
                      </div>
                      <div
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${tone.border}`,
                          background: tone.bg,
                          color: tone.text,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {service.status}
                      </div>
                    </div>
                    <div style={{ color: "#ffd4d4", lineHeight: 1.6, marginTop: 10 }}>{service.summary}</div>
                    {canEdit ? (
                      <select
                        value={service.status}
                        onChange={(event) =>
                          setStatus((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  services: prev.services.map((row) =>
                                    row.id === service.id ? { ...row, status: event.target.value as StatusState } : row
                                  ),
                                }
                              : prev
                          )
                        }
                        style={{
                          width: "100%",
                          marginTop: 12,
                          background: "#0b0b0b",
                          color: "#ffd7d7",
                          border: "1px solid rgba(255,0,0,0.4)",
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <option value="unknown">Not reported</option>
                        <option value="online">Online</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="offline">Offline</option>
                      </select>
                    ) : null}
                  </div>
                );
              })}
            </section>
          </>
        ) : (
          <section style={card}>Loading status board...</section>
        )}
      </div>
    </div>
  );
}
