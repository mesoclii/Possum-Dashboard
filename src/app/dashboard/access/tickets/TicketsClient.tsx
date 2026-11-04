"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Role = { id: string; name: string; position?: number };
type Channel = { id: string; name: string; type: number };
type TicketTypeKey = "support" | "vip" | "drops";

type TicketTypeConfig = {
  enabled: boolean;
  label: string;
  shortPrefix: string;
  panelChannelId: string;
  panelButtonLabel: string;
  panelButtonEmoji: string;
  panelTitle: string;
  panelDescription: string;
  panelThumbnailUrl: string;
  panelImageUrl: string;
  openCategoryId: string;
  closedCategoryId: string;
  transcriptChannelId: string;
  logChannelId: string;
  introTitle: string;
  introMessage: string;
};

type TicketsConfig = {
  active: boolean;
  panelChannelId: string;
  panelLayout: "separate" | "combined";
  panelTitle: string;
  panelDescription: string;
  panelThumbnailUrl: string;
  panelImageUrl: string;
  openCategoryId: string;
  closedCategoryId: string;
  transcriptLogId: string;
  staffRoleIds: string[];
  founderRoleIds: string[];
  singleLogMode: boolean;
  controls: {
    claimLabel: string;
    claimEmoji: string;
    closeLabel: string;
    closeEmoji: string;
    reopenLabel: string;
    reopenEmoji: string;
    deleteLabel: string;
    deleteEmoji: string;
  };
  types: Record<TicketTypeKey, TicketTypeConfig>;
};

const TYPE_ORDER: TicketTypeKey[] = ["support", "vip", "drops"];

const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.08)",
  marginBottom: 12,
};

const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "10px 12px",
};

function emptyType(key: TicketTypeKey): TicketTypeConfig {
  const label = key === "vip" ? "VIP" : key === "drops" ? "Drops" : "Support";
  return {
    enabled: true,
    label,
    shortPrefix: key,
    panelChannelId: "",
    panelButtonLabel: label,
    panelButtonEmoji: "",
    panelTitle: `${label} Tickets`,
    panelDescription: `Open a ${label.toLowerCase()} ticket with the button below.`,
    panelThumbnailUrl: "",
    panelImageUrl: "",
    openCategoryId: "",
    closedCategoryId: "",
    transcriptChannelId: "",
    logChannelId: "",
    introTitle: `${label} Ticket`,
    introMessage:
      key === "drops"
        ? "Drops ticket opened. Post your platform/login details and drop selection."
        : key === "vip"
          ? "VIP desk opened. Share your request and staff will review."
          : "Thanks for opening a support ticket. Please hold while staff reviews this.",
  };
}

function defaultConfig(): TicketsConfig {
  return {
    active: true,
    panelChannelId: "",
    panelLayout: "separate",
    panelTitle: "Support Tickets",
    panelDescription: "Choose a ticket type below.",
    panelThumbnailUrl: "",
    panelImageUrl: "",
    openCategoryId: "",
    closedCategoryId: "",
    transcriptLogId: "",
    staffRoleIds: [],
    founderRoleIds: [],
    singleLogMode: true,
    controls: {
      claimLabel: "Claim",
      claimEmoji: "",
      closeLabel: "Close",
      closeEmoji: "",
      reopenLabel: "Reopen",
      reopenEmoji: "",
      deleteLabel: "Delete",
      deleteEmoji: "",
    },
    types: {
      support: emptyType("support"),
      vip: emptyType("vip"),
      drops: emptyType("drops"),
    },
  };
}

function getGuildId() {
  if (typeof window === "undefined") return "";
  const query = new URLSearchParams(window.location.search);
  const guildId = String(query.get("guildId") || localStorage.getItem("activeGuildId") || "").trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return guildId;
}

function emojiToInput(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value) {
    const anyEmoji = value as { id?: unknown; name?: unknown; animated?: unknown };
    const id = String(anyEmoji.id || "").trim();
    const name = String(anyEmoji.name || "emoji").trim();
    if (!id) return name;
    return `<${anyEmoji.animated ? "a" : ""}:${name}:${id}>`;
  }
  return "";
}

function normalizeConfig(inputValue: any): TicketsConfig {
  const base = defaultConfig();
  const input = inputValue && typeof inputValue === "object" ? inputValue : {};
  const controls = input.controls && typeof input.controls === "object" ? input.controls : {};
  const types = input.types && typeof input.types === "object" ? input.types : {};

  return {
    active: input.active !== false,
    panelChannelId: String(input.panelChannelId || ""),
    panelLayout: String(input.panelLayout || base.panelLayout).toLowerCase() === "combined" ? "combined" : "separate",
    panelTitle: String(input.panelTitle || base.panelTitle),
    panelDescription: String(input.panelDescription || base.panelDescription),
    panelThumbnailUrl: String(input.panelThumbnailUrl || ""),
    panelImageUrl: String(input.panelImageUrl || ""),
    openCategoryId: String(input.openCategoryId || ""),
    closedCategoryId: String(input.closedCategoryId || ""),
    transcriptLogId: String(input.transcriptLogId || ""),
    staffRoleIds: Array.isArray(input.staffRoleIds) ? input.staffRoleIds.map((value: unknown) => String(value || "")) : [],
    founderRoleIds: Array.isArray(input.founderRoleIds) ? input.founderRoleIds.map((value: unknown) => String(value || "")) : [],
    singleLogMode: input.singleLogMode !== false,
    controls: {
      claimLabel: String(controls.claimLabel || base.controls.claimLabel),
      claimEmoji: emojiToInput(controls.claimEmoji),
      closeLabel: String(controls.closeLabel || base.controls.closeLabel),
      closeEmoji: emojiToInput(controls.closeEmoji),
      reopenLabel: String(controls.reopenLabel || base.controls.reopenLabel),
      reopenEmoji: emojiToInput(controls.reopenEmoji),
      deleteLabel: String(controls.deleteLabel || base.controls.deleteLabel),
      deleteEmoji: emojiToInput(controls.deleteEmoji),
    },
    types: {
      support: {
        ...base.types.support,
        ...(types.support || {}),
        panelChannelId: String(types.support?.panelChannelId || ""),
        panelButtonEmoji: emojiToInput(types.support?.panelButtonEmoji),
        panelTitle: String(types.support?.panelTitle || base.types.support.panelTitle),
        panelDescription: String(types.support?.panelDescription || base.types.support.panelDescription),
        panelThumbnailUrl: String(types.support?.panelThumbnailUrl || ""),
        panelImageUrl: String(types.support?.panelImageUrl || ""),
      },
      vip: {
        ...base.types.vip,
        ...(types.vip || {}),
        panelChannelId: String(types.vip?.panelChannelId || ""),
        panelButtonEmoji: emojiToInput(types.vip?.panelButtonEmoji),
        panelTitle: String(types.vip?.panelTitle || base.types.vip.panelTitle),
        panelDescription: String(types.vip?.panelDescription || base.types.vip.panelDescription),
        panelThumbnailUrl: String(types.vip?.panelThumbnailUrl || ""),
        panelImageUrl: String(types.vip?.panelImageUrl || ""),
      },
      drops: {
        ...base.types.drops,
        ...(types.drops || {}),
        panelChannelId: String(types.drops?.panelChannelId || ""),
        panelButtonEmoji: emojiToInput(types.drops?.panelButtonEmoji),
        panelTitle: String(types.drops?.panelTitle || base.types.drops.panelTitle),
        panelDescription: String(types.drops?.panelDescription || base.types.drops.panelDescription),
        panelThumbnailUrl: String(types.drops?.panelThumbnailUrl || ""),
        panelImageUrl: String(types.drops?.panelImageUrl || ""),
      },
    },
  };
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

function RolePicker({
  label,
  roles,
  selected,
  onChange,
}: {
  label: string;
  roles: Role[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <details style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 10, marginTop: 8 }}>
      <summary style={{ cursor: "pointer", color: "#ffd0d0" }}>
        {label} ({selected.length})
      </summary>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, maxHeight: 180, overflowY: "auto" }}>
        {roles.map((role) => {
          const on = selected.includes(role.id);
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onChange(toggleId(selected, role.id))}
              style={{
                borderRadius: 999,
                border: on ? "1px solid #ff4a4a" : "1px solid #553030",
                padding: "6px 10px",
                background: on ? "rgba(255,0,0,0.20)" : "rgba(255,255,255,0.03)",
                color: on ? "#fff" : "#ffb7b7",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {role.name}
            </button>
          );
        })}
      </div>
    </details>
  );
}

export default function TicketsClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [cfg, setCfg] = useState<TicketsConfig>(defaultConfig());
  const [orig, setOrig] = useState<TicketsConfig>(defaultConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setGuildId(getGuildId());
  }, []);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setMsg("");

        const [guildRes, ticketRes] = await Promise.all([
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
          fetch(`/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=tickets`, { cache: "no-store" }),
        ]);

        const guildJson = await guildRes.json().catch(() => ({}));
        const ticketJson = await ticketRes.json().catch(() => ({}));
        if (!guildRes.ok || guildJson?.success === false) {
          throw new Error(guildJson?.error || "Failed to load guild data.");
        }
        if (!ticketRes.ok || ticketJson?.success === false) {
          throw new Error(ticketJson?.error || "Failed to load tickets config.");
        }

        const roleList: Role[] = Array.isArray(guildJson?.roles) ? guildJson.roles : [];
        roleList.sort((a, b) => Number(b.position || 0) - Number(a.position || 0));

        const loaded = normalizeConfig(ticketJson?.config);

        setGuildName(String(guildJson?.guild?.name || guildId));
        setRoles(roleList);
        setChannels(Array.isArray(guildJson?.channels) ? guildJson.channels : []);
        setCfg(loaded);
        setOrig(loaded);
      } catch {
        setMsg("Failed to load live tickets engine config.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  const textChannels = useMemo(
    () => channels.filter((channel) => channel.type === 0 || channel.type === 5),
    [channels]
  );
  const categories = useMemo(() => channels.filter((channel) => channel.type === 4), [channels]);
  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(orig), [cfg, orig]);

  function setType(key: TicketTypeKey, patch: Partial<TicketTypeConfig>) {
    setCfg((prev) => ({
      ...prev,
      types: {
        ...prev.types,
        [key]: {
          ...prev.types[key],
          ...patch,
        },
      },
    }));
  }

  async function saveAll() {
    if (!guildId) return;
    try {
      setSaving(true);
      setMsg("");

      const res = await fetch("/api/runtime/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "tickets", patch: cfg }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `Save failed (${res.status})`);
      }

      const next = normalizeConfig(json?.config);
      setCfg(next);
      setOrig(next);
      setMsg("Saved tickets engine to the live bot config for this guild.");
    } catch (error: any) {
      setMsg(error?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deployPanel() {
    if (!guildId) return;
    try {
      setDeploying(true);
      setMsg("");

      const res = await fetch("/api/runtime/engine-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          engine: "tickets",
          action: "deployPanel",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `Deploy failed (${res.status})`);
      }

      const deployed = Number(json?.result?.deployed || 0);
      const channelIds = Array.isArray(json?.result?.channelIds) ? json.result.channelIds : [];
      if (deployed > 1 || channelIds.length > 1) {
        setMsg(`Deployed ${deployed || channelIds.length} ticket panels across ${channelIds.map((id: string) => `<#${id}>`).join(", ")}.`);
      } else {
        setMsg(`Ticket panel deployed to <#${json?.result?.channelId || json?.channelId || cfg.panelChannelId}>.`);
      }
    } catch (error: any) {
      setMsg(error?.message || "Deploy failed.");
    } finally {
      setDeploying(false);
    }
  }

  if (!guildId) {
    return (
      <div style={{ color: "#ffb3b3", padding: 20 }}>
        Missing guildId. Open from <Link href="/guilds" style={{ color: "#fff" }}>/guilds</Link>.
      </div>
    );
  }

  return (
    <div style={{ color: "#ff5c5c", padding: 18, maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase" }}>Tickets Control</h1>
          <div style={{ color: "#ff9f9f", marginTop: 6 }}>Guild: {guildName || guildId}</div>
          <div style={{ color: "#ffb0b0", marginTop: 4, fontSize: 12 }}>
            Each guild now carries its own live ticket engine config, per-type intro copy, and button emoji mapping.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={deployPanel}
            disabled={deploying || loading}
            style={{ border: "1px solid #ff3636", background: "#120000", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            {deploying ? "Deploying..." : "Deploy Panel"}
          </button>
          <button
            onClick={saveAll}
            disabled={saving || loading}
            style={{ border: "1px solid #ff3636", background: "#190000", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            {saving ? "Saving..." : "Save Tickets"}
          </button>
        </div>
      </div>

      {msg ? <div style={{ marginTop: 10, color: "#ffd3d3" }}>{msg}</div> : null}

      {loading ? (
        <div style={{ marginTop: 16 }}>Loading...</div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Engine State</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={cfg.active}
                  onChange={(event) => setCfg((prev) => ({ ...prev, active: event.target.checked }))}
                  style={{ marginRight: 8 }}
                />
                Tickets Engine Enabled
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={cfg.singleLogMode}
                  onChange={(event) => setCfg((prev) => ({ ...prev, singleLogMode: event.target.checked }))}
                  style={{ marginRight: 8 }}
                />
                Shared transcript archive mode
              </label>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Optional Fallback Defaults</h3>
            <div style={{ color: "#ffb0b0", marginBottom: 10, fontSize: 12 }}>
              The support, VIP, and drops rows below are the real live routes. Leave this fallback block blank if every ticket type has its own panel channel and its own open/closed categories.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <div>
                <div>Fallback Panel Channel</div>
                <select style={input} value={cfg.panelChannelId} onChange={(event) => setCfg((prev) => ({ ...prev, panelChannelId: event.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div>Panel Layout</div>
                <select style={input} value={cfg.panelLayout} onChange={(event) => setCfg((prev) => ({ ...prev, panelLayout: event.target.value === "combined" ? "combined" : "separate" }))}>
                  <option value="separate">One button per panel</option>
                  <option value="combined">Single panel with all buttons</option>
                </select>
              </div>
              <div>
                <div>Fallback Open Category</div>
                <select style={input} value={cfg.openCategoryId} onChange={(event) => setCfg((prev) => ({ ...prev, openCategoryId: event.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div>Fallback Closed Category</div>
                <select style={input} value={cfg.closedCategoryId} onChange={(event) => setCfg((prev) => ({ ...prev, closedCategoryId: event.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div>Fallback Transcript Channel</div>
              <select style={input} value={cfg.transcriptLogId} onChange={(event) => setCfg((prev) => ({ ...prev, transcriptLogId: event.target.value }))}>
                <option value="">Select channel</option>
                {textChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <div>Fallback Panel Title</div>
                <input style={input} value={cfg.panelTitle} onChange={(event) => setCfg((prev) => ({ ...prev, panelTitle: event.target.value }))} />
              </div>
              <div>
                <div>Fallback Thumbnail URL</div>
                <input style={input} value={cfg.panelThumbnailUrl} onChange={(event) => setCfg((prev) => ({ ...prev, panelThumbnailUrl: event.target.value }))} placeholder="https://..." />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div>Fallback Background Image URL</div>
              <input style={input} value={cfg.panelImageUrl} onChange={(event) => setCfg((prev) => ({ ...prev, panelImageUrl: event.target.value }))} placeholder="https://..." />
            </div>

            <div style={{ color: "#ffb0b0", marginTop: 10, fontSize: 12 }}>
              Transcript channels stay on the ticket-type rows below if you want them. You do not need one extra transcript route here just to use category-based tickets, and each ticket type can use its own panel channel below.
            </div>

            <div style={{ marginTop: 10 }}>Fallback Panel Description</div>
            <textarea
              style={{ ...input, minHeight: 90 }}
              value={cfg.panelDescription}
              onChange={(event) => setCfg((prev) => ({ ...prev, panelDescription: event.target.value }))}
            />

            <RolePicker
              label="Staff Roles"
              roles={roles}
              selected={cfg.staffRoleIds}
              onChange={(next) => setCfg((prev) => ({ ...prev, staffRoleIds: next }))}
            />
            <RolePicker
              label="Founder / Escalation Roles"
              roles={roles}
              selected={cfg.founderRoleIds}
              onChange={(next) => setCfg((prev) => ({ ...prev, founderRoleIds: next }))}
            />
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Control Buttons</h3>
            <div style={{ color: "#ffb0b0", marginBottom: 10, fontSize: 12 }}>
              Emoji fields accept unicode or custom Discord emoji like <code>{`<a:name:123456789012345678>`}</code>.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 1fr 180px", gap: 10 }}>
              <input style={input} value={cfg.controls.claimLabel} placeholder="Claim label" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, claimLabel: event.target.value } }))} />
              <input style={input} value={cfg.controls.claimEmoji} placeholder="Claim emoji" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, claimEmoji: event.target.value } }))} />
              <input style={input} value={cfg.controls.closeLabel} placeholder="Close label" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, closeLabel: event.target.value } }))} />
              <input style={input} value={cfg.controls.closeEmoji} placeholder="Close emoji" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, closeEmoji: event.target.value } }))} />
              <input style={input} value={cfg.controls.reopenLabel} placeholder="Reopen label" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, reopenLabel: event.target.value } }))} />
              <input style={input} value={cfg.controls.reopenEmoji} placeholder="Reopen emoji" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, reopenEmoji: event.target.value } }))} />
              <input style={input} value={cfg.controls.deleteLabel} placeholder="Delete label" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, deleteLabel: event.target.value } }))} />
              <input style={input} value={cfg.controls.deleteEmoji} placeholder="Delete emoji" onChange={(event) => setCfg((prev) => ({ ...prev, controls: { ...prev.controls, deleteEmoji: event.target.value } }))} />
            </div>
          </div>

          {TYPE_ORDER.map((key) => {
            const typeCfg = cfg.types[key];
            return (
              <div key={key} style={card}>
                <h3 style={{ marginTop: 0, color: "#ff4444" }}>{typeCfg.label || key.toUpperCase()} Flow</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 180px", gap: 10 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={typeCfg.enabled}
                      onChange={(event) => setType(key, { enabled: event.target.checked })}
                      style={{ marginRight: 8 }}
                    />
                    Type Enabled
                  </label>
                  <div>
                    <div>Type Label</div>
                    <input style={input} value={typeCfg.label} onChange={(event) => setType(key, { label: event.target.value })} />
                  </div>
                  <div>
                    <div>Short Prefix</div>
                    <input style={input} value={typeCfg.shortPrefix} onChange={(event) => setType(key, { shortPrefix: event.target.value })} />
                  </div>
                  <div>
                    <div>Panel Channel</div>
                    <select style={input} value={typeCfg.panelChannelId} onChange={(event) => setType(key, { panelChannelId: event.target.value })}>
                      <option value="">Use fallback / select channel</option>
                      {textChannels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <div>Button Emoji</div>
                    <input style={input} value={typeCfg.panelButtonEmoji} onChange={(event) => setType(key, { panelButtonEmoji: event.target.value })} />
                  </div>
                  <div>
                    <div>Panel Button Label</div>
                    <input style={input} value={typeCfg.panelButtonLabel} onChange={(event) => setType(key, { panelButtonLabel: event.target.value })} />
                  </div>
                  <div>
                    <div>Panel Title</div>
                    <input style={input} value={typeCfg.panelTitle} onChange={(event) => setType(key, { panelTitle: event.target.value })} />
                  </div>
                  <div>
                    <div>Panel Thumbnail URL</div>
                    <input style={input} value={typeCfg.panelThumbnailUrl} onChange={(event) => setType(key, { panelThumbnailUrl: event.target.value })} placeholder="https://..." />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <div>Open Category</div>
                    <select style={input} value={typeCfg.openCategoryId} onChange={(event) => setType(key, { openCategoryId: event.target.value })}>
                      <option value="">Use default / select category</option>
                      {categories.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div>Closed Category</div>
                    <select style={input} value={typeCfg.closedCategoryId} onChange={(event) => setType(key, { closedCategoryId: event.target.value })}>
                      <option value="">Use default / select category</option>
                      {categories.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div>Transcript Channel</div>
                    <select style={input} value={typeCfg.transcriptChannelId} onChange={(event) => setType(key, { transcriptChannelId: event.target.value })}>
                      <option value="">Use default / select channel</option>
                      {textChannels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div>Panel Background Image URL</div>
                    <input style={input} value={typeCfg.panelImageUrl} onChange={(event) => setType(key, { panelImageUrl: event.target.value })} placeholder="https://..." />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <div>Operational Log Channel</div>
                    <select style={input} value={typeCfg.logChannelId} onChange={(event) => setType(key, { logChannelId: event.target.value })}>
                      <option value="">Optional</option>
                      {textChannels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div>Ticket Intro Title</div>
                    <input style={input} value={typeCfg.introTitle} onChange={(event) => setType(key, { introTitle: event.target.value })} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>Panel Description</div>
                <textarea
                  style={{ ...input, minHeight: 80 }}
                  value={typeCfg.panelDescription}
                  onChange={(event) => setType(key, { panelDescription: event.target.value })}
                />

                <div style={{ marginTop: 10 }}>Intro Message</div>
                <textarea
                  style={{ ...input, minHeight: 110 }}
                  value={typeCfg.introMessage}
                  onChange={(event) => setType(key, { introMessage: event.target.value })}
                />
              </div>
            );
          })}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <Link href={`/dashboard?guildId=${encodeURIComponent(guildId)}`} style={{ color: "#fff" }}>
              Back to Dashboard
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: dirty ? "#ffd27a" : "#9effb8", fontSize: 12 }}>{dirty ? "DIRTY" : "READY"}</span>
              <button
                onClick={saveAll}
                disabled={saving}
                style={{ border: "1px solid #ff3636", background: "#190000", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
              >
                {saving ? "Saving..." : "Save Tickets"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
