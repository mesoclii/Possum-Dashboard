/* eslint-disable @next/next/no-img-element */
"use client";

import { clampNumber } from "@/lib/dashboard/numberInput";

import { useMemo } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type WeaponKey = "pistol" | "smg" | "rifle" | "shotgun" | "sniper";

type RangeCfg = {
  enabled: boolean;
  allowedChannelIds: string[];
  winningPoints: number;
  shootCooldownMs: number;
  defaultWeapon: WeaponKey;
  presentation: {
    setupTitle: string;
    liveTitle: string;
    introText: string;
    footerText: string;
    setupImageUrl: string;
    liveImageUrl: string;
  };
  weapons: Record<WeaponKey, { displayName: string; imageUrl: string }>;
  rewardTuning: {
    critPoints: number;
    hitPoints: number;
    grazePoints: number;
    hitXp: number;
    winCoins: number;
    winXp: number;
  };
};

const WEAPON_STATS: Record<WeaponKey, { clip: number; reserve: number; accuracyMod: number; misfireMod: number; pointsMod: number }> = {
  pistol: { clip: 12, reserve: 36, accuracyMod: 0.04, misfireMod: 0, pointsMod: 0 },
  smg: { clip: 30, reserve: 90, accuracyMod: -0.03, misfireMod: 0.01, pointsMod: -2 },
  rifle: { clip: 30, reserve: 90, accuracyMod: 0.03, misfireMod: 0, pointsMod: 1 },
  shotgun: { clip: 8, reserve: 32, accuracyMod: -0.06, misfireMod: 0.015, pointsMod: 3 },
  sniper: { clip: 5, reserve: 20, accuracyMod: 0.1, misfireMod: -0.01, pointsMod: 4 },
};

const EMPTY: RangeCfg = {
  enabled: true,
  allowedChannelIds: [],
  winningPoints: 150,
  shootCooldownMs: 2000,
  defaultWeapon: "rifle",
  presentation: {
    setupTitle: "Range Setup Panel",
    liveTitle: "Range Live Target",
    introText: "Configure the range, set the weapon, and press start when the shooters are ready.",
    footerText: "Use buttons to configure the range, then press Start.",
    setupImageUrl: "",
    liveImageUrl: "",
  },
  weapons: {
    pistol: { displayName: "Pistol", imageUrl: "" },
    smg: { displayName: "SMG", imageUrl: "" },
    rifle: { displayName: "Rifle", imageUrl: "" },
    shotgun: { displayName: "Shotgun", imageUrl: "" },
    sniper: { displayName: "Sniper", imageUrl: "" },
  },
  rewardTuning: {
    critPoints: 30,
    hitPoints: 15,
    grazePoints: 8,
    hitXp: 5,
    winCoins: 30,
    winXp: 35,
  },
};

const box: React.CSSProperties = {
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

function toggle(list: string[], id: string) {
  const set = new Set(list || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return Array.from(set);
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Image load failed."));
    reader.readAsDataURL(file);
  });
}

export default function RangeEnginePage() {
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
  } = useGuildEngineEditor<RangeCfg>("range", EMPTY);

  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );

  const weaponEntries = useMemo(() => Object.entries(WEAPON_STATS) as Array<[WeaponKey, typeof WEAPON_STATS[WeaponKey]]>, []);

  function updateWeapon(key: WeaponKey, patch: Partial<RangeCfg["weapons"][WeaponKey]>) {
    setCfg((prev) => ({
      ...prev,
      weapons: {
        ...prev.weapons,
        [key]: {
          ...prev.weapons[key],
          ...patch,
        },
      },
    }));
  }

  async function uploadImage(
    event: React.ChangeEvent<HTMLInputElement>,
    target: "setup" | "live" | WeaponKey
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file).catch(() => "");
    if (!dataUrl) return;

    if (target === "setup") {
      setCfg((prev) => ({
        ...prev,
        presentation: { ...prev.presentation, setupImageUrl: dataUrl },
      }));
    } else if (target === "live") {
      setCfg((prev) => ({
        ...prev,
        presentation: { ...prev.presentation, liveImageUrl: dataUrl },
      }));
    } else {
      updateWeapon(target, { imageUrl: dataUrl });
    }
    event.target.value = "";
  }

  if (!guildId) return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1400 }}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Range Engine</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb8b8", lineHeight: 1.6, maxWidth: 980, marginBottom: 12 }}>
        This tab now controls the actual range engine: weapon defaults, scoring pace, live panel art, setup copy, allowed channels,
        and per-weapon branding. The bot uses these settings directly when it builds the setup and live embeds.
      </div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={box}>Loading...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={{ ...box, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Engine State</div>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                  <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))} />
                  Enabled
                </label>
              </div>
              <div>
                <div style={label}>Winning Points</div>
                <input style={input} type="number" min={1} max={100000} value={cfg.winningPoints} onChange={(e) => setCfg((p) => ({ ...p, winningPoints: clampNumber(e.target.value, 1, 100000) }))} />
              </div>
              <div>
                <div style={label}>Shoot Cooldown (ms)</div>
                <input style={input} type="number" min={0} max={600000} value={cfg.shootCooldownMs} onChange={(e) => setCfg((p) => ({ ...p, shootCooldownMs: clampNumber(e.target.value, 0, 600000) }))} />
              </div>
              <div>
                <div style={label}>Default Weapon</div>
                <select style={input} value={cfg.defaultWeapon} onChange={(e) => setCfg((p) => ({ ...p, defaultWeapon: e.target.value as WeaponKey }))}>
                  {weaponEntries.map(([key]) => (
                    <option key={key} value={key}>
                      {cfg.weapons[key]?.displayName || key}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Reward + Scoring Tuning
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Critical Hit Points</div>
                <input style={input} type="number" min={0} max={10000} value={cfg.rewardTuning.critPoints} onChange={(e) => setCfg((p) => ({ ...p, rewardTuning: { ...p.rewardTuning, critPoints: clampNumber(e.target.value, 0, 10000) } }))} />
              </div>
              <div>
                <div style={label}>Standard Hit Points</div>
                <input style={input} type="number" min={0} max={10000} value={cfg.rewardTuning.hitPoints} onChange={(e) => setCfg((p) => ({ ...p, rewardTuning: { ...p.rewardTuning, hitPoints: clampNumber(e.target.value, 0, 10000) } }))} />
              </div>
              <div>
                <div style={label}>Graze Points</div>
                <input style={input} type="number" min={0} max={10000} value={cfg.rewardTuning.grazePoints} onChange={(e) => setCfg((p) => ({ ...p, rewardTuning: { ...p.rewardTuning, grazePoints: clampNumber(e.target.value, 0, 10000) } }))} />
              </div>
              <div>
                <div style={label}>Hit XP</div>
                <input style={input} type="number" min={0} max={10000} value={cfg.rewardTuning.hitXp} onChange={(e) => setCfg((p) => ({ ...p, rewardTuning: { ...p.rewardTuning, hitXp: clampNumber(e.target.value, 0, 10000) } }))} />
              </div>
              <div>
                <div style={label}>Win Coins</div>
                <input style={input} type="number" min={0} max={1000000} value={cfg.rewardTuning.winCoins} onChange={(e) => setCfg((p) => ({ ...p, rewardTuning: { ...p.rewardTuning, winCoins: clampNumber(e.target.value, 0, 1000000) } }))} />
              </div>
              <div>
                <div style={label}>Win XP</div>
                <input style={input} type="number" min={0} max={100000} value={cfg.rewardTuning.winXp} onChange={(e) => setCfg((p) => ({ ...p, rewardTuning: { ...p.rewardTuning, winXp: clampNumber(e.target.value, 0, 100000) } }))} />
              </div>
            </div>
            <div style={{ color: "#ffb8b8", fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
              These values now drive the live range session itself: shot scoring, per-hit progression XP, and winner payouts.
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Presentation + Panel Copy
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Setup Title</div>
                <input style={input} value={cfg.presentation.setupTitle} onChange={(e) => setCfg((p) => ({ ...p, presentation: { ...p.presentation, setupTitle: e.target.value } }))} />
              </div>
              <div>
                <div style={label}>Live Title</div>
                <input style={input} value={cfg.presentation.liveTitle} onChange={(e) => setCfg((p) => ({ ...p, presentation: { ...p.presentation, liveTitle: e.target.value } }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginTop: 14 }}>
              <div>
                <div style={label}>Intro Copy</div>
                <textarea style={{ ...input, minHeight: 110 }} value={cfg.presentation.introText} onChange={(e) => setCfg((p) => ({ ...p, presentation: { ...p.presentation, introText: e.target.value } }))} />
              </div>
              <div>
                <div style={label}>Footer Copy</div>
                <textarea style={{ ...input, minHeight: 110 }} value={cfg.presentation.footerText} onChange={(e) => setCfg((p) => ({ ...p, presentation: { ...p.presentation, footerText: e.target.value } }))} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14, marginTop: 14 }}>
              <div>
                <div style={label}>Setup Image URL</div>
                <input style={input} value={cfg.presentation.setupImageUrl} onChange={(e) => setCfg((p) => ({ ...p, presentation: { ...p.presentation, setupImageUrl: e.target.value } }))} placeholder="https://..." />
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: "#ffb8b8", fontSize: 12 }}>Use a public https image link (Discord cannot render uploaded data).</span>
                </div>
                {cfg.presentation.setupImageUrl ? (
                  <div style={{ marginTop: 10, border: "1px solid #460000", borderRadius: 12, overflow: "hidden" }}>
                    <img src={cfg.presentation.setupImageUrl} alt="Setup preview" style={{ width: "100%", display: "block", maxHeight: 180, objectFit: "cover" }} />
                  </div>
                ) : null}
              </div>
              <div>
                <div style={label}>Live Image URL</div>
                <input style={input} value={cfg.presentation.liveImageUrl} onChange={(e) => setCfg((p) => ({ ...p, presentation: { ...p.presentation, liveImageUrl: e.target.value } }))} placeholder="https://..." />
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: "#ffb8b8", fontSize: 12 }}>Use a public https image link (Discord cannot render uploaded data).</span>
                </div>
                {cfg.presentation.liveImageUrl ? (
                  <div style={{ marginTop: 10, border: "1px solid #460000", borderRadius: 12, overflow: "hidden" }}>
                    <img src={cfg.presentation.liveImageUrl} alt="Live preview" style={{ width: "100%", display: "block", maxHeight: 180, objectFit: "cover" }} />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Allowed Channels
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10 }}>
              {textChannels.map((c) => (
                <label key={c.id} style={{ display: "block", marginBottom: 6, color: "#ffdcdc" }}>
                  <input
                    type="checkbox"
                    checked={cfg.allowedChannelIds.includes(c.id)}
                    onChange={() => setCfg((p) => ({ ...p, allowedChannelIds: toggle(p.allowedChannelIds, c.id) }))}
                  />{" "}
                  #{c.name}
                </label>
              ))}
            </div>
            <div style={{ color: "#ffb8b8", fontSize: 12, marginTop: 10 }}>
              Leave this empty if range should be allowed anywhere. Otherwise only the checked channels can host sessions.
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Weapon Presentation
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
              {weaponEntries.map(([key, stats]) => {
                const weapon = cfg.weapons[key];
                return (
                  <div key={key} style={{ border: "1px solid #460000", borderRadius: 12, padding: 14, background: "rgba(18,0,0,0.78)" }}>
                    <div style={{ color: "#ff5a5a", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                      {key}
                    </div>
                    <div style={label}>Display Name</div>
                    <input style={input} value={weapon.displayName} onChange={(e) => updateWeapon(key, { displayName: e.target.value })} />
                    <div style={{ ...label, marginTop: 12 }}>Weapon Art URL</div>
                    <input style={input} value={weapon.imageUrl} onChange={(e) => updateWeapon(key, { imageUrl: e.target.value })} placeholder="https://..." />
                    <div style={{ marginTop: 8 }}>
                      <span style={{ color: "#ffb8b8", fontSize: 12 }}>Use a public https image link (Discord cannot render uploaded data).</span>
                    </div>
                    {weapon.imageUrl ? (
                      <div style={{ marginTop: 10, border: "1px solid #460000", borderRadius: 12, overflow: "hidden" }}>
                        <img src={weapon.imageUrl} alt={`${weapon.displayName} art`} style={{ width: "100%", display: "block", maxHeight: 160, objectFit: "cover" }} />
                      </div>
                    ) : null}
                    <div style={{ color: "#ffb8b8", fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>
                      <div>Clip: {stats.clip}</div>
                      <div>Reserve: {stats.reserve}</div>
                      <div>Accuracy Mod: {stats.accuracyMod}</div>
                      <div>Misfire Mod: {stats.misfireMod}</div>
                      <div>Points Mod: {stats.pointsMod}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section style={{ ...box, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffb8b8", lineHeight: 1.6, maxWidth: 820 }}>
              Range settings apply to new sessions. Cooldown 0 means no shot delay; image links must be public https URLs. Hit and win coins are always paid: through Progression when it is active, otherwise credited directly.
            </div>
            <button onClick={() => save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Range"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
