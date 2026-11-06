"use client";

import Link from "next/link";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type Channel = { id: string; name: string; type?: number | string };
type Role = { id: string; name: string };

type VipConfig = {
  active: boolean;
  vipRoleId: string;
  supporterRoleId: string;
  nitroRoleId: string;
  grantLogChannelId: string;
  grantNoticeMode: string;
  grantNoticeChannelId: string;
  grantNoticeTemplate: string;
  grantDmTemplate: string;
  revokeNoticeMode: string;
  revokeNoticeChannelId: string;
  revokeNoticeTemplate: string;
  revokeDmTemplate: string;
  expiryNoticeMode: string;
  expiryNoticeChannelId: string;
  expiryNoticeTemplate: string;
  expiryDmTemplate: string;
  autoExpire: boolean;
  expiryDays: number;
  syncWithLoyalty: boolean;
  notes: string;
};

const EMPTY: VipConfig = {
  active: true,
  vipRoleId: "",
  supporterRoleId: "",
  nitroRoleId: "",
  grantLogChannelId: "",
  grantNoticeMode: "dm",
  grantNoticeChannelId: "",
  grantNoticeTemplate: "{{user}} now has {{tierLabel}} access in {{guildName}} until {{expiresAt}}.",
  grantDmTemplate: "Your {{tierLabel}} access in {{guildName}} is active until {{expiresAt}}.",
  revokeNoticeMode: "disabled",
  revokeNoticeChannelId: "",
  revokeNoticeTemplate: "{{user}} no longer has {{tierLabel}} access in {{guildName}}.",
  revokeDmTemplate: "Your {{tierLabel}} access in {{guildName}} has been removed.",
  expiryNoticeMode: "disabled",
  expiryNoticeChannelId: "",
  expiryNoticeTemplate: "{{user}}'s {{tierLabel}} access expired in {{guildName}}.",
  expiryDmTemplate: "Your {{tierLabel}} access in {{guildName}} expired on {{expiresAt}}.",
  autoExpire: true,
  expiryDays: 30,
  syncWithLoyalty: true,
  notes: "",
};

const NOTICE_MODES = ["disabled", "channel", "dm", "both"];

function withGuild(href: string, guildId: string) {
  if (!guildId) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}guildId=${encodeURIComponent(guildId)}`;
}

const card = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
};

const input = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "10px 12px",
};

export default function VipClient() {
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
  } = useGuildEngineEditor<VipConfig>("vip", EMPTY);

  const textChannels = (channels as Channel[]).filter((channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5);

  if (!guildId) {
    return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1200 }}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>VIP Engine</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 12 }}>
        VIP is now reconciled directly against the live engine runtime. Loyalty stays linked, but its controls remain on the dedicated page.
      </div>

      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <EngineInsights summary={summary} details={details} />

          <section id="tiers" style={card}>
            <label>
              <input
                type="checkbox"
                checked={cfg.active}
                onChange={(e) => setCfg((prev) => ({ ...prev, active: e.target.checked }))}
              />{" "}
              VIP Engine Enabled
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <div>VIP Role</div>
                <select style={input} value={cfg.vipRoleId} onChange={(e) => setCfg((prev) => ({ ...prev, vipRoleId: e.target.value }))}>
                  <option value="">Select role</option>
                  {(roles as Role[]).map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div>Supporter Role</div>
                <select style={input} value={cfg.supporterRoleId} onChange={(e) => setCfg((prev) => ({ ...prev, supporterRoleId: e.target.value }))}>
                  <option value="">Select role</option>
                  {(roles as Role[]).map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div>Nitro Booster Role</div>
                <select style={input} value={cfg.nitroRoleId} onChange={(e) => setCfg((prev) => ({ ...prev, nitroRoleId: e.target.value }))}>
                  <option value="">Select role</option>
                  {(roles as Role[]).map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div>Grant Log Channel</div>
                <select style={input} value={cfg.grantLogChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, grantLogChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={cfg.autoExpire}
                  onChange={(e) => setCfg((prev) => ({ ...prev, autoExpire: e.target.checked }))}
                />{" "}
                Auto Expire VIP
              </label>
              <div>
                <div>Expiry Days</div>
                <input
                  style={input}
                  type="number"
                  min={1}
                  value={cfg.expiryDays}
                  onChange={(e) => setCfg((prev) => ({ ...prev, expiryDays: Number(e.target.value || 1) }))}
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={cfg.syncWithLoyalty}
                  onChange={(e) => setCfg((prev) => ({ ...prev, syncWithLoyalty: e.target.checked }))}
                />{" "}
                Sync VIP with Loyalty Engine
              </label>
            </div>

            <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 8, color: "#ff6b6b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Custom Notices
              </div>
              <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 10 }}>
                Tokens: <code>{'{{user}}'}</code>, <code>{'{{userId}}'}</code>, <code>{'{{tier}}'}</code>, <code>{'{{tierLabel}}'}</code>, <code>{'{{guildName}}'}</code>, <code>{'{{expiresAt}}'}</code>, <code>{'{{actor}}'}</code>, <code>{'{{method}}'}</code>, <code>{'{{reference}}'}</code>, <code>{'{{reason}}'}</code>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(220px,1fr))", gap: 10 }}>
                <div>
                  <div>Grant Notice Mode</div>
                  <select style={input} value={cfg.grantNoticeMode} onChange={(e) => setCfg((prev) => ({ ...prev, grantNoticeMode: e.target.value }))}>
                    {NOTICE_MODES.map((mode) => <option key={`grant_${mode}`} value={mode}>{mode}</option>)}
                  </select>
                </div>
                <div>
                  <div>Grant Notice Channel</div>
                  <select style={input} value={cfg.grantNoticeChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, grantNoticeChannelId: e.target.value }))}>
                    <option value="">Use grant log channel</option>
                    {textChannels.map((channel) => (
                      <option key={`grant_${channel.id}`} value={channel.id}>#{channel.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div>Revoke Notice Mode</div>
                  <select style={input} value={cfg.revokeNoticeMode} onChange={(e) => setCfg((prev) => ({ ...prev, revokeNoticeMode: e.target.value }))}>
                    {NOTICE_MODES.map((mode) => <option key={`revoke_${mode}`} value={mode}>{mode}</option>)}
                  </select>
                </div>
                <div>
                  <div>Revoke Notice Channel</div>
                  <select style={input} value={cfg.revokeNoticeChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, revokeNoticeChannelId: e.target.value }))}>
                    <option value="">Use grant log channel</option>
                    {textChannels.map((channel) => (
                      <option key={`revoke_${channel.id}`} value={channel.id}>#{channel.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div>Expiry Notice Mode</div>
                  <select style={input} value={cfg.expiryNoticeMode} onChange={(e) => setCfg((prev) => ({ ...prev, expiryNoticeMode: e.target.value }))}>
                    {NOTICE_MODES.map((mode) => <option key={`expiry_${mode}`} value={mode}>{mode}</option>)}
                  </select>
                </div>
                <div>
                  <div>Expiry Notice Channel</div>
                  <select style={input} value={cfg.expiryNoticeChannelId} onChange={(e) => setCfg((prev) => ({ ...prev, expiryNoticeChannelId: e.target.value }))}>
                    <option value="">Use grant log channel</option>
                    {textChannels.map((channel) => (
                      <option key={`expiry_${channel.id}`} value={channel.id}>#{channel.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div>Grant Channel Message</div>
                  <textarea style={{ ...input, minHeight: 90 }} value={cfg.grantNoticeTemplate} onChange={(e) => setCfg((prev) => ({ ...prev, grantNoticeTemplate: e.target.value }))} />
                </div>
                <div>
                  <div>Grant DM Message</div>
                  <textarea style={{ ...input, minHeight: 90 }} value={cfg.grantDmTemplate} onChange={(e) => setCfg((prev) => ({ ...prev, grantDmTemplate: e.target.value }))} />
                </div>
                <div>
                  <div>Revoke Channel Message</div>
                  <textarea style={{ ...input, minHeight: 90 }} value={cfg.revokeNoticeTemplate} onChange={(e) => setCfg((prev) => ({ ...prev, revokeNoticeTemplate: e.target.value }))} />
                </div>
                <div>
                  <div>Revoke DM Message</div>
                  <textarea style={{ ...input, minHeight: 90 }} value={cfg.revokeDmTemplate} onChange={(e) => setCfg((prev) => ({ ...prev, revokeDmTemplate: e.target.value }))} />
                </div>
                <div>
                  <div>Expiry Channel Message</div>
                  <textarea style={{ ...input, minHeight: 90 }} value={cfg.expiryNoticeTemplate} onChange={(e) => setCfg((prev) => ({ ...prev, expiryNoticeTemplate: e.target.value }))} />
                </div>
                <div>
                  <div>Expiry DM Message</div>
                  <textarea style={{ ...input, minHeight: 90 }} value={cfg.expiryDmTemplate} onChange={(e) => setCfg((prev) => ({ ...prev, expiryDmTemplate: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div>Notes</div>
              <textarea style={{ ...input, minHeight: 100 }} value={cfg.notes} onChange={(e) => setCfg((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>
          </section>

          <section id="rolesync" style={card}>
            <div style={{ fontWeight: 900, marginBottom: 8, color: "#ff6b6b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Lifecycle Recovery
            </div>
            <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 10 }}>
              VIP expiry cleanup, loyalty-linked sync behavior, and renewal recovery all run through the live VIP engine here.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void runAction("cleanupExpired")}
                disabled={saving}
                style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
              >
                Expire Stale Grants
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
              >
                {saving ? "Saving..." : "Save VIP"}
              </button>
            </div>
          </section>

          <section id="clearance" style={card}>
            <div style={{ fontWeight: 900, marginBottom: 8, color: "#ff6b6b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Clearance + Linked Engines
            </div>
            <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 10 }}>
              VIP clearance is role-driven in the live runtime. The roles you map above are the roles used by VIP grants, expiry cleanup, loyalty sync, and any command or panel flows that key off VIP membership.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              <Link href={withGuild("/dashboard/loyalty", guildId)} style={{ ...input, textDecoration: "none", textAlign: "center", fontWeight: 900 }}>
                Open Loyalty Engine
              </Link>
              <Link href={withGuild("/dashboard/economy/progression", guildId)} style={{ ...input, textDecoration: "none", textAlign: "center", fontWeight: 900 }}>
                Open Progression Multipliers
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
