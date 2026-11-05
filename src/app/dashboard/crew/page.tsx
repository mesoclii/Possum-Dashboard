"use client";

import { useMemo, useState } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type CrewCfg = {
  enabled: boolean;
  maxCrews: number;
  maxCrewSize: number;
  allowPublicRecruitment: boolean;
  recruitChannelId: string;
  inviteExpiryHours: number;
  signupPanelEnabled: boolean;
  signupPanelChannelId: string;
  signupPanelMessageId: string;
  signupPanelTitle: string;
  signupPanelDescription: string;
  signupPanelFooter: string;
  signupPanelButtonLabel: string;
  signupPanelAccentColor: string;
  signupPanelImageUrl: string;
  signupPanelThumbnailUrl: string;
  identityBadgesEnabled: boolean;
  identityBadgeChannelIds: string[];
  identityBadgeCooldownSeconds: number;
  identityBadgeTemplate: string;
  identityBadgeReplyMode: boolean;
};

const DEFAULT_CREW: CrewCfg = {
  enabled: true,
  maxCrews: 25,
  maxCrewSize: 25,
  allowPublicRecruitment: true,
  recruitChannelId: "",
  inviteExpiryHours: 72,
  signupPanelEnabled: false,
  signupPanelChannelId: "",
  signupPanelMessageId: "",
  signupPanelTitle: "Join a Crew",
  signupPanelDescription:
    "Browse the active crews below and choose who you want to roll with. Crew membership ties into vaults, GTA progression, and crew-vs-crew systems automatically.",
  signupPanelFooter: "Choose a crew below to join instantly.",
  signupPanelButtonLabel: "Choose a Crew",
  signupPanelAccentColor: "#ff4444",
  signupPanelImageUrl: "",
  signupPanelThumbnailUrl: "",
  identityBadgesEnabled: false,
  identityBadgeChannelIds: [],
  identityBadgeCooldownSeconds: 900,
  identityBadgeTemplate: "Representing {crewTagLine}",
  identityBadgeReplyMode: true,
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };
const card: React.CSSProperties = { border: "1px solid #6a0000", borderRadius: 12, background: "rgba(120,0,0,0.10)", padding: 14, marginBottom: 12 };
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#0b0b0b", color: "#ffd8d8", border: "1px solid #7a0000", borderRadius: 8 };
const micro: React.CSSProperties = { color: "#ffb2b2", fontSize: 12, lineHeight: 1.7 };

function normalizeHex(value: string) {
  const text = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text;
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text}`;
  return "#ff4444";
}

export default function CrewEnginePage() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<CrewCfg>("crew", DEFAULT_CREW);
  const [inviteCrewName, setInviteCrewName] = useState("");
  const [inviteTargetUserId, setInviteTargetUserId] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [panelMessage, setPanelMessage] = useState("");

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );

  const crewChoices = useMemo(() => {
    const detailBuckets = [
      Array.isArray(details?.crews) ? details.crews : [],
      Array.isArray(details?.leaderboard) ? details.leaderboard : [],
    ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const bucket of detailBuckets) {
      for (const entry of bucket) {
        const raw =
          typeof entry?.title === "string" && entry.title.trim()
            ? entry.title.trim()
            : typeof entry?.name === "string" && entry.name.trim()
              ? entry.name.trim()
              : "";
        if (!raw) continue;
        const normalized = raw.replace(/^\[[^\]]+\]\s*/, "").trim();
        if (!normalized || seen.has(normalized.toLowerCase())) continue;
        seen.add(normalized.toLowerCase());
        out.push(normalized);
      }
    }
    return out;
  }, [details]);

  const pendingInvites = useMemo(
    () => (Array.isArray(details?.pendingInvites) ? details.pendingInvites : []),
    [details]
  );

  function normalizeUserId(value: string) {
    const match = String(value || "").match(/\d{16,20}/);
    return match ? match[0] : "";
  }

  function toggleBadgeChannel(channelId: string) {
    setCfg((prev) => {
      const current = Array.isArray(prev.identityBadgeChannelIds) ? prev.identityBadgeChannelIds : [];
      const next = current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [...current, channelId];
      return { ...prev, identityBadgeChannelIds: next };
    });
  }

  async function sendInvite() {
    const targetUserId = normalizeUserId(inviteTargetUserId);
    if (!targetUserId) {
      setInviteMessage("Enter a member mention or Discord user ID.");
      return;
    }
    if (!inviteCrewName.trim()) {
      setInviteMessage("Choose the crew you want to invite them into.");
      return;
    }
    setInviteMessage("");
    const result = await runAction("inviteMember", {
      crewName: inviteCrewName.trim(),
      targetUserId,
      note: inviteNote.trim(),
    });
    if (result?.ok) {
      const delivery = [
        result?.delivery?.recruitChannelId ? "posted in the recruit lane" : "",
        result?.delivery?.dmSent ? "DM sent" : "",
      ].filter(Boolean);
      setInviteMessage(
        `Invite sent to ${targetUserId} for ${result.crewName}.${delivery.length ? ` ${delivery.join(" + ")}.` : ""}`
      );
      setInviteTargetUserId("");
      setInviteNote("");
    } else {
      setInviteMessage("Invite action failed.");
    }
  }

  async function deployPanel() {
    setPanelMessage("");
    const saved = await save();
    if (!saved) {
      setPanelMessage("Save the crew panel settings first.");
      return;
    }
    const result = await runAction("deploySignupPanel");
    if (result?.ok) {
      setPanelMessage(`Crew panel live in <#${result.channelId}>.`);
      return;
    }
    setPanelMessage("Crew panel deploy failed.");
  }

  if (!guildId) return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Crew Engine</h1>
      <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Crew is the GTA-side identity spine: recruiting, vaults, dominion ownership, and crew-linked progression all land here.
      </div>
      {message ? <div style={{ color: "#ffd27a", marginTop: 8 }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading crew...</div>
      ) : (
        <>
          <EngineContractPanel
            engineKey="crew"
            intro="Crew is the identity and treasury layer for the GTA side of the bot. This surface controls how many crews and members a server can hold, whether public recruiting stays open, and how crew identity gets surfaced back to the guild. Only founders can create crews."
            related={[
              { label: "Dominion", route: "/dashboard/dominion", reason: "dominion raids, wars, and territory ownership resolve by crew identity" },
              { label: "Contracts", route: "/dashboard/contracts", reason: "crew-facing objectives should stay economically aligned with contract payouts" },
              { label: "Profile", route: "/dashboard/profile", reason: "crew status, rank, and member-facing identity should stay aligned with profile surfaces" },
              { label: "Gaming Hub", route: "/dashboard/games", reason: "crew identity can sit beside gamer profiles and GTA-facing social surfaces" },
            ]}
          />
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <label><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))} /> Crew Enabled</label>
              <label><input type="checkbox" checked={cfg.allowPublicRecruitment} onChange={(e) => setCfg((p) => ({ ...p, allowPublicRecruitment: e.target.checked }))} /> Allow public recruitment</label>
              <label><input type="checkbox" checked={cfg.signupPanelEnabled} onChange={(e) => setCfg((p) => ({ ...p, signupPanelEnabled: e.target.checked }))} /> Enable crew signup panel</label>
              <label><input type="checkbox" checked={cfg.identityBadgesEnabled} onChange={(e) => setCfg((p) => ({ ...p, identityBadgesEnabled: e.target.checked }))} /> Enable crew identity badges</label>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Max Crews</div>
                <input style={input} type="number" min={1} max={1000} value={cfg.maxCrews} onChange={(e) => setCfg((p) => ({ ...p, maxCrews: Math.min(1000, Math.max(1, Math.floor(Number(e.target.value) || 1))) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Max Crew Size</div>
                <input style={input} type="number" min={1} max={500} value={cfg.maxCrewSize} onChange={(e) => setCfg((p) => ({ ...p, maxCrewSize: Math.min(500, Math.max(1, Math.floor(Number(e.target.value) || 1))) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Invite Expiry (hours)</div>
                <input style={input} type="number" min={1} max={8760} value={cfg.inviteExpiryHours} onChange={(e) => setCfg((p) => ({ ...p, inviteExpiryHours: Math.min(8760, Math.max(1, Math.floor(Number(e.target.value) || 1))) }))} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ marginBottom: 6 }}>Recruitment Channel</div>
                <select style={input} value={cfg.recruitChannelId || ""} onChange={(e) => setCfg((p) => ({ ...p, recruitChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>
              <div style={micro}>
                Where staff invite announcements are posted (the invitee is pinged here and also gets a DM with Accept/Decline). Public joins use /crew join or the signup panel.
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ marginBottom: 10, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Crew Signup Panel</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ marginBottom: 6 }}>Panel Channel</div>
                <select style={input} value={cfg.signupPanelChannelId || ""} onChange={(e) => setCfg((p) => ({ ...p, signupPanelChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Panel Accent Color</div>
                <input style={input} value={cfg.signupPanelAccentColor} onChange={(e) => setCfg((p) => ({ ...p, signupPanelAccentColor: e.target.value }))} onBlur={(e) => setCfg((p) => ({ ...p, signupPanelAccentColor: normalizeHex(e.target.value) }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Select Placeholder</div>
                <input style={input} value={cfg.signupPanelButtonLabel} onChange={(e) => setCfg((p) => ({ ...p, signupPanelButtonLabel: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: 6 }}>Panel Title</div>
                <input style={input} value={cfg.signupPanelTitle} onChange={(e) => setCfg((p) => ({ ...p, signupPanelTitle: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: 6 }}>Panel Description</div>
                <textarea style={{ ...input, minHeight: 100 }} value={cfg.signupPanelDescription} onChange={(e) => setCfg((p) => ({ ...p, signupPanelDescription: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: 6 }}>Panel Footer</div>
                <input style={input} value={cfg.signupPanelFooter} onChange={(e) => setCfg((p) => ({ ...p, signupPanelFooter: e.target.value }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Panel Image URL</div>
                <input style={input} value={cfg.signupPanelImageUrl} onChange={(e) => setCfg((p) => ({ ...p, signupPanelImageUrl: e.target.value }))} />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Panel Thumbnail URL</div>
                <input style={input} value={cfg.signupPanelThumbnailUrl} onChange={(e) => setCfg((p) => ({ ...p, signupPanelThumbnailUrl: e.target.value }))} />
              </div>
              <div style={micro}>
                This deploys a persistent crew signup message tied to the live crew engine. As crews are created, filled, or left, the panel refreshes to keep the list honest.
                {cfg.signupPanelMessageId ? ` Current message: ${cfg.signupPanelMessageId}` : ""}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => void deployPanel()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                  {saving ? "Deploying..." : "Deploy / Refresh Panel"}
                </button>
              </div>
              {panelMessage ? <div style={{ gridColumn: "1 / -1", color: "#ffd27a" }}>{panelMessage}</div> : null}
            </div>
          </section>

          <section style={card}>
            <div style={{ marginBottom: 10, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Crew Identity Badges</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <div>
                <div style={{ marginBottom: 6 }}>Badge Template</div>
                <input
                  style={input}
                  value={cfg.identityBadgeTemplate}
                  onChange={(e) => setCfg((p) => ({ ...p, identityBadgeTemplate: e.target.value }))}
                />
                <div style={{ ...micro, marginTop: 6 }}>Tokens: {"{crewName}"}, {"{crewTag}"}, {"{crewTagLine}"}, {"{user}"}.</div>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Cooldown (seconds)</div>
                <input
                  style={input}
                  type="number"
                  min={0}
                  max={86400}
                  value={cfg.identityBadgeCooldownSeconds}
                  onChange={(e) => setCfg((p) => ({ ...p, identityBadgeCooldownSeconds: Math.min(86400, Math.max(0, Math.floor(Number(e.target.value) || 0))) }))}
                />
                <label style={{ display: "block", marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={cfg.identityBadgeReplyMode}
                    onChange={(e) => setCfg((p) => ({ ...p, identityBadgeReplyMode: e.target.checked }))}
                  />{" "}
                  Post badge as a reply
                </label>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: 6 }}>Badge Channels</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
                  {textChannels.map((channel) => (
                    <label key={channel.id} style={{ border: "1px solid #4f0000", borderRadius: 8, padding: "8px 10px", background: "rgba(80,0,0,0.16)" }}>
                      <input
                        type="checkbox"
                        checked={(cfg.identityBadgeChannelIds || []).includes(channel.id)}
                        onChange={() => toggleBadgeChannel(channel.id)}
                      />{" "}
                      #{channel.name}
                    </label>
                  ))}
                </div>
                <div style={{ ...micro, marginTop: 8 }}>
                  Leave every channel unchecked if you want crew identity badges to be allowed in any text lane. This is the safe bot-side version of “representing a crew” since bots cannot inject native Discord user tags into normal member messages.
                </div>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, alignItems: "end" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: 6, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Staff Invite Lane</div>
                <div style={{ color: "#ffd0d0", lineHeight: 1.7 }}>
                  Use this when a crew is staff-run or public recruitment is off. The bot sends a real invite the member can accept, and it still honors the crew&apos;s live size limit.
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Crew Name</div>
                <input
                  list="crew-name-options"
                  style={input}
                  value={inviteCrewName}
                  onChange={(e) => setInviteCrewName(e.target.value)}
                  placeholder="Start typing a crew name"
                />
                <datalist id="crew-name-options">
                  {crewChoices.map((crewName) => <option key={crewName} value={crewName} />)}
                </datalist>
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>Member Mention or ID</div>
                <input
                  style={input}
                  value={inviteTargetUserId}
                  onChange={(e) => setInviteTargetUserId(e.target.value)}
                  placeholder="@member or 123456789012345678"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ marginBottom: 6 }}>Invite Note</div>
                <textarea
                  style={{ ...input, minHeight: 96 }}
                  value={inviteNote}
                  onChange={(e) => setInviteNote(e.target.value)}
                  placeholder="Optional note about the crew or what they should know before joining."
                />
              </div>
              <div style={micro}>
                Invite delivery uses the recruit channel when one is set and also tries DM. If buttons fail, the invited member can still use <code>/crew join</code>.
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => void sendInvite()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                  {saving ? "Sending..." : "Send Crew Invite"}
                </button>
              </div>
              {inviteMessage ? <div style={{ gridColumn: "1 / -1", color: "#ffd27a" }}>{inviteMessage}</div> : null}
            </div>
          </section>

          {pendingInvites.length ? (
            <section style={card}>
              <div style={{ marginBottom: 10, color: "#ff9c9c", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12 }}>Pending Invites</div>
              <div style={{ display: "grid", gap: 8 }}>
                {pendingInvites.map((entry, index) => (
                  <div key={`${entry.title || "invite"}_${index}`} style={{ borderTop: index ? "1px solid #330000" : "none", paddingTop: index ? 8 : 0 }}>
                    <div style={{ color: "#ffdcdc", fontWeight: 700 }}>{entry.title || `Invite ${index + 1}`}</div>
                    <div style={{ color: "#ffbdbd", fontSize: 12, marginTop: 2 }}>{entry.value}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div style={{ ...card, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Crew"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
