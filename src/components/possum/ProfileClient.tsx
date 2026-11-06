"use client";

import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type ProfileBackgroundAsset = {
  id: string;
  name: string;
  imageUrl: string;
  accentColor: string;
  unlockedByDefault: boolean;
};

type ProfileCfg = {
  enabled: boolean;
  repEnabled: boolean;
  titleEditingEnabled: boolean;
  repCooldownHours: number;
  maxEquippedBadges: number;
  titleMaxLength: number;
  defaultBackgroundId: string;
  defaultFrameId: string;
  assetLibrary: {
    backgrounds: ProfileBackgroundAsset[];
  };
  notes: string;
};

const DEFAULT_CFG: ProfileCfg = {
  enabled: true,
  repEnabled: true,
  titleEditingEnabled: true,
  repCooldownHours: 24,
  maxEquippedBadges: 3,
  titleMaxLength: 32,
  defaultBackgroundId: "possum-night",
  defaultFrameId: "iron",
  assetLibrary: {
    backgrounds: [],
  },
  notes: "",
};

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1360 };
const card: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};
const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};
const label: React.CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

function optionRows(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ id: string; label: string; meta: string }>;
  return value
    .map((row: any) => {
      const meta = String(row?.value || "").trim();
      const id = String(meta.split("|")[0] || "").trim();
      const label = String(row?.name || row?.title || id || "Unknown").trim();
      return { id, label, meta };
    })
    .filter((row) => row.id);
}

function mergeBackgroundOptions(detailRows: Array<{ id: string; label: string; meta: string }>, customRows: ProfileBackgroundAsset[]) {
  const map = new Map<string, { id: string; label: string; meta: string }>();
  for (const row of detailRows || []) map.set(row.id, row);
  for (const row of customRows || []) {
    if (!row.id) continue;
    map.set(row.id, { id: row.id, label: row.name || row.id, meta: row.id });
  }
  return Array.from(map.values());
}

function normalizeBackgroundLibrary(value: unknown): ProfileBackgroundAsset[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((row: any, index) => ({
    id: String(row?.id || `background-${index + 1}`).trim().slice(0, 100) || `background-${index + 1}`,
    name: String(row?.name || row?.id || `Background ${index + 1}`).trim().slice(0, 100) || `Background ${index + 1}`,
    imageUrl: String(row?.imageUrl || "").trim().slice(0, 2048),
    accentColor: String(row?.accentColor || "#c1121f").trim() || "#c1121f",
    unlockedByDefault: row?.unlockedByDefault !== false,
  }));
}

export default function ProfileClient() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<ProfileCfg>("profile", DEFAULT_CFG);

  const detailBackgroundOptions = optionRows(details.backgrounds);
  const frameOptions = optionRows(details.frames);
  const badgeOptions = optionRows(details.badges);
  const backgroundLibrary = normalizeBackgroundLibrary(cfg.assetLibrary?.backgrounds);
  const backgroundOptions = mergeBackgroundOptions(detailBackgroundOptions, backgroundLibrary);

  function updateBackground(index: number, patch: Partial<ProfileBackgroundAsset>) {
    setCfg((prev) => {
      const nextRows = normalizeBackgroundLibrary(prev.assetLibrary?.backgrounds);
      nextRows[index] = { ...nextRows[index], ...patch };
      return {
        ...prev,
        assetLibrary: {
          backgrounds: nextRows,
        },
      };
    });
  }

  function addBackground() {
    setCfg((prev) => ({
      ...prev,
      assetLibrary: {
        backgrounds: [
          ...normalizeBackgroundLibrary(prev.assetLibrary?.backgrounds),
          {
            id: `background-${normalizeBackgroundLibrary(prev.assetLibrary?.backgrounds).length + 1}`,
            name: `Background ${normalizeBackgroundLibrary(prev.assetLibrary?.backgrounds).length + 1}`,
            imageUrl: "",
            accentColor: "#c1121f",
            unlockedByDefault: false,
          },
        ],
      },
    }));
  }

  function saveProfile() {
    const normalized = {
      ...cfg,
      repCooldownHours: Math.max(1, Math.min(8760, Math.floor(Number(cfg.repCooldownHours) || 24))),
      maxEquippedBadges: Math.max(1, Math.min(25, Math.floor(Number(cfg.maxEquippedBadges) || 3))),
      titleMaxLength: Math.max(1, Math.min(100, Math.floor(Number(cfg.titleMaxLength) || 32))),
      assetLibrary: { backgrounds: normalizeBackgroundLibrary(cfg.assetLibrary?.backgrounds) },
    };
    void save(normalized);
  }

  function removeBackground(index: number) {
    setCfg((prev) => ({
      ...prev,
      assetLibrary: {
        backgrounds: normalizeBackgroundLibrary(prev.assetLibrary?.backgrounds).filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={shell}>
      <EngineContractPanel
        engineKey="profile"
        intro="Profile is the member-facing identity and reputation surface. It should stay linked to progression, achievements, hall of fame, loyalty, and prestige instead of becoming a separate competing stat system."
        related={[
          { label: "Progression", route: "/dashboard/economy/progression", reason: "levels and XP feed the profile rank surface" },
          { label: "Achievements", route: "/dashboard/achievements", reason: "badges and milestone unlocks surface through profile cosmetics and prestige gating" },
          { label: "Hall Of Fame", route: "/dashboard/halloffame", reason: "public recognition should match profile-facing stat visibility" },
          { label: "Loyalty", route: "/dashboard/loyalty", reason: "tenure rewards should stay visible in the profile stack" },
          { label: "Prestige", route: "/dashboard/prestige", reason: "prestige is the late-loop capstone for the same achievement family" },
        ]}
      />

      <div style={{ color: "#ff9999", marginTop: -2, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={card}>Loading profile engine...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((prev) => ({ ...prev, enabled: e.target.checked }))} /> Profile engine enabled
              </label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.repEnabled} onChange={(e) => setCfg((prev) => ({ ...prev, repEnabled: e.target.checked }))} /> Reputation enabled
              </label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.titleEditingEnabled} onChange={(e) => setCfg((prev) => ({ ...prev, titleEditingEnabled: e.target.checked }))} /> Title editing enabled
              </label>
            </div>
            <div style={{ color: "#ffb8b8", fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
              This controls the live member profile surface, not just a shell. Reputation cooldowns, title editing, default cosmetics, and badge limits are enforced by the actual profile engine.
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Profile Policy
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Rep Cooldown (hours)</div>
                <input style={input} type="number" min={1} max={8760} step={1} value={Math.max(1, Math.min(8760, Math.floor(Number(cfg.repCooldownHours) || 24)))} onChange={(e) => setCfg((prev) => ({ ...prev, repCooldownHours: Math.max(1, Math.min(8760, Math.floor(Number(e.target.value) || 1))) }))} />
              </div>
              <div>
                <div style={label}>Max Equipped Badges</div>
                <input style={input} type="number" min={1} max={25} step={1} value={Math.max(1, Math.min(25, Math.floor(Number(cfg.maxEquippedBadges) || 3)))} onChange={(e) => setCfg((prev) => ({ ...prev, maxEquippedBadges: Math.max(1, Math.min(25, Math.floor(Number(e.target.value) || 1))) }))} />
              </div>
              <div>
                <div style={label}>Title Max Length</div>
                <input style={input} type="number" min={1} max={100} step={1} value={Math.max(1, Math.min(100, Math.floor(Number(cfg.titleMaxLength) || 32)))} onChange={(e) => setCfg((prev) => ({ ...prev, titleMaxLength: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))) }))} />
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Default Cosmetics
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Default Background</div>
                <select style={input} value={cfg.defaultBackgroundId} onChange={(e) => setCfg((prev) => ({ ...prev, defaultBackgroundId: e.target.value }))}>
                  <option value="">Select background</option>
                  {backgroundOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label} ({row.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Default Frame</div>
                <select style={input} value={cfg.defaultFrameId} onChange={(e) => setCfg((prev) => ({ ...prev, defaultFrameId: e.target.value }))}>
                  <option value="">Select frame</option>
                  {frameOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label} ({row.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12, color: "#ffb8b8", fontSize: 12, lineHeight: 1.7 }}>
              Asset library currently visible: {backgroundOptions.length} backgrounds, {frameOptions.length} frames, {badgeOptions.length} badges.
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Card Background Studio</div>
                <div style={{ color: "#ffb8b8", fontSize: 12, marginTop: 6 }}>
                  Build the shared background library for profile cards, rank cards, level-up cards, and badge cards. If an image URL is set, the live embeds will use it.
                </div>
              </div>
              <button onClick={addBackground} disabled={backgroundLibrary.length >= 100} style={{ ...input, width: "auto", cursor: backgroundLibrary.length >= 100 ? "not-allowed" : "pointer", fontWeight: 900 }}>Add Background</button>
            </div>

            {backgroundLibrary.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {backgroundLibrary.map((row, index) => (
                  <div key={`${row.id}_${index}`} style={{ border: "1px solid #4d0000", borderRadius: 12, padding: 14, background: "#120000" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                      <div>
                        <div style={label}>Background Id</div>
                        <input style={input} maxLength={100} value={row.id} onChange={(e) => updateBackground(index, { id: e.target.value })} />
                      </div>
                      <div>
                        <div style={label}>Display Name</div>
                        <input style={input} maxLength={100} value={row.name} onChange={(e) => updateBackground(index, { name: e.target.value })} />
                      </div>
                      <div>
                        <div style={label}>Accent Color</div>
                        <input style={input} value={row.accentColor} onChange={(e) => updateBackground(index, { accentColor: e.target.value })} placeholder="#c1121f" />
                      </div>
                      <div>
                        <div style={label}>Image URL</div>
                        <input style={input} type="url" maxLength={2048} value={row.imageUrl} onChange={(e) => updateBackground(index, { imageUrl: e.target.value })} placeholder="https://..." />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                      <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                        <input type="checkbox" checked={row.unlockedByDefault} onChange={(e) => updateBackground(index, { unlockedByDefault: e.target.checked })} /> Unlocked by default
                      </label>
                      <button onClick={() => removeBackground(index)} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#ffb8b8", fontSize: 12 }}>No custom guild backgrounds yet. Add one to start building your card library.</div>
            )}
          </section>

          <section style={card}>
            <div style={label}>Profile Notes</div>
            <textarea
              style={{ ...input, minHeight: 120 }}
              value={cfg.notes || ""}
              onChange={(e) => setCfg((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Profile policy, title rules, badge expectations, or linked progression notes."
            />
          </section>

          <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffb8b8", lineHeight: 1.6, maxWidth: 840 }}>
              This page owns the live profile policy. Achievement progression, hall-of-fame recognition, loyalty, and prestige stay linked, but the actual member-facing identity rules live here.
            </div>
            <button onClick={saveProfile} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
