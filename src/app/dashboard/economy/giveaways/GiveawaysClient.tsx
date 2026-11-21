"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type Role = { id: string; name: string; position?: number };
type Channel = { id: string; name: string; type: number | string };

type GiveawayImage = {
  url: string;
  label: string;
};

type GiveawaysUiConfig = {
  active: boolean;
  enabled?: boolean;
  defaultChannelId: string;
  channelId: string;
  ticketChannelId: string;
  defaultDurationMin: number;
  defaultWinners: number;
  defaultPrize: string;
  defaultImageUrl: string;
  announceTemplate: string;
  rerollTemplate: string;
  endTemplate: string;
  winnerNoticeMode: string;
  winnerNoticeChannelId: string;
  winnerChannelTemplate: string;
  winnerDmTemplate: string;
  requireStaffApproval: boolean;
  allowedRoleIds: string[];
  blockedRoleIds: string[];
  hostRoleIds: string[];
  allowedChannelIds: string[];
  imageLibrary: GiveawayImage[];
  antiAbuse: {
    minAccountAgeDays: number;
    ignoreBotEntries: boolean;
  };
  runtime: {
    maxConcurrentGiveaways: number;
    cooldownMinutes: number;
  };
  notes: string;
  lastSavedAt: string;
};

const DEFAULT_CONFIG: GiveawaysUiConfig = {
  active: true,
  enabled: true,
  defaultChannelId: "",
  channelId: "",
  ticketChannelId: "",
  defaultDurationMin: 60,
  defaultWinners: 1,
  defaultPrize: "",
  defaultImageUrl: "",
  announceTemplate: "Giveaway started: {{prize}}",
  rerollTemplate: "Rerolled giveaway winner for {{prize}}",
  endTemplate: "Giveaway ended: {{prize}}",
  winnerNoticeMode: "both",
  winnerNoticeChannelId: "",
  winnerChannelTemplate: "",
  winnerDmTemplate: "",
  requireStaffApproval: false,
  allowedRoleIds: [],
  blockedRoleIds: [],
  hostRoleIds: [],
  allowedChannelIds: [],
  imageLibrary: [],
  antiAbuse: {
    minAccountAgeDays: 0,
    ignoreBotEntries: true,
  },
  runtime: {
    maxConcurrentGiveaways: 5,
    cooldownMinutes: 0,
  },
  notes: "",
  lastSavedAt: "",
};

function cloneDefaults(): GiveawaysUiConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function cleanText(v: unknown, fallback = "", max = 4000): string {
  return String(v ?? fallback).trim().slice(0, max);
}

function cleanId(v: unknown): string {
  const s = cleanText(v, "", 30);
  return /^\d{16,20}$/.test(s) ? s : "";
}

function cleanUrl(v: unknown): string {
  const s = cleanText(v, "", 2000);
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) return "";
  return s;
}

function uniqIds(ids: string[]): string[] {
  return [...new Set((ids || []).filter(Boolean))];
}

const NOTICE_MODES = ["disabled", "channel", "dm", "both"];

function normalize(cfg: Partial<GiveawaysUiConfig> | null | undefined): GiveawaysUiConfig {
  const merged = {
    ...cloneDefaults(),
    ...(cfg || {}),
    antiAbuse: {
      ...DEFAULT_CONFIG.antiAbuse,
      ...(cfg?.antiAbuse || {}),
    },
    runtime: {
      ...DEFAULT_CONFIG.runtime,
      ...(cfg?.runtime || {}),
    },
  };

  const library: GiveawayImage[] = [];
  const seen = new Set<string>();
  for (const row of merged.imageLibrary || []) {
    const url = cleanUrl(row?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    library.push({ url, label: cleanText(row?.label, "", 120) });
    if (library.length >= 80) break;
  }

  const active = !!merged.active && merged.enabled !== false;
  return {
    active,
    enabled: active,
    defaultChannelId: cleanId(merged.defaultChannelId),
    channelId: cleanId(merged.channelId),
    ticketChannelId: cleanId(merged.ticketChannelId),
    defaultDurationMin: clampInt(merged.defaultDurationMin, 60, 1, 43200),
    defaultWinners: clampInt(merged.defaultWinners, 1, 1, 100),
    defaultPrize: cleanText(merged.defaultPrize, "", 200),
    defaultImageUrl: cleanUrl(merged.defaultImageUrl),
    announceTemplate: cleanText(merged.announceTemplate, DEFAULT_CONFIG.announceTemplate, 4000),
    rerollTemplate: cleanText(merged.rerollTemplate, DEFAULT_CONFIG.rerollTemplate, 4000),
    endTemplate: cleanText(merged.endTemplate, DEFAULT_CONFIG.endTemplate, 4000),
    winnerNoticeMode: NOTICE_MODES.includes(cleanText(merged.winnerNoticeMode, DEFAULT_CONFIG.winnerNoticeMode, 24).toLowerCase())
      ? cleanText(merged.winnerNoticeMode, DEFAULT_CONFIG.winnerNoticeMode, 24).toLowerCase()
      : DEFAULT_CONFIG.winnerNoticeMode,
    winnerNoticeChannelId: cleanId(merged.winnerNoticeChannelId),
    winnerChannelTemplate: cleanText(merged.winnerChannelTemplate, "", 4000),
    winnerDmTemplate: cleanText(merged.winnerDmTemplate, "", 4000),
    requireStaffApproval: !!merged.requireStaffApproval,
    allowedRoleIds: uniqIds(merged.allowedRoleIds || []),
    blockedRoleIds: uniqIds(merged.blockedRoleIds || []),
    hostRoleIds: uniqIds(merged.hostRoleIds || []),
    allowedChannelIds: uniqIds(merged.allowedChannelIds || []),
    imageLibrary: library,
    antiAbuse: {
      minAccountAgeDays: clampInt(merged.antiAbuse?.minAccountAgeDays, 0, 0, 3650),
      ignoreBotEntries: !!merged.antiAbuse?.ignoreBotEntries,
    },
    runtime: {
      maxConcurrentGiveaways: clampInt(merged.runtime?.maxConcurrentGiveaways, 5, 1, 100),
      cooldownMinutes: clampInt(merged.runtime?.cooldownMinutes, 0, 0, 10080),
    },
    notes: cleanText(merged.notes, "", 4000),
    lastSavedAt: cleanText(merged.lastSavedAt, "", 64),
  };
}

function sig(cfg: GiveawaysUiConfig): string {
  return JSON.stringify(normalize(cfg));
}

function toLocal(ts: string): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleString();
}

function toggleId(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

type PickerItem = { id: string; name: string };

function IdPicker({
  label,
  items,
  selected,
  onChange,
  hash,
}: {
  label: string;
  items: PickerItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  hash?: boolean;
}) {
  return (
    <details style={{ border: "1px solid #5f0000", borderRadius: 10, padding: 10, marginTop: 8 }}>
      <summary style={{ cursor: "pointer", color: "#ffd0d0" }}>
        {label} ({selected.length})
      </summary>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, maxHeight: 170, overflowY: "auto" }}>
        {items.map((item) => {
          const active = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(toggleId(selected, item.id))}
              style={{
                borderRadius: 999,
                border: active ? "1px solid #ff4a4a" : "1px solid #553030",
                padding: "6px 10px",
                background: active ? "rgba(255,0,0,0.20)" : "rgba(255,255,255,0.03)",
                color: active ? "#fff" : "#ffb7b7",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {hash ? "#" : ""}
              {item.name}
            </button>
          );
        })}
      </div>
    </details>
  );
}

export default function GiveawaysPage() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    roles,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<GiveawaysUiConfig>("giveaways", cloneDefaults());

  const cfg = normalize(rawCfg);
  const [baselineSig, setBaselineSig] = useState("");
  const [newImgUrl, setNewImgUrl] = useState("");
  const [newImgLabel, setNewImgLabel] = useState("");
  const [localMsg, setLocalMsg] = useState("");
  const cfgSignature = sig(cfg);

  useEffect(() => {
    if (!guildId || loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBaselineSig(cfgSignature);
  }, [cfgSignature, guildId, loading]);

  const textChannels = useMemo(
    () => (channels as Channel[]).filter((channel) => Number(channel.type) === 0 || Number(channel.type) === 5),
    [channels]
  );
  const dirty = cfgSignature !== baselineSig;
  const visibleMessage = localMsg || message;

  function applyPreset(name: "blank" | "starter" | "promo") {
    setLocalMsg("");
    if (name === "blank") {
      setCfg((prev) =>
        normalize({
          ...prev,
          active: false,
          enabled: false,
          defaultChannelId: "",
          channelId: "",
          ticketChannelId: "",
          requireStaffApproval: false,
          allowedRoleIds: [],
          blockedRoleIds: [],
          hostRoleIds: [],
          allowedChannelIds: [],
          imageLibrary: [],
          defaultImageUrl: "",
        })
      );
      return;
    }

    if (name === "starter") {
      setCfg((prev) =>
        normalize({
          ...prev,
          active: true,
          enabled: true,
          defaultDurationMin: 60,
          defaultWinners: 1,
          requireStaffApproval: false,
          runtime: {
            ...prev.runtime,
            maxConcurrentGiveaways: 5,
            cooldownMinutes: 0,
          },
        })
      );
      return;
    }

    setCfg((prev) =>
      normalize({
        ...prev,
        active: true,
        enabled: true,
        defaultDurationMin: 180,
        defaultWinners: 3,
        requireStaffApproval: true,
        runtime: {
          ...prev.runtime,
          maxConcurrentGiveaways: 10,
          cooldownMinutes: 15,
        },
      })
    );
  }

  function addImage() {
    const url = cleanUrl(newImgUrl);
    if (!url) {
      setLocalMsg("Image URL must start with http or https.");
      return;
    }
    if (cfg.imageLibrary.some((item) => item.url === url)) {
      setLocalMsg("That image URL is already in the library.");
      return;
    }

    const next = normalize({
      ...cfg,
      imageLibrary: [...cfg.imageLibrary, { url, label: cleanText(newImgLabel, "", 120) }],
      defaultImageUrl: cfg.defaultImageUrl || url,
    });

    setCfg(next);
    setNewImgUrl("");
    setNewImgLabel("");
    setLocalMsg("");
  }

  function removeImage(url: string) {
    setCfg(
      normalize({
        ...cfg,
        imageLibrary: cfg.imageLibrary.filter((item) => item.url !== url),
        defaultImageUrl: cfg.defaultImageUrl === url ? "" : cfg.defaultImageUrl,
      })
    );
    setLocalMsg("");
  }

  async function saveAll(nextConfig: GiveawaysUiConfig = cfg) {
    setLocalMsg("");
    const normalized = normalize(nextConfig);
    const result = await save(normalized);
    if (!result) return;
    setCfg(normalized);
    setBaselineSig(sig(normalized));
  }

  const card: React.CSSProperties = {
    border: "1px solid #5f0000",
    borderRadius: 12,
    padding: 14,
    background: "rgba(120,0,0,0.08)",
    marginBottom: 12,
  };

  const input: React.CSSProperties = {
    width: "100%",
    background: "#0a0a0a",
    color: "#ffd0d0",
    border: "1px solid #7f0000",
    borderRadius: 8,
    padding: "10px 12px",
  };

  const pill = (on: boolean) => ({
    border: `1px solid ${on ? "#14a44d" : "#a41414"}`,
    borderRadius: 999,
    padding: "6px 12px",
    color: on ? "#7dff9c" : "#ff9a9a",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
  });

  if (!guildId) {
    return (
      <div style={{ color: "#ffb3b3", padding: 20 }}>
        Missing guildId. Open from <Link href="/guilds" style={{ color: "#fff" }}>/guilds</Link>.
      </div>
    );
  }

  return (
    <div style={{ color: "#ff5c5c", padding: 18, maxWidth: 1280 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase" }}>Giveaways Control</h1>
          <div style={{ color: "#ff9f9f", marginTop: 6 }}>Guild: {guildName || "Selected server"}</div>
          <div style={{ color: "#ff9f9f", marginTop: 4 }}>Last saved: {toLocal(cfg.lastSavedAt)}</div>
        </div>
        <button
          onClick={() => void saveAll()}
          disabled={saving || loading}
          style={{ border: "1px solid #ff3636", background: "#190000", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          type="button"
        >
          {saving ? "Saving..." : "Save Giveaways"}
        </button>
      </div>

      <div style={{ color: "#ffb8b8", lineHeight: 1.6, maxWidth: 980, marginTop: 10 }}>
        Giveaways now edits the live runtime path the bot uses for tribute setup, anti-abuse rules, channel routing, templates, and image defaults.
      </div>
      {visibleMessage ? <div style={{ marginTop: 10, color: "#ffd3d3" }}>{visibleMessage}</div> : null}

      {loading ? (
        <div style={{ marginTop: 16 }}>Loading...</div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <EngineInsights summary={summary} details={details} />

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill(cfg.active)}>MODULE {cfg.active ? "ON" : "OFF"}</span>
            <span style={pill(cfg.requireStaffApproval)}>STAFF APPROVAL {cfg.requireStaffApproval ? "ON" : "OFF"}</span>
            <span style={pill(cfg.imageLibrary.length > 0)}>IMAGE LIBRARY {cfg.imageLibrary.length}</span>
            <span style={pill(!dirty)}>{dirty ? "UNSAVED" : "SAVED"}</span>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Quick Presets</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => applyPreset("blank")} style={{ ...input, width: "auto", cursor: "pointer" }}>Blank</button>
              <button type="button" onClick={() => applyPreset("starter")} style={{ ...input, width: "auto", cursor: "pointer" }}>Starter</button>
              <button type="button" onClick={() => applyPreset("promo")} style={{ ...input, width: "auto", cursor: "pointer" }}>Promo</button>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Core</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <label><input type="checkbox" checked={cfg.active} onChange={(e) => setCfg(normalize({ ...cfg, active: e.target.checked, enabled: e.target.checked }))} /> Enabled</label>
              <label><input type="checkbox" checked={cfg.requireStaffApproval} onChange={(e) => setCfg(normalize({ ...cfg, requireStaffApproval: e.target.checked }))} /> Staff approval required</label>
              <label><input type="checkbox" checked={cfg.antiAbuse.ignoreBotEntries} onChange={(e) => setCfg(normalize({ ...cfg, antiAbuse: { ...cfg.antiAbuse, ignoreBotEntries: e.target.checked } }))} /> Ignore bot entries</label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <div>
                <div>Default Duration (minutes)</div>
                <input type="number" style={input} value={cfg.defaultDurationMin} onChange={(e) => setCfg(normalize({ ...cfg, defaultDurationMin: clampInt(e.target.value, 60, 1, 43200) }))} />
              </div>
              <div>
                <div>Default Winners</div>
                <input type="number" style={input} value={cfg.defaultWinners} onChange={(e) => setCfg(normalize({ ...cfg, defaultWinners: clampInt(e.target.value, 1, 1, 100) }))} />
              </div>
              <div>
                <div>Max Concurrent Giveaways</div>
                <input type="number" style={input} value={cfg.runtime.maxConcurrentGiveaways} onChange={(e) => setCfg(normalize({ ...cfg, runtime: { ...cfg.runtime, maxConcurrentGiveaways: clampInt(e.target.value, 5, 1, 100) } }))} />
              </div>
              <div>
                <div>Cooldown (minutes)</div>
                <input type="number" style={input} value={cfg.runtime.cooldownMinutes} onChange={(e) => setCfg(normalize({ ...cfg, runtime: { ...cfg.runtime, cooldownMinutes: clampInt(e.target.value, 0, 0, 10080) } }))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <div>Default Prize</div>
                <input style={input} value={cfg.defaultPrize} onChange={(e) => setCfg(normalize({ ...cfg, defaultPrize: e.target.value }))} placeholder="Example: Nitro 1 month" />
              </div>
              <div>
                <div>Min Account Age (days)</div>
                <input type="number" style={input} value={cfg.antiAbuse.minAccountAgeDays} onChange={(e) => setCfg(normalize({ ...cfg, antiAbuse: { ...cfg.antiAbuse, minAccountAgeDays: clampInt(e.target.value, 0, 0, 3650) } }))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
              <div>
                <div>Default Giveaway Channel</div>
                <select style={input} value={cfg.defaultChannelId} onChange={(e) => setCfg(normalize({ ...cfg, defaultChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div>Legacy Override Channel</div>
                <select style={input} value={cfg.channelId} onChange={(e) => setCfg(normalize({ ...cfg, channelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div>Ticket / Claim Channel</div>
                <select style={input} value={cfg.ticketChannelId} onChange={(e) => setCfg(normalize({ ...cfg, ticketChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Templates</h3>
            <div style={{ marginBottom: 10 }}>
              <div>Announce Template</div>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.announceTemplate} onChange={(e) => setCfg(normalize({ ...cfg, announceTemplate: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div>Reroll Template</div>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.rerollTemplate} onChange={(e) => setCfg(normalize({ ...cfg, rerollTemplate: e.target.value }))} />
            </div>
            <div>
              <div>End Template</div>
              <textarea style={{ ...input, minHeight: 80 }} value={cfg.endTemplate} onChange={(e) => setCfg(normalize({ ...cfg, endTemplate: e.target.value }))} />
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div>Winner Notice Mode</div>
                  <select style={input} value={cfg.winnerNoticeMode} onChange={(e) => setCfg(normalize({ ...cfg, winnerNoticeMode: e.target.value }))}>
                    {NOTICE_MODES.map((mode) => <option key={`winner_${mode}`} value={mode}>{mode}</option>)}
                  </select>
                </div>
                <div>
                  <div>Winner Notice Channel</div>
                  <select style={input} value={cfg.winnerNoticeChannelId} onChange={(e) => setCfg(normalize({ ...cfg, winnerNoticeChannelId: e.target.value }))}>
                    <option value="">Use giveaway post channel</option>
                    {textChannels.map((channel) => (
                      <option key={`winner_channel_${channel.id}`} value={channel.id}>#{channel.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>
                Tokens: <code>{'{{prize}}'}</code>, <code>{'{{giveawayId}}'}</code>, <code>{'{{guildName}}'}</code>, <code>{'{{channelMention}}'}</code>, <code>{'{{winners}}'}</code>, <code>{'{{winnerCount}}'}</code>, <code>{'{{winnerTitle}}'}</code>, <code>{'{{claimLine}}'}</code>, <code>{'{{user}}'}</code>, <code>{'{{userId}}'}</code>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div>Winner Channel Message</div>
                  <textarea style={{ ...input, minHeight: 80 }} value={cfg.winnerChannelTemplate} onChange={(e) => setCfg(normalize({ ...cfg, winnerChannelTemplate: e.target.value }))} placeholder="Leave blank to keep the built-in winner embed." />
                </div>
                <div>
                  <div>Winner DM Message</div>
                  <textarea style={{ ...input, minHeight: 80 }} value={cfg.winnerDmTemplate} onChange={(e) => setCfg(normalize({ ...cfg, winnerDmTemplate: e.target.value }))} placeholder="Leave blank to keep the built-in winner DM embed." />
                </div>
              </div>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Access Control</h3>

            <IdPicker
              label="Allowed Roles (entry)"
              items={(roles as Role[]).map((role) => ({ id: role.id, name: role.name }))}
              selected={cfg.allowedRoleIds}
              onChange={(ids) => setCfg(normalize({ ...cfg, allowedRoleIds: ids }))}
            />

            <IdPicker
              label="Blocked Roles (entry)"
              items={(roles as Role[]).map((role) => ({ id: role.id, name: role.name }))}
              selected={cfg.blockedRoleIds}
              onChange={(ids) => setCfg(normalize({ ...cfg, blockedRoleIds: ids }))}
            />

            <IdPicker
              label="Host Roles (can start/reroll/end)"
              items={(roles as Role[]).map((role) => ({ id: role.id, name: role.name }))}
              selected={cfg.hostRoleIds}
              onChange={(ids) => setCfg(normalize({ ...cfg, hostRoleIds: ids }))}
            />

            <IdPicker
              label="Allowed Channels"
              items={textChannels.map((channel) => ({ id: channel.id, name: channel.name }))}
              selected={cfg.allowedChannelIds}
              onChange={(ids) => setCfg(normalize({ ...cfg, allowedChannelIds: ids }))}
              hash
            />
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Image Library</h3>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <input style={input} value={newImgUrl} onChange={(e) => setNewImgUrl(e.target.value)} placeholder="https://example.com/image.png" />
              <input style={input} value={newImgLabel} onChange={(e) => setNewImgLabel(e.target.value)} placeholder="Label (optional)" />
              <button type="button" onClick={addImage} style={{ border: "1px solid #ff3b3b", background: "transparent", color: "#ffd0d0", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                Add Image
              </button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div>Default Image URL</div>
              <select style={input} value={cfg.defaultImageUrl} onChange={(e) => setCfg(normalize({ ...cfg, defaultImageUrl: e.target.value }))}>
                <option value="">None</option>
                {cfg.imageLibrary.map((img) => (
                  <option key={img.url} value={img.url}>
                    {img.label ? `${img.label} - ${img.url}` : img.url}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {cfg.imageLibrary.length === 0 ? (
                <div style={{ color: "#ff9f9f" }}>No images yet.</div>
              ) : (
                cfg.imageLibrary.map((img) => (
                  <div key={img.url} style={{ border: "1px solid #5f0000", borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                    <div style={{ color: "#ffd0d0", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <div>{img.label || "Unlabeled image"}</div>
                      <div style={{ opacity: 0.8, fontSize: 12 }}>{img.url}</div>
                    </div>
                    <button type="button" onClick={() => removeImage(img.url)} style={{ border: "1px solid #ff3b3b", background: "transparent", color: "#ffd0d0", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Notes</h3>
            <textarea style={{ ...input, minHeight: 120 }} value={cfg.notes} onChange={(e) => setCfg(normalize({ ...cfg, notes: e.target.value }))} />
          </div>

          <ConfigJsonEditor
            title="Advanced Giveaways Config"
            value={cfg}
            disabled={saving}
            onApply={async (next) => {
              const normalized = normalize(next as GiveawaysUiConfig);
              setCfg(normalized);
              await saveAll(normalized);
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <Link href={`/dashboard/economy?guildId=${encodeURIComponent(guildId)}`} style={{ color: "#fff" }}>
              Back to Economy
            </Link>
            <button
              onClick={() => void saveAll()}
              disabled={saving}
              style={{ border: "1px solid #ff3636", background: "#190000", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
              type="button"
            >
              {saving ? "Saving..." : "Save Giveaways"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
