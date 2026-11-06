"use client";

import { useEffect, useMemo, useState } from "react";

type Role = {
  id: string;
  name: string;
  managed?: boolean;
  position?: number;
};

type Channel = {
  id: string;
  name: string;
  type?: string | number;
};

type PanelRole = {
  id: string;
  label: string;
  emoji?: unknown;
};

type Panel = {
  id: string;
  name: string;
  singleSelect: boolean;
  roles: PanelRole[];
};

type Config = {
  channelId: string;
  panels: Panel[];
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #7a0000",
  background: "#0b0b0b",
  color: "#ffd8d8",
};

const card: React.CSSProperties = {
  border: "1px solid #6a0000",
  borderRadius: 12,
  background: "rgba(120,0,0,0.10)",
  padding: 12,
  marginBottom: 12,
};

function getGuildId() {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  const gid = String(q.get("guildId") || q.get("guildid") || localStorage.getItem("activeGuildId") || "").trim();
  if (gid) localStorage.setItem("activeGuildId", gid);
  return gid;
}

function normalizePanelId(inputId: string, idx: number) {
  const cleaned = String(inputId || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return cleaned || `panel_${idx + 1}`;
}

function shortSnowflake(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "unknown";
  if (text.length <= 8) return text;
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function emojiToInput(emoji: unknown): string {
  if (!emoji) return "";
  if (typeof emoji === "string") return emoji;
  if (typeof emoji === "object" && emoji) {
    const anyEmoji: any = emoji;
    const id = anyEmoji.id ? String(anyEmoji.id) : "";
    const name = anyEmoji.name ? String(anyEmoji.name) : "emoji";
    const animated = anyEmoji.animated ? "a" : "";
    if (id) return `<${animated}:${name}:${id}>`;
  }
  return "";
}

function makePanel(index: number): Panel {
  return {
    id: `panel_${index + 1}`,
    name: `Panel ${index + 1}`,
    singleSelect: false,
    roles: [],
  };
}

function makePanelRole(): PanelRole {
  return {
    id: "",
    label: "",
    emoji: "",
  };
}

function isTextChannel(c: Channel): boolean {
  const t = String(c.type ?? "").toUpperCase();
  if (!t) return true;
  return t.includes("TEXT") || t === "0" || t === "5" || t.includes("ANNOUNCEMENT");
}

function mergeRoleOptions(roleList: Role[], loaded: Config): Role[] {
  const byId = new Map<string, Role>();
  for (const role of roleList) {
    byId.set(String(role.id || "").trim(), role);
  }

  for (const panel of loaded.panels || []) {
    for (const row of panel.roles || []) {
      const roleId = String(row.id || "").trim();
      if (!roleId || byId.has(roleId)) continue;
      byId.set(roleId, {
        id: roleId,
        name: String(row.label || `Missing role ${shortSnowflake(roleId)}`).trim(),
        managed: false,
        position: -1,
      });
    }
  }

  return [...byId.values()].sort((a, b) => {
    const pa = Number(a?.position || 0);
    const pb = Number(b?.position || 0);
    if (pa !== pb) return pb - pa;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

function mergeChannelOptions(channelList: Channel[], loaded: Config): Channel[] {
  const byId = new Map<string, Channel>();
  for (const channel of channelList) {
    byId.set(String(channel.id || "").trim(), channel);
  }

  const channelId = String(loaded.channelId || "").trim();
  if (channelId && !byId.has(channelId)) {
    byId.set(channelId, {
      id: channelId,
      name: `saved-channel-${shortSnowflake(channelId)}`,
      type: "0",
    });
  }

  return [...byId.values()].sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""))
  );
}

export default function RolesClient() {
  const [guildId, setGuildId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [cfg, setCfg] = useState<Config>({ channelId: "", panels: [] });
  const [orig, setOrig] = useState<Config>({ channelId: "", panels: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setGuildId(getGuildId());
  }, []);

  useEffect(() => {
    if (!guildId) return;

    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const [guildRes, selfrolesRes] = await Promise.all([
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
          fetch(`/api/bot/selfroles-panels?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
        ]);

        const guildJson = await guildRes.json().catch(() => ({}));
        const selfrolesJson = await selfrolesRes.json().catch(() => ({}));
        if (!selfrolesRes.ok || selfrolesJson?.success === false) {
          throw new Error(selfrolesJson?.error || "Failed to load selfrole engine data.");
        }

        const remoteCfg = selfrolesJson?.config || {};
        const loaded: Config = {
          channelId: String(remoteCfg?.channelId || ""),
          panels: Array.isArray(remoteCfg?.panels)
            ? remoteCfg.panels.map((p: any, idx: number) => ({
                id: normalizePanelId(String(p?.id || p?.name || ""), idx),
                name: String(p?.name || `Panel ${idx + 1}`),
                singleSelect: Boolean(p?.singleSelect),
                roles: Array.isArray(p?.roles)
                  ? p.roles.map((r: any) => ({
                      id: String(r?.id || ""),
                      label: String(r?.label || ""),
                      emoji: r?.emoji,
                    }))
                  : [],
              }))
            : [],
        };

        const guildName = String(guildJson?.guild?.name || "").trim();
        if (guildName && typeof window !== "undefined") {
          localStorage.setItem("activeGuildName", guildName);
        }

        const guildError =
          !guildRes.ok || guildJson?.success === false
            ? String(guildJson?.error || "Failed to load live guild roles/channels.")
            : "";
        const roleList: Role[] =
          !guildError && Array.isArray(guildJson?.roles) ? guildJson.roles : [];
        const channelList: Channel[] =
          !guildError && Array.isArray(guildJson?.channels) ? guildJson.channels : [];
        const textChannels = channelList.filter(isTextChannel);

        setRoles(mergeRoleOptions(roleList, loaded));
        setChannels(mergeChannelOptions(textChannels, loaded));
        setCfg(loaded);
        setOrig(loaded);
        if (guildError) {
          setMsg(`${guildError} Showing saved selfrole mappings until live guild data loads again.`);
        }
      } catch (e: any) {
        setMsg(e?.message || "Failed to load roles/selfroles data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  const roleNameById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of roles) out[r.id] = r.name;
    return out;
  }, [roles]);

  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(orig), [cfg, orig]);

  function addPanel() {
    setCfg((prev) => ({
      ...prev,
      panels: [...prev.panels, makePanel(prev.panels.length)],
    }));
  }

  function removePanel(index: number) {
    setCfg((prev) => ({
      ...prev,
      panels: prev.panels.filter((_, i) => i !== index),
    }));
  }

  function updatePanel(index: number, patch: Partial<Panel>) {
    setCfg((prev) => {
      const next = [...prev.panels];
      next[index] = { ...next[index], ...patch };
      return { ...prev, panels: next };
    });
  }

  function addRole(panelIndex: number) {
    setCfg((prev) => {
      const panels = [...prev.panels];
      const panel = { ...panels[panelIndex] };
      panel.roles = [...panel.roles, makePanelRole()];
      panels[panelIndex] = panel;
      return { ...prev, panels };
    });
  }

  function removeRole(panelIndex: number, roleIndex: number) {
    setCfg((prev) => {
      const panels = [...prev.panels];
      const panel = { ...panels[panelIndex] };
      panel.roles = panel.roles.filter((_, i) => i !== roleIndex);
      panels[panelIndex] = panel;
      return { ...prev, panels };
    });
  }

  function updateRole(panelIndex: number, roleIndex: number, patch: Partial<PanelRole>) {
    setCfg((prev) => {
      const panels = [...prev.panels];
      const panel = { ...panels[panelIndex] };
      const rows = [...panel.roles];
      rows[roleIndex] = { ...rows[roleIndex], ...patch };
      panel.roles = rows;
      panels[panelIndex] = panel;
      return { ...prev, panels };
    });
  }

  function selectRole(panelIndex: number, roleIndex: number, roleId: string) {
    setCfg((prev) => {
      const panels = [...prev.panels];
      const panel = { ...panels[panelIndex] };
      const rows = [...panel.roles];
      const old = rows[roleIndex];
      const oldName = roleNameById[old.id] || "";
      const nextName = roleNameById[roleId] || "";
      const keepCustomLabel = old.label && old.label !== oldName;
      rows[roleIndex] = {
        ...old,
        id: roleId,
        label: keepCustomLabel ? old.label : nextName || old.label || "",
      };
      panel.roles = rows;
      panels[panelIndex] = panel;
      return { ...prev, panels };
    });
  }

  async function save() {
    if (!guildId) return;
    setSaving(true);
    setMsg("");

    try {
      const payload = {
        guildId,
        channelId: cfg.channelId,
        panels: cfg.panels.map((panel, idx) => ({
          id: normalizePanelId(panel.id, idx),
          name: String(panel.name || `Panel ${idx + 1}`).trim(),
          singleSelect: Boolean(panel.singleSelect),
          roles: panel.roles
            .map((r) => ({
              id: String(r.id || "").trim(),
              label: String(r.label || roleNameById[r.id] || r.id || "").trim(),
              emoji: r.emoji,
            }))
            .filter((r) => r.id),
        })),
      };

      const res = await fetch("/api/bot/selfroles-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `Save failed (${res.status})`);
      }

      const savedCfg: Config = {
        channelId: String(json?.config?.channelId || ""),
        panels: Array.isArray(json?.config?.panels)
          ? json.config.panels.map((p: any, idx: number) => ({
              id: normalizePanelId(String(p?.id || p?.name || ""), idx),
              name: String(p?.name || `Panel ${idx + 1}`),
              singleSelect: Boolean(p?.singleSelect),
              roles: Array.isArray(p?.roles)
                ? p.roles.map((r: any) => ({
                    id: String(r?.id || ""),
                    label: String(r?.label || ""),
                    emoji: r?.emoji,
                  }))
                : [],
            }))
          : [],
      };

      setCfg(savedCfg);
      setOrig(savedCfg);
      setMsg("Saved selfrole panels to engine store. Run /selfroles deploy in Discord to publish buttons.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to save selfrole panels.");
    } finally {
      setSaving(false);
    }
  }

  if (!guildId) {
    return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  }

  if (loading) {
    return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading selfrole engine config...</div>;
  }

  return (
    <div style={{ color: "#ffb3b3", padding: 16, maxWidth: 1400 }}>
      <h1 style={{ marginTop: 0, color: "#ff2a2a", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Selfrole Button Studio
      </h1>
      <p style={{ marginTop: 0, color: "#ff8a8a" }}>
        Guild: {typeof window !== 'undefined' ? (localStorage.getItem('activeGuildName') || guildId) : guildId} | Engine entity: selfroles only (separate from economy/store/giveaways)
      </p>

      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ marginBottom: 6 }}>Panel Channel</div>
            <select
              style={input}
              value={cfg.channelId}
              onChange={(e) => setCfg((prev) => ({ ...prev, channelId: e.target.value }))}
            >
              <option value="">Select channel...</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ color: "#ff9a9a", fontSize: 13 }}>
            Save writes to your live selfroles engine store.
            <br />
            Publish with <strong>/selfroles deploy</strong>.
          </div>

          <button
            onClick={addPanel}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #7a0000",
              background: "#1a0000",
              color: "#ffd7d7",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            + Add Panel
          </button>
        </div>
      </div>

      {cfg.panels.map((panel, pi) => (
        <div key={`${panel.id}_${pi}`} style={card}>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 180px auto", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ marginBottom: 6 }}>Panel ID</div>
              <input
                style={input}
                value={panel.id}
                onChange={(e) => updatePanel(pi, { id: e.target.value })}
                onBlur={(e) => updatePanel(pi, { id: normalizePanelId(e.target.value, pi) })}
              />
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>Panel Name</div>
              <input style={input} value={panel.name} onChange={(e) => updatePanel(pi, { name: e.target.value })} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
              <input
                type="checkbox"
                checked={panel.singleSelect}
                onChange={(e) => updatePanel(pi, { singleSelect: e.target.checked })}
              />
              Single select
            </label>
            <button
              onClick={() => removePanel(pi)}
              style={{
                marginTop: 20,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #7a0000",
                background: "#2a0000",
                color: "#ffd7d7",
                cursor: "pointer",
              }}
            >
              Remove Panel
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, color: "#ff8f8f", fontWeight: 700 }}>Role Buttons</div>

            {panel.roles.map((row, ri) => (
              <div
                key={`${panel.id}_${ri}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 1fr 140px auto",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <select style={input} value={row.id} onChange={(e) => selectRole(pi, ri, e.target.value)}>
                  <option value="">Select role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>

                <input
                  style={input}
                  value={row.label}
                  placeholder="Button label"
                  onChange={(e) => updateRole(pi, ri, { label: e.target.value })}
                />

                <input
                  style={input}
                  value={emojiToInput(row.emoji)}
                  placeholder="emoji"
                  onChange={(e) => updateRole(pi, ri, { emoji: e.target.value })}
                />

                <button
                  onClick={() => removeRole(pi, ri)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #7a0000",
                    background: "#2a0000",
                    color: "#ffd7d7",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              onClick={() => addRole(pi)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #7a0000",
                background: "#160000",
                color: "#ffd7d7",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              + Add Role Button
            </button>
          </div>
        </div>
      ))}

      {cfg.panels.length === 0 && (
        <div style={{ ...card, color: "#ff8a8a" }}>
          No selfrole panels yet. Click <strong>+ Add Panel</strong> to create your first one.
        </div>
      )}

      {msg ? <div style={{ ...card, color: "#ffadad" }}>{msg}</div> : null}

      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 70,
          border: "1px solid #7a0000",
          borderRadius: 12,
          background: "rgba(20,0,0,0.96)",
          padding: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
          boxShadow: "0 0 18px rgba(255,0,0,0.25)",
        }}
      >
        <span style={{ color: dirty ? "#ffb3f0" : "#ffb3f0", fontSize: 12 }}>{dirty ? "DIRTY" : "READY"}</span>
        <button
          disabled={saving || !dirty}
          onClick={save}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #7a0000",
            background: saving || !dirty ? "#140000" : "#220000",
            color: saving || !dirty ? "#8a6666" : "#ffd7d7",
            cursor: saving || !dirty ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {saving ? "Saving..." : "Save Panels"}
        </button>
      </div>
    </div>
  );
}
