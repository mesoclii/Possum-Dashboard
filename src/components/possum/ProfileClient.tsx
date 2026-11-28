"use client";

import { useState, type CSSProperties } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor, type GuildRole } from "@/components/possum/useGuildEngineEditor";

type AssetKind = "backgrounds" | "frames" | "badges";

type UnlockRules = {
  unlockedByDefault: boolean;
  unlockRoleId: string;
  unlockLevel: number;
  unlockAchievementId: string;
  description: string;
};

type BackgroundAsset = UnlockRules & { id: string; name: string; imageUrl: string; accentColor: string };
type FrameAsset = UnlockRules & { id: string; name: string; color: string };
type BadgeAsset = UnlockRules & { id: string; name: string; label: string; emoji: string; color: string };

type ProfileCfg = {
  enabled: boolean;
  repEnabled: boolean;
  titleEditingEnabled: boolean;
  bioEnabled: boolean;
  accentEditingEnabled: boolean;
  repCooldownHours: number;
  maxEquippedBadges: number;
  titleMaxLength: number;
  bioMaxLength: number;
  featuredAchievementsMax: number;
  defaultShowcaseStats: string[];
  defaultBackgroundId: string;
  defaultFrameId: string;
  panelTitle: string;
  panelDescription: string;
  panelImageUrl: string;
  studioPanelChannelId: string;
  assetLibrary: { backgrounds: BackgroundAsset[]; frames: FrameAsset[]; badges: BadgeAsset[] };
  notes: string;
};

// Mirrors SHOWCASE_STATS in engine/profileEngine.js.
const SHOWCASE_STATS: Array<{ id: string; label: string }> = [
  { id: "level", label: "Level + XP" },
  { id: "rank", label: "Server rank" },
  { id: "coins", label: "Coins" },
  { id: "reputation", label: "Reputation" },
  { id: "streak", label: "Activity streak" },
  { id: "achievements", label: "Achievement count" },
  { id: "prestige", label: "Prestige" },
  { id: "yearsServed", label: "Years served" },
  { id: "crew", label: "Crew" },
  { id: "highlights", label: "Auto highlights" },
];

const DEFAULT_CFG: ProfileCfg = {
  enabled: true,
  repEnabled: true,
  titleEditingEnabled: true,
  bioEnabled: true,
  accentEditingEnabled: true,
  repCooldownHours: 24,
  maxEquippedBadges: 3,
  titleMaxLength: 32,
  bioMaxLength: 190,
  featuredAchievementsMax: 3,
  defaultShowcaseStats: SHOWCASE_STATS.map((row) => row.id),
  defaultBackgroundId: "possum-night",
  defaultFrameId: "iron",
  panelTitle: "Profile Studio",
  panelDescription: "",
  panelImageUrl: "",
  studioPanelChannelId: "",
  assetLibrary: { backgrounds: [], frames: [], badges: [] },
  notes: "",
};

const shell: CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1360 };
const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};
const input: CSSProperties = { width: "100%", background: "#0a0a0a", color: "#ffd0d0", border: "1px solid #7f0000", borderRadius: 10, padding: "10px 12px" };
const label: CSSProperties = { color: "#ffb9b9", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 };
const heading: CSSProperties = { color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 };
const hint: CSSProperties = { color: "#ffb8b8", fontSize: 12, lineHeight: 1.6 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 };
const button: CSSProperties = { ...input, width: "auto", cursor: "pointer", fontWeight: 900 };
const check: CSSProperties = { color: "#ffdcdc", fontWeight: 700 };

function int(value: unknown, fallback: number, min: number, max: number) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function text(value: unknown, max = 100) {
  return String(value ?? "").slice(0, max);
}

function unlockRules(row: any, defaultUnlocked: boolean): UnlockRules {
  return {
    unlockedByDefault: row?.unlockedByDefault === undefined ? defaultUnlocked : Boolean(row.unlockedByDefault),
    unlockRoleId: text(row?.unlockRoleId, 20),
    unlockLevel: int(row?.unlockLevel, 0, 0, 1000),
    unlockAchievementId: text(row?.unlockAchievementId),
    description: text(row?.description),
  };
}

function normalizeLibrary(value: any): ProfileCfg["assetLibrary"] {
  const rows = (list: unknown) => (Array.isArray(list) ? list.slice(0, 100) : []);
  return {
    backgrounds: rows(value?.backgrounds).map((row: any, i) => ({
      ...unlockRules(row, true),
      id: text(row?.id || `background-${i + 1}`),
      name: text(row?.name || row?.id || `Background ${i + 1}`),
      imageUrl: text(row?.imageUrl, 2048),
      accentColor: text(row?.accentColor || "#c1121f", 7),
    })),
    frames: rows(value?.frames).map((row: any, i) => ({
      ...unlockRules(row, true),
      id: text(row?.id || `frame-${i + 1}`),
      name: text(row?.name || row?.id || `Frame ${i + 1}`),
      color: text(row?.color || "#4a4a4a", 7),
    })),
    badges: rows(value?.badges).map((row: any, i) => ({
      ...unlockRules(row, false),
      id: text(row?.id || `badge-${i + 1}`),
      name: text(row?.name || row?.id || `Badge ${i + 1}`),
      label: text(row?.label || row?.name || ""),
      emoji: text(row?.emoji, 64),
      color: text(row?.color || "#3b1f1f", 7),
    })),
  };
}

function optionRows(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ id: string; label: string }>;
  return value
    .map((row: any) => {
      const id = String(String(row?.value || "").split("|")[0] || "").trim();
      return { id, label: String(row?.name || row?.title || id || "Unknown").trim() };
    })
    .filter((row) => row.id);
}

function mergeOptions(detailRows: Array<{ id: string; label: string }>, customRows: Array<{ id: string; name: string }>) {
  const map = new Map<string, { id: string; label: string }>();
  for (const row of detailRows) map.set(row.id, row);
  for (const row of customRows) if (row.id) map.set(row.id, { id: row.id, label: row.name || row.id });
  return Array.from(map.values());
}

function newAsset(kind: AssetKind, index: number) {
  const n = index + 1;
  if (kind === "backgrounds") return { ...unlockRules({}, false), id: `background-${n}`, name: `Background ${n}`, imageUrl: "", accentColor: "#c1121f" };
  if (kind === "frames") return { ...unlockRules({}, false), id: `frame-${n}`, name: `Frame ${n}`, color: "#4a4a4a" };
  return { ...unlockRules({}, false), id: `badge-${n}`, name: `Badge ${n}`, label: `BADGE ${n}`, emoji: "", color: "#3b1f1f" };
}

function unlockSummary(row: UnlockRules, roles: GuildRole[]) {
  if (row.unlockedByDefault) return "Everyone has it";
  const parts: string[] = [];
  if (row.unlockRoleId) parts.push(`role ${roles.find((role) => role.id === row.unlockRoleId)?.name || row.unlockRoleId}`);
  if (row.unlockLevel > 0) parts.push(`level ${row.unlockLevel}`);
  if (row.unlockAchievementId) parts.push(`achievement ${row.unlockAchievementId}`);
  return parts.length ? `Unlocks with ${parts.join(" or ")}` : "Locked: staff grant only";
}

function UnlockEditor({ row, roles, onChange }: { row: UnlockRules; roles: GuildRole[]; onChange: (patch: Partial<UnlockRules>) => void }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px dashed #4d0000", paddingTop: 12 }}>
      <label style={check}>
        <input type="checkbox" checked={row.unlockedByDefault} onChange={(e) => onChange({ unlockedByDefault: e.target.checked })} /> Everyone has this
      </label>
      {!row.unlockedByDefault ? (
        <div style={{ ...grid, marginTop: 10 }}>
          <div>
            <div style={label}>Unlock with role</div>
            <select style={input} value={row.unlockRoleId} onChange={(e) => onChange({ unlockRoleId: e.target.value })}>
              <option value="">No role rule</option>
              {roles.filter((role) => role.name !== "@everyone").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </div>
          <div>
            <div style={label}>Unlock at level</div>
            <input style={input} type="number" min={0} max={1000} value={row.unlockLevel} onChange={(e) => onChange({ unlockLevel: int(e.target.value, 0, 0, 1000) })} />
          </div>
          <div>
            <div style={label}>Unlock with achievement id</div>
            <input style={input} maxLength={100} value={row.unlockAchievementId} placeholder="e.g. messages_1000" onChange={(e) => onChange({ unlockAchievementId: e.target.value })} />
          </div>
        </div>
      ) : null}
      <div style={{ ...hint, marginTop: 8 }}>{unlockSummary(row, roles)}. Any one rule is enough. Locked items show members how to unlock them.</div>
    </div>
  );
}

export default function ProfileClient() {
  const {
    guildId,
    guildName,
    config: rawCfg,
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
  } = useGuildEngineEditor<ProfileCfg>("profile", DEFAULT_CFG);
  const [assetTab, setAssetTab] = useState<AssetKind>("backgrounds");

  const cfg: ProfileCfg = {
    ...DEFAULT_CFG,
    ...rawCfg,
    defaultShowcaseStats: Array.isArray(rawCfg.defaultShowcaseStats) && rawCfg.defaultShowcaseStats.length
      ? rawCfg.defaultShowcaseStats
      : DEFAULT_CFG.defaultShowcaseStats,
    assetLibrary: normalizeLibrary(rawCfg.assetLibrary),
  };
  const library = cfg.assetLibrary;
  const patch = (next: Partial<ProfileCfg>) => setCfg((prev) => ({ ...prev, ...next }));
  const setLibrary = (kind: AssetKind, rows: any[]) =>
    setCfg((prev) => ({ ...prev, assetLibrary: { ...normalizeLibrary(prev.assetLibrary), [kind]: rows } }));
  const updateAsset = (kind: AssetKind, index: number, next: Record<string, unknown>) =>
    setLibrary(kind, library[kind].map((row, i) => (i === index ? { ...row, ...next } : row)));

  const backgroundOptions = mergeOptions(optionRows(details.backgrounds), library.backgrounds);
  const frameOptions = mergeOptions(optionRows(details.frames), library.frames);
  const textChannels = channels.filter((channel) => channel.type === 0 || channel.type === 5 || channel.type === "GUILD_TEXT" || channel.type === undefined);

  function saveProfile() {
    void save({
      ...cfg,
      repCooldownHours: int(cfg.repCooldownHours, 24, 1, 8760),
      maxEquippedBadges: int(cfg.maxEquippedBadges, 3, 1, 25),
      titleMaxLength: int(cfg.titleMaxLength, 32, 1, 100),
      bioMaxLength: int(cfg.bioMaxLength, 190, 20, 400),
      featuredAchievementsMax: int(cfg.featuredAchievementsMax, 3, 0, 10),
      assetLibrary: normalizeLibrary(cfg.assetLibrary),
    });
  }

  function toggleShowcase(id: string, on: boolean) {
    const next = on ? [...new Set([...cfg.defaultShowcaseStats, id])] : cfg.defaultShowcaseStats.filter((stat) => stat !== id);
    patch({ defaultShowcaseStats: SHOWCASE_STATS.map((row) => row.id).filter((stat) => next.includes(stat)) });
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  const tabRows = library[assetTab];

  return (
    <div style={shell}>
      <EngineContractPanel
        engineKey="profile"
        intro="Profile is the member-facing identity card. Members build it in Discord with the Profile Studio panel; this page sets the rules, the cosmetics they can unlock and where the panel lives."
        related={[
          { label: "Progression", route: "/dashboard/economy/progression", reason: "levels and XP feed the card and level unlocks" },
          { label: "Achievements", route: "/dashboard/achievements", reason: "members pin earned achievements; achievements can unlock cosmetics" },
          { label: "Hall Of Fame", route: "/dashboard/halloffame", reason: "public recognition should match profile-facing stat visibility" },
          { label: "Loyalty", route: "/dashboard/loyalty", reason: "tenure shows as years served" },
          { label: "Prestige", route: "/dashboard/prestige", reason: "prestige count can show on the card" },
        ]}
      />

      <div style={{ color: "#ff9999", marginTop: -2, marginBottom: 12 }}>Guild: {guildName || "Selected server"}</div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading profile engine...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={heading}>How members use it</div>
            <ol style={{ ...hint, fontSize: 13, margin: 0, paddingLeft: 18 }}>
              <li>Post the Profile Studio panel in a channel below, or members run <strong>/profile panel</strong>.</li>
              <li><strong>Edit Text</strong> sets their title, bio and accent colour. <strong>Background</strong>, <strong>Frame</strong> and <strong>Badges</strong> list what they&apos;ve unlocked, plus what&apos;s still locked and how to get it.</li>
              <li><strong>Showcase</strong> picks which stats their card shows; <strong>Featured</strong> pins up to {cfg.featuredAchievementsMax} achievements they&apos;ve earned.</li>
              <li><strong>Preview Card</strong> or <strong>/profile view</strong> shows the finished card. Other members see it with <strong>/profile view @member</strong>.</li>
            </ol>
          </section>

          <section style={card}>
            <div style={heading}>What members can edit</div>
            <div style={grid}>
              <label style={check}><input type="checkbox" checked={cfg.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> Profile engine enabled</label>
              <label style={check}><input type="checkbox" checked={cfg.repEnabled} onChange={(e) => patch({ repEnabled: e.target.checked })} /> Reputation (/rep)</label>
              <label style={check}><input type="checkbox" checked={cfg.titleEditingEnabled} onChange={(e) => patch({ titleEditingEnabled: e.target.checked })} /> Custom title</label>
              <label style={check}><input type="checkbox" checked={cfg.bioEnabled} onChange={(e) => patch({ bioEnabled: e.target.checked })} /> Bio</label>
              <label style={check}><input type="checkbox" checked={cfg.accentEditingEnabled} onChange={(e) => patch({ accentEditingEnabled: e.target.checked })} /> Accent colour</label>
            </div>
            <div style={{ ...grid, marginTop: 14 }}>
              <div>
                <div style={label}>Rep cooldown (hours)</div>
                <input style={input} type="number" min={1} max={8760} value={int(cfg.repCooldownHours, 24, 1, 8760)} onChange={(e) => patch({ repCooldownHours: int(e.target.value, 1, 1, 8760) })} />
              </div>
              <div>
                <div style={label}>Max equipped badges</div>
                <input style={input} type="number" min={1} max={25} value={int(cfg.maxEquippedBadges, 3, 1, 25)} onChange={(e) => patch({ maxEquippedBadges: int(e.target.value, 1, 1, 25) })} />
              </div>
              <div>
                <div style={label}>Title max length</div>
                <input style={input} type="number" min={1} max={100} value={int(cfg.titleMaxLength, 32, 1, 100)} onChange={(e) => patch({ titleMaxLength: int(e.target.value, 1, 1, 100) })} />
              </div>
              <div>
                <div style={label}>Bio max length</div>
                <input style={input} type="number" min={20} max={400} value={int(cfg.bioMaxLength, 190, 20, 400)} onChange={(e) => patch({ bioMaxLength: int(e.target.value, 20, 20, 400) })} />
              </div>
              <div>
                <div style={label}>Featured achievements (0 = off)</div>
                <input style={input} type="number" min={0} max={10} value={int(cfg.featuredAchievementsMax, 3, 0, 10)} onChange={(e) => patch({ featuredAchievementsMax: int(e.target.value, 0, 0, 10) })} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={heading}>Default card stats</div>
            <div style={hint}>What a card shows until the member picks their own with Showcase.</div>
            <div style={{ ...grid, marginTop: 10 }}>
              {SHOWCASE_STATS.map((stat) => (
                <label key={stat.id} style={check}>
                  <input type="checkbox" checked={cfg.defaultShowcaseStats.includes(stat.id)} onChange={(e) => toggleShowcase(stat.id, e.target.checked)} /> {stat.label}
                </label>
              ))}
            </div>
          </section>

          <section style={card}>
            <div style={heading}>Profile Studio panel in Discord</div>
            <div style={hint}>Posts a message with <strong>Open Profile Studio</strong> and <strong>View My Card</strong> buttons. Each member gets their own private studio when they click. Posting again updates the same message.</div>
            <div style={{ ...grid, marginTop: 10 }}>
              <div>
                <div style={label}>Channel</div>
                <select style={input} value={cfg.studioPanelChannelId} onChange={(e) => patch({ studioPanelChannelId: e.target.value })}>
                  <option value="">Choose a channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>Panel title</div>
                <input style={input} maxLength={256} value={cfg.panelTitle} onChange={(e) => patch({ panelTitle: e.target.value })} />
              </div>
              <div>
                <div style={label}>Panel image URL (optional)</div>
                <input style={input} type="url" maxLength={2048} value={cfg.panelImageUrl} placeholder="https://..." onChange={(e) => patch({ panelImageUrl: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={label}>Panel description</div>
              <textarea
                style={{ ...input, minHeight: 80 }}
                maxLength={2000}
                value={cfg.panelDescription}
                placeholder="Build your profile card: title, bio, accent colour, background, frame, badges and the achievements you want to show off."
                onChange={(e) => patch({ panelDescription: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <button
                style={button}
                disabled={saving || !cfg.studioPanelChannelId}
                onClick={() => void runAction("deployPanel", { channelId: cfg.studioPanelChannelId })}
              >
                Post panel to channel
              </button>
              <span style={hint}>Save first so the panel uses your latest title and text.</span>
            </div>
          </section>

          <section style={card}>
            <div style={heading}>Default cosmetics for new members</div>
            <div style={grid}>
              <div>
                <div style={label}>Default background</div>
                <select style={input} value={cfg.defaultBackgroundId} onChange={(e) => patch({ defaultBackgroundId: e.target.value })}>
                  <option value="">Select background</option>
                  {backgroundOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </div>
              <div>
                <div style={label}>Default frame</div>
                <select style={input} value={cfg.defaultFrameId} onChange={(e) => patch({ defaultFrameId: e.target.value })}>
                  <option value="">Select frame</option>
                  {frameOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={heading}>Cosmetic library</div>
                <div style={hint}>Your server&apos;s own backgrounds, frames and badges. Using the same id as a built-in item replaces it.</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["backgrounds", "frames", "badges"] as AssetKind[]).map((kind) => (
                  <button
                    key={kind}
                    style={{ ...button, background: assetTab === kind ? "#3a0000" : "#0a0a0a" }}
                    onClick={() => setAssetTab(kind)}
                  >
                    {kind[0].toUpperCase() + kind.slice(1)} ({library[kind].length})
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {tabRows.map((row: any, index: number) => (
                <div key={`${assetTab}_${index}`} style={{ border: "1px solid #4d0000", borderRadius: 12, padding: 14, background: "#120000" }}>
                  <div style={grid}>
                    <div>
                      <div style={label}>Id</div>
                      <input style={input} maxLength={100} value={row.id} onChange={(e) => updateAsset(assetTab, index, { id: e.target.value })} />
                    </div>
                    <div>
                      <div style={label}>Display name</div>
                      <input style={input} maxLength={100} value={row.name} onChange={(e) => updateAsset(assetTab, index, { name: e.target.value })} />
                    </div>
                    {assetTab === "badges" ? (
                      <>
                        <div>
                          <div style={label}>Badge text</div>
                          <input style={input} maxLength={100} value={row.label} placeholder="FOUNDER" onChange={(e) => updateAsset(assetTab, index, { label: e.target.value })} />
                        </div>
                        <div>
                          <div style={label}>Emoji (optional)</div>
                          <input style={input} maxLength={64} value={row.emoji} placeholder="🏆 or <:name:id>" onChange={(e) => updateAsset(assetTab, index, { emoji: e.target.value })} />
                        </div>
                      </>
                    ) : null}
                    {assetTab === "backgrounds" ? (
                      <>
                        <div>
                          <div style={label}>Accent colour</div>
                          <input style={input} value={row.accentColor} placeholder="#c1121f" onChange={(e) => updateAsset(assetTab, index, { accentColor: e.target.value })} />
                        </div>
                        <div>
                          <div style={label}>Image URL</div>
                          <input style={input} type="url" maxLength={2048} value={row.imageUrl} placeholder="https://..." onChange={(e) => updateAsset(assetTab, index, { imageUrl: e.target.value })} />
                        </div>
                      </>
                    ) : (
                      <div>
                        <div style={label}>Colour</div>
                        <input style={input} value={row.color} placeholder="#4a4a4a" onChange={(e) => updateAsset(assetTab, index, { color: e.target.value })} />
                      </div>
                    )}
                    <div>
                      <div style={label}>Description (shown in the picker)</div>
                      <input style={input} maxLength={100} value={row.description} onChange={(e) => updateAsset(assetTab, index, { description: e.target.value })} />
                    </div>
                  </div>
                  {assetTab === "backgrounds" && /^https:\/\//.test(row.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imageUrl} alt="" style={{ marginTop: 10, maxWidth: 320, width: "100%", borderRadius: 8, border: `2px solid ${row.accentColor}` }} />
                  ) : null}
                  <UnlockEditor row={row} roles={roles} onChange={(next) => updateAsset(assetTab, index, next)} />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button style={button} onClick={() => setLibrary(assetTab, tabRows.filter((_: unknown, i: number) => i !== index))}>Remove</button>
                  </div>
                </div>
              ))}
              {!tabRows.length ? <div style={hint}>No custom {assetTab} yet.</div> : null}
            </div>
            <button
              style={{ ...button, marginTop: 12 }}
              disabled={tabRows.length >= 100}
              onClick={() => setLibrary(assetTab, [...tabRows, newAsset(assetTab, tabRows.length)])}
            >
              Add {assetTab.slice(0, -1)}
            </button>
          </section>

          <section style={card}>
            <div style={label}>Profile notes</div>
            <textarea
              style={{ ...input, minHeight: 100 }}
              value={cfg.notes || ""}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Profile policy, title rules, badge expectations, or linked progression notes."
            />
          </section>

          <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ ...hint, fontSize: 13, maxWidth: 840 }}>
              To test: save, post the panel (or run /profile panel), unlock something with a role you have, and check it appears in the picker.
            </div>
            <button onClick={saveProfile} disabled={saving} style={button}>{saving ? "Saving..." : "Save Profile"}</button>
          </section>
        </>
      )}
    </div>
  );
}
