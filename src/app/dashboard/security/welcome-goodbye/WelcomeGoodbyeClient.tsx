"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { resolveGuildContext, fetchRuntimeEngine, saveRuntimeEngine, fetchGuildData } from "@/lib/liveRuntime";

type Channel = { id: string; name: string; type?: number | string };

const panel: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  marginBottom: 14,
  background: "rgba(120,0,0,0.09)",
};

const input: CSSProperties = {
  width: "100%",
  background: "#0c0c0c",
  color: "#ffd6d6",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "9px 10px",
};

export default function WelcomeGoodbyeClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [verification, setVerification] = useState<Record<string, any>>({});
  const [moderator, setModerator] = useState<Record<string, any>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolved = resolveGuildContext();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
  }, []);

  async function loadAll(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const [verificationJson, moderatorJson, guildJson] = await Promise.all([
        fetchRuntimeEngine(targetGuildId, "verification"),
        fetchRuntimeEngine(targetGuildId, "moderator"),
        fetchGuildData(targetGuildId),
      ]);
      setVerification(verificationJson?.config || {});
      setModerator(moderatorJson?.config || {});
      setChannels(Array.isArray(guildJson.channels) ? guildJson.channels : []);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load welcome/goodbye runtime.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  async function saveVerification(okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, "verification", verification);
      setVerification(json?.config || {});
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveModerator(okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, "moderator", moderator);
      setModerator(json?.config || {});
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const textChannels = channels.filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5);

  const welcomePreview = useMemo(() => String(verification.dmTemplate || "")
    .replaceAll("{{guildName}}", guildName || "Your Server")
    .replaceAll("{{userId}}", "@NewMember")
    .replaceAll("{{welcomeChannelId}}", "#welcome"), [verification, guildName]);

  if (!guildId && !loading) return <div style={{ color: "#ff6b6b", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;

  return (
    <div style={{ color: "#ffb3b3", padding: 18, maxWidth: 1240 }}>
      <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, color: "#ff3b3b", letterSpacing: "0.09em", textTransform: "uppercase" }}>Welcome + Goodbye</h1>
            <div style={{ marginTop: 8 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>
              This page now shows the live verification welcome gate the bot actually uses. Goodbye handling in this bot is moderator/audit logging, not a separate custom message engine.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/security/verification?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Verification</Link>
            <Link href={`/dashboard/security/onboarding?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Onboarding</Link>
            <Link href={`/dashboard/moderator?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Moderator</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={panel}>Loading welcome/goodbye runtime...</div> : null}

      {!loading ? (
        <>
          <div style={panel}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Welcome Flow</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Welcome channel</label>
                <select style={input} value={String(verification.welcomeChannelId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, welcomeChannelId: event.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Main chat channel</label>
                <select style={input} value={String(verification.mainChatChannelId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, mainChatChannelId: event.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Rules channel</label>
                <select style={input} value={String(verification.rulesChannelId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, rulesChannelId: event.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Welcome DM / gate message</label>
              <textarea style={{ ...input, minHeight: 90 }} value={String(verification.dmTemplate || "")} onChange={(event) => setVerification((prev) => ({ ...prev, dmTemplate: event.target.value }))} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Welcome panel title</label>
              <input style={input} value={String(verification.panelTitle || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelTitle: event.target.value }))} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Welcome panel description</label>
              <textarea style={{ ...input, minHeight: 90 }} value={String(verification.panelDescription || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelDescription: event.target.value }))} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Welcome panel footer</label>
              <input style={input} value={String(verification.panelFooter || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelFooter: event.target.value }))} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Gate announcement / hero line</label>
              <textarea style={{ ...input, minHeight: 90 }} value={String(verification.gateAnnouncementTemplate || "")} onChange={(event) => setVerification((prev) => ({ ...prev, gateAnnouncementTemplate: event.target.value }))} />
            </div>
            <div style={{ marginTop: 10, border: "1px solid #5f0000", borderRadius: 8, padding: 10, background: "#120000" }}>
              {welcomePreview || "Welcome preview"}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving} onClick={() => void saveVerification("Saved verification welcome flow.")}>
                {saving ? "Saving..." : "Save Welcome"}
              </button>
            </div>
          </div>

          <div style={panel}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Goodbye Handling</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
              This bot currently handles departures through moderator logging. There is no separate live goodbye-message template path to edit.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(moderator?.logging?.memberLeft)} onChange={(event) => setModerator((prev) => ({ ...prev, logging: { ...(prev.logging || {}), memberLeft: event.target.checked } }))} /> Log member-left events</label>
              <div>
                <label>Moderator log channel</label>
                <select style={input} value={String(moderator?.logging?.logChannelId || "")} onChange={(event) => setModerator((prev) => ({ ...prev, logging: { ...(prev.logging || {}), logChannelId: event.target.value } }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving} onClick={() => void saveModerator("Saved goodbye audit routing.")}>
                {saving ? "Saving..." : "Save Goodbye Handling"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
