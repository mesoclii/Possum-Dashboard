"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type StatusState = "online" | "maintenance" | "offline";
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

function colorForStatus(status: StatusState) {
  if (status === "online") return { border: "#ff2bd6", text: "#ffd1f5", bg: "rgba(255,43,214,0.18)" };
  if (status === "maintenance") return { border: "#ff2a4d", text: "#ffd1f5", bg: "rgba(255,42,77,0.2)" };
  return { border: "#7a1010", text: "#ffc0c0", bg: "rgba(120,0,0,0.22)" };
}

export default function StatusPage() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
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
      setSession({
        loggedIn: Boolean(sessionJson?.loggedIn),
        isMasterOwner: Boolean(sessionJson?.isMasterOwner),
        user: sessionJson?.user || null,
      });
    })();
  }, []);

  const canEdit = session.loggedIn && session.isMasterOwner;
  const overallTone = useMemo(() => colorForStatus(status?.overall || "online"), [status?.overall]);

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
                This page is for clean public visibility. It shows whether the bot and its main engine surfaces are
                online, offline, or under maintenance. Logged-in master owner sessions can update the board live.
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
                Overall
              </div>
              <div style={{ color: overallTone.text, fontSize: 34, fontWeight: 900, textTransform: "uppercase", marginTop: 8 }}>
                {status?.overall || "online"}
              </div>
              <div style={{ color: "#ffd4d4", marginTop: 10 }}>{status?.headline || "Loading system status..."}</div>
            </div>
          </div>
          {message ? <div style={{ color: "#ffd37a", marginTop: 14 }}>{message}</div> : null}
        </section>

        {status ? (
          <>
            <section style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(320px,0.9fr)", gap: 18 }}>
                <div>
                  <div style={{ color: "#ff9c9c", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                    Public Message
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
                      This status board is public. Only the master owner login can change it.
                    </div>
                  </div>
                )}
              </div>
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
