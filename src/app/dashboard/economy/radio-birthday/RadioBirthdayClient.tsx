"use client";

import { useEffect, useMemo, useState } from "react";

type Role = { id: string; name: string; position?: number };
type Channel = { id: string; name: string; type?: number | string };

type RadioBirthdayConfig = {
  active: boolean;
  birthday: {
    enabled: boolean;
    rewardCoins: number;
    roleId: string;
    broadcastChannelId: string;
    timezone: string;
    allowSelfSet: boolean;
  };
};

const DEFAULT_CFG: RadioBirthdayConfig = {
  active: true,
  birthday: {
    enabled: true,
    rewardCoins: 500,
    roleId: "",
    broadcastChannelId: "",
    timezone: "America/Los_Angeles",
    allowSelfSet: true,
  },
};

function getGuildId(): string {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("guildId") || "";
  const fromStore = localStorage.getItem("activeGuildId") || "";
  const guildId = (fromUrl || fromStore).trim();
  if (guildId) localStorage.setItem("activeGuildId", guildId);
  return guildId;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function mergeCfg(raw: any): RadioBirthdayConfig {
  return {
    ...DEFAULT_CFG,
    ...(raw || {}),
    birthday: {
      ...DEFAULT_CFG.birthday,
      ...(raw?.birthday || {}),
      rewardCoins: boundedInt(raw?.birthday?.rewardCoins, DEFAULT_CFG.birthday.rewardCoins, 0, 1_000_000_000),
      roleId: String(raw?.birthday?.roleId || ""),
      broadcastChannelId: String(raw?.birthday?.broadcastChannelId || ""),
      timezone: String(raw?.birthday?.timezone || DEFAULT_CFG.birthday.timezone),
    },
  };
}

const card: React.CSSProperties = {
  border: "1px solid rgba(255,0,0,.38)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(110,0,0,.10)",
  marginBottom: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid rgba(255,0,0,.45)",
  color: "#ffd5d5",
  borderRadius: 8,
  padding: "10px 12px",
};

export default function RadioBirthdayPage() {
  const [guildId, setGuildId] = useState("");
  const [cfg, setCfg] = useState<RadioBirthdayConfig>(DEFAULT_CFG);
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [summary, setSummary] = useState<Array<{ label: string; value: string }>>([]);
  const [profileRows, setProfileRows] = useState<Array<{ title: string; value: string }>>([]);

  useEffect(() => setGuildId(getGuildId()), []);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setMsg("");
        const [cfgRes, gdRes] = await Promise.all([
          fetch(`/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=radio`, { cache: "no-store" }),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`),
        ]);

        const cfgJson = await cfgRes.json().catch(() => ({}));
        const gdJson = await gdRes.json().catch(() => ({}));
        if (!cfgRes.ok || cfgJson?.success === false || !cfgJson?.config || typeof cfgJson.config !== "object") {
          throw new Error(cfgJson?.error || "Failed to load Radio settings.");
        }

        setCfg(mergeCfg(cfgJson?.config));
        setSummary(Array.isArray(cfgJson?.summary) ? cfgJson.summary : []);
        setProfileRows(Array.isArray(cfgJson?.details?.profiles) ? cfgJson.details.profiles : []);
        setRoles(
          (Array.isArray(gdJson?.roles) ? gdJson.roles : [])
            .map((r: any) => ({ id: String(r.id), name: String(r.name), position: Number(r.position || 0) }))
            .sort((a: Role, b: Role) => b.position! - a.position!)
        );
        setChannels(Array.isArray(gdJson?.channels) ? gdJson.channels : []);
        if (!gdRes.ok || gdJson?.success === false) {
          setMsg(gdJson?.error || "Radio settings loaded, but Discord roles and channels could not be loaded.");
        }
      } catch (e: any) {
        setMsg(e?.message || "Failed to load live radio/birthday runtime.");
      } finally {
        setLoading(false);
      }
    })();
  }, [guildId]);

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5),
    [channels]
  );

  async function savePatch(patch: Partial<RadioBirthdayConfig>, okLabel: string) {
    if (!guildId) return;
    setSaving(true);
    setMsg("");
    try {
      if (patch.birthday?.timezone !== undefined) {
        const timezone = String(patch.birthday.timezone || "").trim();
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      }
      const res = await fetch("/api/runtime/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "radio", patch }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Save failed");
      setCfg(mergeCfg(json?.config || cfg));
      if (Array.isArray(json?.summary)) setSummary(json.summary);
      if (Array.isArray(json?.details?.profiles)) setProfileRows(json.details.profiles);
      setMsg(okLabel);
    } catch (e: any) {
      setMsg(e instanceof RangeError ? "Enter a valid IANA timezone, such as America/Los_Angeles." : e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!guildId) return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ maxWidth: 1260, color: "#ffd0d0" }}>
      <div style={{ ...card, position: "sticky", top: 8, zIndex: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, color: "#ff4747", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Radio Birthday Engine
            </h1>
            <div style={{ marginTop: 6, color: "#ff9c9c", fontSize: 13 }}>Guild: {typeof window !== 'undefined' ? (localStorage.getItem('activeGuildName') || guildId) : guildId}</div>
            <div style={{ marginTop: 3, color: "#ffb5b5", fontSize: 12 }}>
              `/radio` in this bot is the birthday profile surface. This page only exposes the live birthday fields the runtime actually uses.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={!!cfg.active}
                onChange={(e) => setCfg((p) => ({ ...p, active: e.target.checked }))}
              />
              Engine Active
            </label>
            <button
              onClick={() => savePatch(cfg, "Saved Radio/Birthday engine.")}
              disabled={saving || loading}
              style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
            >
              {saving ? "Saving..." : "Save All"}
            </button>
          </div>
        </div>
        {msg ? <div style={{ marginTop: 8, color: "#ffb3f0", fontSize: 12 }}>{msg}</div> : null}
      </div>

      {loading ? <div style={{ padding: 12 }}>Loading...</div> : null}

      {!loading ? (
        <>
          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Radio Status
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
              {summary.map((entry) => (
                <div key={entry.label} style={{ ...card, marginBottom: 0 }}>
                  <div style={{ color: "#ffadad", fontSize: 11, textTransform: "uppercase" }}>{entry.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{entry.value}</div>
                </div>
              ))}
            </div>
            <h4 style={{ color: "#ff9c9c", marginBottom: 8 }}>Upcoming birthdays</h4>
            {profileRows.length ? profileRows.map((entry, index) => (
              <div key={`${entry.title}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid rgba(255,0,0,.2)", padding: "8px 0", flexWrap: "wrap" }}>
                <strong>{entry.title}</strong><span>{entry.value}</span>
              </div>
            )) : <div style={{ color: "#ffb3b3", fontSize: 13 }}>No birthday profiles are available.</div>}
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Radio Birthday Controls
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={!!cfg.birthday.enabled}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, birthday: { ...p.birthday, enabled: e.target.checked } }))
                  }
                />{" "}
                Birthday enabled
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={!!cfg.birthday.allowSelfSet}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, birthday: { ...p.birthday, allowSelfSet: e.target.checked } }))
                  }
                />{" "}
                Members can set their own birthday
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 10, marginTop: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 5 }}>Birthday reward coins</label>
                <input
                  style={input}
                  type="number"
                  min={0}
                  max={1_000_000_000}
                  step={1}
                  value={cfg.birthday.rewardCoins}
                  onChange={(e) =>
                    setCfg((p) => ({
                      ...p,
                      birthday: { ...p.birthday, rewardCoins: boundedInt(e.target.value, 0, 0, 1_000_000_000) },
                    }))
                  }
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5 }}>Timezone</label>
                <input
                  style={input}
                  value={cfg.birthday.timezone || ""}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, birthday: { ...p.birthday, timezone: e.target.value } }))
                  }
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 5 }}>Birthday role</label>
                <select
                  style={input}
                  value={cfg.birthday.roleId || ""}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, birthday: { ...p.birthday, roleId: e.target.value } }))
                  }
                >
                  <option value="">No role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", marginBottom: 5 }}>Birthday broadcast channel</label>
              <select
                style={input}
                value={cfg.birthday.broadcastChannelId || ""}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, birthday: { ...p.birthday, broadcastChannelId: e.target.value } }))
                }
              >
                <option value="">No channel</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => savePatch({ birthday: cfg.birthday }, "Saved birthday settings.")}
                disabled={saving}
                style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }}
              >
                Save Birthday
              </button>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 13, lineHeight: 1.7 }}>
              There is no separate live radio playback runtime behind this surface. Music routing lives in the dedicated
              Music engine. This page now stays scoped to the actual `/radio` birthday workflow only.
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
