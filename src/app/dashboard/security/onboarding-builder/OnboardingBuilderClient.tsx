"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { resolveGuildContext, fetchRuntimeEngine, saveRuntimeEngine, fetchGuildData, runRuntimeEngineAction } from "@/lib/liveRuntime";

type GuildRole = { id: string; name: string; position?: number };
type GuildChannel = { id: string; name: string; type?: number | string };

const box: CSSProperties = { border: "1px solid #650000", borderRadius: 12, padding: 16, marginBottom: 14, background: "rgba(100,0,0,0.10)" };
const input: CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", border: "1px solid #700000", color: "#ffd7d7", borderRadius: 8 };

export default function OnboardingBuilderClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [onboarding, setOnboarding] = useState<Record<string, any>>({});
  const [verification, setVerification] = useState<Record<string, any>>({});
  const [tickets, setTickets] = useState<Record<string, any>>({});
  const [selfroles, setSelfroles] = useState<Record<string, any>>({});
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [roles, setRoles] = useState<GuildRole[]>([]);
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
      const [onboardingJson, verificationJson, ticketsJson, selfrolesJson, guildJson] = await Promise.all([
        fetchRuntimeEngine(targetGuildId, "onboarding"),
        fetchRuntimeEngine(targetGuildId, "verification"),
        fetchRuntimeEngine(targetGuildId, "tickets"),
        fetchRuntimeEngine(targetGuildId, "selfroles"),
        fetchGuildData(targetGuildId),
      ]);
      setOnboarding(onboardingJson?.config || {});
      setVerification(verificationJson?.config || {});
      setTickets(ticketsJson?.config || {});
      setSelfroles(selfrolesJson?.config || {});
      setChannels(Array.isArray(guildJson.channels) ? guildJson.channels : []);
      setRoles(Array.isArray(guildJson.roles) ? guildJson.roles : []);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load onboarding stack.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  async function saveEngine(engine: "onboarding" | "verification" | "tickets" | "selfroles", patch: Record<string, unknown>, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      const json = await saveRuntimeEngine(guildId, engine, patch);
      const next = json?.config || {};
      if (engine === "onboarding") setOnboarding(next);
      if (engine === "verification") setVerification(next);
      if (engine === "tickets") setTickets(next);
      if (engine === "selfroles") setSelfroles(next);
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(engine: "tickets" | "selfroles", action: string, okLabel: string) {
    if (!guildId) return;
    try {
      setSaving(true);
      setMessage("");
      await runRuntimeEngineAction(guildId, engine, action);
      await loadAll(guildId);
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  const textChannels = channels.filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5);
  const categories = channels.filter((channel) => Number(channel.type) === 4);

  if (!guildId && !loading) return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from `/guilds` first.</div>;

  return (
    <div style={{ color: "#ff5a5a", maxWidth: 1300 }}>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.14em" }}>Onboarding Builder</h1>
            <p style={{ margin: "6px 0 0" }}>Guild: {guildName || guildId}</p>
            <div style={{ color: "#ffb3b3", fontSize: 12 }}>
              This page now orchestrates the live onboarding, verification, tickets, and selfroles engines together instead of saving to a dead builder file.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/dashboard/security/onboarding?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Onboarding Console</Link>
            <Link href={`/dashboard/security/verification?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Verification Console</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={box}>Loading onboarding stack...</div> : null}

      {!loading ? (
        <>
          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Engine Toggles</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 10 }}>
              <label><input type="checkbox" checked={Boolean(onboarding.enabled)} onChange={(event) => void saveEngine("onboarding", { enabled: event.target.checked }, `Onboarding ${event.target.checked ? "enabled" : "disabled"}.`)} /> Onboarding enabled</label>
              <label><input type="checkbox" checked={Boolean(verification.enabled)} onChange={(event) => void saveEngine("verification", { enabled: event.target.checked }, `Verification ${event.target.checked ? "enabled" : "disabled"}.`)} /> Verification enabled</label>
              <label><input type="checkbox" checked={Boolean(tickets.active)} onChange={(event) => void saveEngine("tickets", { active: event.target.checked }, `Tickets ${event.target.checked ? "enabled" : "disabled"}.`)} /> Gate tickets enabled</label>
              <label><input type="checkbox" checked={Boolean(selfroles.active)} onChange={(event) => void saveEngine("selfroles", { active: event.target.checked }, `Selfroles ${event.target.checked ? "enabled" : "disabled"}.`)} /> Selfroles enabled</label>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Step 1: Verification Routing</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Welcome channel</label>
                <select style={input} value={String(verification.welcomeChannelId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, welcomeChannelId: event.target.value }))}>
                  <option value="">(none)</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Rules channel</label>
                <select style={input} value={String(verification.rulesChannelId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, rulesChannelId: event.target.value }))}>
                  <option value="">(none)</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Main chat / unlocked area</label>
                <select style={input} value={String(verification.mainChatChannelId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, mainChatChannelId: event.target.value }))}>
                  <option value="">(none)</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Verified role</label>
                <select style={input} value={String(verification.verifiedRoleId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, verifiedRoleId: event.target.value }))}>
                  <option value="">(none)</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("verification", verification, "Saved verification routing.")}>Save Verification Routing</button>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Step 2: Optional ID Onboarding Routing</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>ID verification channel</label>
                <select style={input} value={String(onboarding.idChannelId || "")} onChange={(event) => setOnboarding((prev) => ({ ...prev, idChannelId: event.target.value }))}>
                  <option value="">(none)</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Ticket category</label>
                <select style={input} value={String(onboarding.ticketCategoryId || "")} onChange={(event) => setOnboarding((prev) => ({ ...prev, ticketCategoryId: event.target.value }))}>
                  <option value="">(none)</option>
                  {categories.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Transcript channel</label>
                <select style={input} value={String(onboarding.transcriptChannelId || "")} onChange={(event) => setOnboarding((prev) => ({ ...prev, transcriptChannelId: event.target.value }))}>
                  <option value="">(none)</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Log channel</label>
                <select style={input} value={String(onboarding.logChannelId || "")} onChange={(event) => setOnboarding((prev) => ({ ...prev, logChannelId: event.target.value }))}>
                  <option value="">(none)</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("onboarding", onboarding, "Saved onboarding routing.")}>Save Onboarding Routing</button>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Roles + Verification Policy</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label>Verified role</label>
                <select style={input} value={String(verification.verifiedRoleId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, verifiedRoleId: event.target.value }))}>
                  <option value="">(none)</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <label>Decline role</label>
                <select style={input} value={String(onboarding.declineRoleId || verification.declineRoleId || "")} onChange={(event) => setOnboarding((prev) => ({ ...prev, declineRoleId: event.target.value }))}>
                  <option value="">(none)</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
                </select>
              </div>
              <div>
                <label>ID timeout minutes</label>
                <input style={input} type="number" value={Number(onboarding.idTimeoutMinutes || 30)} onChange={(event) => setOnboarding((prev) => ({ ...prev, idTimeoutMinutes: Number(event.target.value || 0) }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(180px,1fr))", gap: 10, marginTop: 10 }}>
              <label><input type="checkbox" checked={Boolean(verification.autoKickOnDecline)} onChange={(event) => setVerification((prev) => ({ ...prev, autoKickOnDecline: event.target.checked }))} /> Auto-kick on decline</label>
              <label><input type="checkbox" checked={Boolean(verification.autoKickOnTimeout)} onChange={(event) => setVerification((prev) => ({ ...prev, autoKickOnTimeout: event.target.checked }))} /> Auto-kick on timeout</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Decline kick reason</label>
                <input style={input} value={String(verification.declineKickReason || "")} onChange={(event) => setVerification((prev) => ({ ...prev, declineKickReason: event.target.value }))} />
              </div>
              <div>
                <label>Timeout kick reason</label>
                <input style={input} value={String(verification.timeoutKickReason || "")} onChange={(event) => setVerification((prev) => ({ ...prev, timeoutKickReason: event.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("verification", verification, "Saved verification policy.")}>Save Verification Policy</button>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Verification Copy + Panel Deploys</h3>
            <div style={{ marginBottom: 10 }}>
              <label>Welcome DM template</label>
              <textarea style={{ ...input, minHeight: 80 }} value={String(verification.dmTemplate || "")} onChange={(event) => setVerification((prev) => ({ ...prev, dmTemplate: event.target.value }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>Verification panel title</label>
              <input style={input} value={String(verification.panelTitle || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelTitle: event.target.value }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>Verification panel description</label>
              <textarea style={{ ...input, minHeight: 80 }} value={String(verification.panelDescription || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelDescription: event.target.value }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>Verification panel footer</label>
              <input style={input} value={String(verification.panelFooter || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelFooter: event.target.value }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>Gate announcement template</label>
              <textarea style={{ ...input, minHeight: 80 }} value={String(verification.gateAnnouncementTemplate || "")} onChange={(event) => setVerification((prev) => ({ ...prev, gateAnnouncementTemplate: event.target.value }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label>Post-verified message</label>
              <textarea style={{ ...input, minHeight: 80 }} value={String(onboarding.postVerifyTemplate || "")} onChange={(event) => setOnboarding((prev) => ({ ...prev, postVerifyTemplate: event.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("verification", verification, "Saved verification templates.")}>Save Verification Copy</button>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("onboarding", onboarding, "Saved post-verified onboarding copy.")}>Save Post-Verified Copy</button>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void runAction("tickets", "deployPanel", "Deployed tickets panel.")}>Deploy Tickets Panel</button>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void runAction("selfroles", "deployPanels", "Deployed selfroles panels.")}>Deploy Selfroles</button>
              <Link href={`/dashboard/tickets?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Tickets</Link>
              <Link href={`/dashboard/selfroles?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Selfroles</Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
