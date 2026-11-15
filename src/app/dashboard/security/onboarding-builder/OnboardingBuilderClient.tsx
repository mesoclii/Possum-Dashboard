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

  async function runAction(engine: "tickets" | "selfroles" | "onboarding" | "verification", action: string, okLabel: string) {
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
            <h3 style={{ marginTop: 0 }}>Ticket Panel Builder (18+ Gate)</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
              This is the gate message each member gets when they join: a rules button, a rules confirmation, then verify. Verifying opens their ID ticket in the Entry Tickets category; staff run the ID check there and grant access. Nothing stays pinned in the channel.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Panel channel</label>
                <select style={input} value={String(verification.panelChannelId || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelChannelId: event.target.value }))}>
                  <option value="">Use the welcome channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Panel image URL (optional)</label>
                <input style={input} value={String(verification.panelImageUrl || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelImageUrl: event.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Panel title</label>
              <input style={input} value={String(verification.panelTitle || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelTitle: event.target.value }))} placeholder="Welcome to the Safe Zone (18+)" />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Panel description</label>
              <textarea style={{ ...input, minHeight: 90 }} value={String(verification.panelDescription || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelDescription: event.target.value }))} placeholder="Read the rules, confirm you are 18 or older, then verify to enter." />
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Panel footer</label>
              <input style={input} value={String(verification.panelFooter || "")} onChange={(event) => setVerification((prev) => ({ ...prev, panelFooter: event.target.value }))} placeholder="Verification comes first. Onboarding comes after this step." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(200px,1fr))", gap: 10, marginTop: 10 }}>
              <div>
                <label>Verify button label</label>
                <input style={input} value={String(verification.verifyButtonLabel || "")} onChange={(event) => setVerification((prev) => ({ ...prev, verifyButtonLabel: event.target.value }))} placeholder="Enter The Safe Zone (18+)" />
              </div>
              <div>
                <label>Rules link button label</label>
                <input style={input} value={String(verification.rulesButtonLabel || "")} onChange={(event) => setVerification((prev) => ({ ...prev, rulesButtonLabel: event.target.value }))} placeholder="Open Rules" />
              </div>
              <div>
                <label>Rules confirm button label</label>
                <input style={input} value={String(verification.readRulesButtonLabel || "")} onChange={(event) => setVerification((prev) => ({ ...prev, readRulesButtonLabel: event.target.value }))} placeholder="I've Read the Survival Code" />
              </div>
              <div>
                <label>ID ticket button label</label>
                <input style={input} value={String(onboarding.idTicketButtonLabel || "")} onChange={(event) => setOnboarding((prev) => ({ ...prev, idTicketButtonLabel: event.target.value }))} placeholder="Open ID Verification Ticket" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(180px,1fr))", gap: 10, marginTop: 10 }}>
              <label><input type="checkbox" checked={verification.requireRulesRead !== false} onChange={(event) => setVerification((prev) => ({ ...prev, requireRulesRead: event.target.checked }))} /> Require the rules confirm button before verifying</label>
              <label><input type="checkbox" checked={onboarding.idFlowEnabled !== false} onChange={(event) => setOnboarding((prev) => ({ ...prev, idFlowEnabled: event.target.checked }))} /> Show the ID verification ticket button (age checks)</label>
            </div>
            <div style={{ border: "1px solid #700000", borderRadius: 10, padding: 14, marginTop: 12, background: "rgba(0,0,0,0.35)" }}>
              <div style={{ color: "#ffb3b3", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{String(verification.panelTitle || "Welcome to the Safe Zone (18+)")}</div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 6, color: "#ffd7d7" }}>
                {String(verification.panelDescription || "Read the rules, confirm you are 18 or older, then verify to enter.")}
              </div>
              <div style={{ color: "#ff9b9b", fontSize: 12, marginTop: 10 }}>
                {String(verification.panelFooter || "Verification comes first. Onboarding comes after this step.")}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <span style={{ ...input, width: "auto" }}>{String(verification.rulesButtonLabel || "Open Rules")}</span>
                {verification.requireRulesRead !== false ? <span style={{ ...input, width: "auto" }}>{String(verification.readRulesButtonLabel || "I've Read the Survival Code")}</span> : null}
                <span style={{ ...input, width: "auto" }}>{String(verification.verifyButtonLabel || "Enter The Safe Zone (18+)")}</span>
                {onboarding.idFlowEnabled !== false ? <span style={{ ...input, width: "auto" }}>{String(onboarding.idTicketButtonLabel || "Open ID Verification Ticket")}</span> : null}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("verification", verification, "Saved the verification panel.")}>Save Panel Settings</button>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("onboarding", onboarding, "Saved the ID ticket settings.")}>Save ID Ticket Settings</button>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void runAction("verification", "deployVerificationPanel", "Posted a test gate message (auto-deletes in 30 minutes).")}>Save + Post Test Gate Message</button>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Ticket Panel Builder (Support / VIP / Drops)</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
              The general ticket panel is separate from the 18+ gate. Pick where it posts, then deploy it; the full builder with per-type buttons lives in Tickets.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Ticket panel channel</label>
                <select style={input} value={String(tickets.panelChannelId || "")} onChange={(event) => setTickets((prev) => ({ ...prev, panelChannelId: event.target.value }))}>
                  <option value="">(none)</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <label>Ticket panel title</label>
                <input style={input} value={String(tickets.panelTitle || "")} onChange={(event) => setTickets((prev) => ({ ...prev, panelTitle: event.target.value }))} placeholder="Support Tickets" />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Ticket panel description</label>
              <textarea style={{ ...input, minHeight: 80 }} value={String(tickets.panelDescription || "")} onChange={(event) => setTickets((prev) => ({ ...prev, panelDescription: event.target.value }))} placeholder="Choose a ticket type below." />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("tickets", tickets, "Saved the ticket panel.")}>Save Ticket Panel</button>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void runAction("tickets", "deployPanel", "Deployed the tickets panel.")}>Save + Deploy Tickets Panel</button>
              <Link href={`/dashboard/tickets?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Full Tickets Builder</Link>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void runAction("selfroles", "deployPanels", "Deployed selfroles panels.")}>Deploy Selfroles</button>
              <Link href={`/dashboard/selfroles?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Selfroles</Link>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0 }}>Messages + Copy</h3>
            <div style={{ marginBottom: 10 }}>
              <label>Welcome DM template</label>
              <textarea style={{ ...input, minHeight: 80 }} value={String(verification.dmTemplate || "")} onChange={(event) => setVerification((prev) => ({ ...prev, dmTemplate: event.target.value }))} />
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
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("verification", verification, "Saved verification copy.")}>Save Verification Copy</button>
              <button type="button" disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} onClick={() => void saveEngine("onboarding", onboarding, "Saved post-verified copy.")}>Save Post-Verified Copy</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
