"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor, type GuildRole } from "@/components/possum/useGuildEngineEditor";

type WorkJob = {
  id: string;
  enabled: boolean;
  name: string;
  emoji: string;
  description: string;
  coinsMin: number;
  coinsMax: number;
  xpMin: number;
  xpMax: number;
  cooldownMinutes: number;
  minLevel: number;
  requiredRoleId: string;
  flavorLines: string[];
};

type EconomyRewardsConfig = {
  enabled: boolean;
  daily: {
    coins: number;
    cooldownHours: number;
    streakEnabled: boolean;
    streakBonusPerDay: number;
    streakMaxDays: number;
    streakGraceHours: number;
  };
  work: {
    coinsMin: number;
    coinsMax: number;
    cooldownMinutes: number;
    xpMin: number;
    xpMax: number;
    flavorLines: string[];
    jobsEnabled: boolean;
    jobs: WorkJob[];
    bonusChance: number;
    bonusMultiplier: number;
    promotions: { enabled: boolean; shiftsPerRank: number; payBoostPercent: number; rankTitles: string[] };
  };
};

const DEFAULT_RANKS = ["Trainee", "Associate", "Senior", "Lead", "Boss"];

const DEFAULTS: EconomyRewardsConfig = {
  enabled: true,
  daily: { coins: 250, cooldownHours: 24, streakEnabled: false, streakBonusPerDay: 25, streakMaxDays: 7, streakGraceHours: 24 },
  work: {
    coinsMin: 25,
    coinsMax: 75,
    cooldownMinutes: 30,
    xpMin: 0,
    xpMax: 0,
    flavorLines: [],
    jobsEnabled: false,
    jobs: [],
    bonusChance: 0,
    bonusMultiplier: 2,
    promotions: { enabled: true, shiftsPerRank: 10, payBoostPercent: 10, rankTitles: DEFAULT_RANKS },
  },
};

// Starter jobs an owner can drop in and then rename to fit their server.
const STARTER_JOBS: Array<Omit<WorkJob, "id">> = [
  { enabled: true, name: "Courier", emoji: "📦", description: "Run packages across town.", coinsMin: 20, coinsMax: 60, xpMin: 0, xpMax: 5, cooldownMinutes: 0, minLevel: 0, requiredRoleId: "", flavorLines: ["{user} dodged traffic and delivered every package. +{coins} coins.", "{user} made the run in record time."] },
  { enabled: true, name: "Mechanic", emoji: "🔧", description: "Fix up rides at the shop.", coinsMin: 50, coinsMax: 110, xpMin: 5, xpMax: 10, cooldownMinutes: 45, minLevel: 5, requiredRoleId: "", flavorLines: ["{user} rebuilt an engine with a wrench and a prayer.", "{user} found the rattle. It was a loose bolt. It's always a loose bolt."] },
  { enabled: true, name: "Bounty Hunter", emoji: "🎯", description: "High risk, high pay.", coinsMin: 120, coinsMax: 260, xpMin: 10, xpMax: 25, cooldownMinutes: 120, minLevel: 15, requiredRoleId: "", flavorLines: ["{user} tracked the target across three districts and cashed in.", "{user} brought the bounty back. Mostly in one piece."] },
];

const styles: Record<string, CSSProperties> = {
  page: { color: "#ffb3b3", padding: 14, maxWidth: 1200 },
  card: { border: "1px solid #5f0000", borderRadius: 12, padding: 14, background: "rgba(120,0,0,0.10)", marginBottom: 12 },
  input: { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #6f0000", background: "#0a0a0a", color: "#ffd7d7" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 },
  hint: { fontSize: 13, color: "#ff9d9d", margin: "4px 0 10px" },
  button: { padding: "8px 12px", borderRadius: 8, border: "1px solid #7f0000", background: "#1a0000", color: "#ffd7d7", cursor: "pointer", fontWeight: 800 },
  h3: { marginTop: 0, color: "#ff4444" },
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampFloat(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function toLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((line) => String(line ?? ""));
  return String(value || "").split(/\r?\n/);
}

function cleanLines(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function slugify(value: string, fallback: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;
}

function normalizeJob(raw: any, index: number): WorkJob {
  return {
    id: String(raw?.id || `job-${index + 1}`),
    enabled: raw?.enabled !== false,
    name: String(raw?.name || ""),
    emoji: String(raw?.emoji || ""),
    description: String(raw?.description || ""),
    coinsMin: clampInt(raw?.coinsMin, 25, 0, 1_000_000),
    coinsMax: clampInt(raw?.coinsMax, 75, 0, 1_000_000),
    xpMin: clampInt(raw?.xpMin, 0, 0, 10_000),
    xpMax: clampInt(raw?.xpMax, 0, 0, 10_000),
    cooldownMinutes: clampInt(raw?.cooldownMinutes, 0, 0, 1440),
    minLevel: clampInt(raw?.minLevel, 0, 0, 1000),
    requiredRoleId: String(raw?.requiredRoleId || ""),
    flavorLines: toLines(raw?.flavorLines),
  };
}

function normalizeConfig(cfg: any): EconomyRewardsConfig {
  const daily = cfg?.daily || {};
  const work = cfg?.work || {};
  const promotions = work.promotions || {};
  const ranks = toLines(promotions.rankTitles);
  return {
    ...cfg,
    enabled: cfg?.enabled !== false,
    daily: {
      coins: clampInt(daily.coins, DEFAULTS.daily.coins, 0, 1_000_000),
      cooldownHours: clampInt(daily.cooldownHours, DEFAULTS.daily.cooldownHours, 1, 72),
      streakEnabled: daily.streakEnabled === true,
      streakBonusPerDay: clampInt(daily.streakBonusPerDay, DEFAULTS.daily.streakBonusPerDay, 0, 100_000),
      streakMaxDays: clampInt(daily.streakMaxDays, DEFAULTS.daily.streakMaxDays, 1, 365),
      streakGraceHours: clampInt(daily.streakGraceHours, DEFAULTS.daily.streakGraceHours, 1, 168),
    },
    work: {
      coinsMin: clampInt(work.coinsMin, DEFAULTS.work.coinsMin, 0, 1_000_000),
      coinsMax: clampInt(work.coinsMax, DEFAULTS.work.coinsMax, 0, 1_000_000),
      cooldownMinutes: clampInt(work.cooldownMinutes, DEFAULTS.work.cooldownMinutes, 1, 720),
      xpMin: clampInt(work.xpMin, DEFAULTS.work.xpMin, 0, 10_000),
      xpMax: clampInt(work.xpMax, DEFAULTS.work.xpMax, 0, 10_000),
      flavorLines: toLines(work.flavorLines),
      jobsEnabled: work.jobsEnabled === true,
      jobs: (Array.isArray(work.jobs) ? work.jobs : []).map(normalizeJob),
      bonusChance: clampFloat(work.bonusChance, 0, 0, 1),
      bonusMultiplier: clampFloat(work.bonusMultiplier, 2, 1, 10),
      promotions: {
        enabled: promotions.enabled !== false,
        shiftsPerRank: clampInt(promotions.shiftsPerRank, 10, 1, 1000),
        payBoostPercent: clampFloat(promotions.payBoostPercent, 10, 0, 500),
        rankTitles: ranks.length && cleanLines(ranks).length ? ranks : DEFAULT_RANKS,
      },
    },
  };
}

// Strips blank lines and fixes inverted ranges before the config goes to the bot.
function prepareForSave(cfg: EconomyRewardsConfig): EconomyRewardsConfig {
  const seen = new Set<string>();
  return {
    ...cfg,
    work: {
      ...cfg.work,
      coinsMax: Math.max(cfg.work.coinsMin, cfg.work.coinsMax),
      xpMax: Math.max(cfg.work.xpMin, cfg.work.xpMax),
      flavorLines: cleanLines(cfg.work.flavorLines),
      promotions: { ...cfg.work.promotions, rankTitles: cleanLines(cfg.work.promotions.rankTitles) },
      jobs: cfg.work.jobs.map((job, index) => {
        let id = slugify(job.id || job.name, `job-${index + 1}`);
        while (seen.has(id)) id = `${id}-${index + 1}`;
        seen.add(id);
        return {
          ...job,
          id,
          name: job.name.trim() || `Job ${index + 1}`,
          coinsMax: Math.max(job.coinsMin, job.coinsMax),
          xpMax: Math.max(job.xpMin, job.xpMax),
          flavorLines: cleanLines(job.flavorLines),
        };
      }),
    },
  };
}

function NumberField({ label, value, onChange, min = 0, max = 1_000_000, step = 1, hint }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; hint?: string;
}) {
  return (
    <div>
      <label>{label}</label>
      <input
        style={styles.input}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(step < 1 ? clampFloat(e.target.value, value, min, max) : clampInt(e.target.value, value, min, max))}
      />
      {hint ? <div style={{ ...styles.hint, marginBottom: 0 }}>{hint}</div> : null}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>{title}</h3>
      {hint ? <p style={styles.hint}>{hint}</p> : null}
      {children}
    </div>
  );
}

function JobEditor({ job, roles, onChange, onRemove, onMove, index, total }: {
  job: WorkJob; roles: GuildRole[]; onChange: (patch: Partial<WorkJob>) => void; onRemove: () => void; onMove: (delta: number) => void; index: number; total: number;
}) {
  return (
    <div style={{ ...styles.card, background: "rgba(0,0,0,0.45)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <strong style={{ color: "#ffd7d7", flex: 1 }}>{job.emoji ? `${job.emoji} ` : ""}{job.name || `Job ${index + 1}`}</strong>
        <label><input type="checkbox" checked={job.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} /> Open</label>
        <button type="button" style={styles.button} disabled={index === 0} onClick={() => onMove(-1)}>Up</button>
        <button type="button" style={styles.button} disabled={index === total - 1} onClick={() => onMove(1)}>Down</button>
        <button type="button" style={styles.button} onClick={onRemove}>Remove</button>
      </div>
      <div style={styles.grid}>
        <div>
          <label>Job name</label>
          <input style={styles.input} value={job.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div>
          <label>Emoji</label>
          <input style={styles.input} value={job.emoji} maxLength={8} placeholder="🔧" onChange={(e) => onChange({ emoji: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Short description (shown on the job board)</label>
          <input style={styles.input} value={job.description} maxLength={100} onChange={(e) => onChange({ description: e.target.value })} />
        </div>
        <NumberField label="Coins min" value={job.coinsMin} onChange={(v) => onChange({ coinsMin: v })} />
        <NumberField label="Coins max" value={job.coinsMax} onChange={(v) => onChange({ coinsMax: v })} />
        <NumberField label="XP min" value={job.xpMin} max={10_000} onChange={(v) => onChange({ xpMin: v })} />
        <NumberField label="XP max" value={job.xpMax} max={10_000} onChange={(v) => onChange({ xpMax: v })} />
        <NumberField label="Rest after shift (min)" value={job.cooldownMinutes} max={1440} hint="0 = server default" onChange={(v) => onChange({ cooldownMinutes: v })} />
        <NumberField label="Minimum level" value={job.minLevel} max={1000} hint="0 = anyone" onChange={(v) => onChange({ minLevel: v })} />
        <div>
          <label>Required role</label>
          <select style={styles.input} value={job.requiredRoleId} onChange={(e) => onChange({ requiredRoleId: e.target.value })}>
            <option value="">Anyone</option>
            {roles.filter((role) => role.name !== "@everyone").map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Shift messages (one per line, picked at random)</label>
          <textarea
            style={{ ...styles.input, minHeight: 80 }}
            value={job.flavorLines.join("\n")}
            placeholder="{user} closed out the shift and pocketed {coins} coins."
            onChange={(e) => onChange({ flavorLines: e.target.value.split("\n") })}
          />
        </div>
      </div>
    </div>
  );
}

export default function EconomyRewardsClient() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<EconomyRewardsConfig>("economyRewards", DEFAULTS);
  const [showHelp, setShowHelp] = useState(false);

  if (!guildId) return <div style={{ color: "#ff8a8a", padding: 20 }}>Missing guildId. Open from /guilds.</div>;
  if (loading) return <div style={{ color: "#ff8a8a", padding: 20 }}>Loading daily/work rewards...</div>;

  const safeCfg = normalizeConfig(cfg);
  const setDaily = (patch: Partial<EconomyRewardsConfig["daily"]>) => setCfg({ ...safeCfg, daily: { ...safeCfg.daily, ...patch } });
  const setWork = (patch: Partial<EconomyRewardsConfig["work"]>) => setCfg({ ...safeCfg, work: { ...safeCfg.work, ...patch } });
  const setPromotions = (patch: Partial<EconomyRewardsConfig["work"]["promotions"]>) =>
    setWork({ promotions: { ...safeCfg.work.promotions, ...patch } });
  const jobs = safeCfg.work.jobs;
  const setJobs = (next: WorkJob[]) => setWork({ jobs: next });
  const newJobId = () => {
    let n = jobs.length + 1;
    while (jobs.some((job) => job.id === `job-${n}`)) n += 1;
    return `job-${n}`;
  };
  const addJob = (template?: Omit<WorkJob, "id">) =>
    setJobs([...jobs, { ...(template || { ...STARTER_JOBS[0], name: "", emoji: "", description: "", flavorLines: [] }), id: template ? slugify(template.name, newJobId()) : newJobId() }]);
  const updateJob = (index: number, patch: Partial<WorkJob>) => setJobs(jobs.map((job, i) => (i === index ? { ...job, ...patch } : job)));
  const moveJob = (index: number, delta: number) => {
    const next = [...jobs];
    const [row] = next.splice(index, 1);
    next.splice(index + delta, 0, row);
    setJobs(next);
  };
  const exampleStreak = Array.from({ length: Math.min(safeCfg.daily.streakMaxDays, 7) }, (_, day) =>
    safeCfg.daily.coins + day * safeCfg.daily.streakBonusPerDay
  );

  return (
    <div style={styles.page}>
      <h1 style={{ marginTop: 0, color: "#ff3b3b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Daily + Work Rewards</h1>
      <p style={{ marginTop: 0 }}>Guild: {guildName || "Selected server"}</p>
      {message ? <div style={{ color: "#ffb3f0", marginBottom: 8 }}>{message}</div> : null}

      <EngineInsights summary={summary} details={details} />

      <div style={styles.card}>
        <label>
          <input type="checkbox" checked={safeCfg.enabled} onChange={(e) => setCfg({ ...safeCfg, enabled: e.target.checked })} /> Rewards enabled
        </label>
        <button type="button" style={{ ...styles.button, marginLeft: 12 }} onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? "Hide" : "How this works"}
        </button>
        {showHelp ? (
          <ul style={{ marginBottom: 0, lineHeight: 1.6 }}>
            <li><strong>/daily</strong> pays a flat amount once per cooldown. Turn on streaks to reward members who come back every day.</li>
            <li><strong>/work</strong> with no jobs pays a random amount from the default range below.</li>
            <li>Turn on the <strong>job board</strong> and add jobs: <strong>/work</strong> then shows the board and members pick a shift. Jobs can need a level or a role, pay their own range, and set how long the member rests afterwards.</li>
            <li><strong>Promotions</strong>: every few shifts in the same job the member moves up a rank and earns more for that job.</li>
            <li>Shift messages can use <code>{"{user}"}</code>, <code>{"{coins}"}</code>, <code>{"{xp}"}</code> and <code>{"{job}"}</code>.</li>
            <li>To test: save, then run <strong>/work</strong> in your server. Staff can reset a balance with <strong>/coins remove</strong>.</li>
          </ul>
        ) : null}
      </div>

      <Section title="/daily">
        <div style={styles.grid}>
          <NumberField label="Coins" value={safeCfg.daily.coins} onChange={(v) => setDaily({ coins: v })} />
          <NumberField label="Cooldown (hours)" value={safeCfg.daily.cooldownHours} min={1} max={72} onChange={(v) => setDaily({ cooldownHours: v })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label>
            <input type="checkbox" checked={safeCfg.daily.streakEnabled} onChange={(e) => setDaily({ streakEnabled: e.target.checked })} /> Daily streak bonus
          </label>
        </div>
        {safeCfg.daily.streakEnabled ? (
          <>
            <div style={{ ...styles.grid, marginTop: 10 }}>
              <NumberField label="Bonus per streak day" value={safeCfg.daily.streakBonusPerDay} max={100_000} onChange={(v) => setDaily({ streakBonusPerDay: v })} />
              <NumberField label="Bonus stops growing at day" value={safeCfg.daily.streakMaxDays} min={1} max={365} onChange={(v) => setDaily({ streakMaxDays: v })} />
              <NumberField label="Grace period (hours)" value={safeCfg.daily.streakGraceHours} min={1} max={168} hint="Extra time after the cooldown before the streak resets" onChange={(v) => setDaily({ streakGraceHours: v })} />
            </div>
            <p style={styles.hint}>Payout by streak day: {exampleStreak.map((coins, day) => `day ${day + 1}: ${coins}`).join(", ")}</p>
          </>
        ) : null}
      </Section>

      <Section title="/work default" hint="Used when the job board is off or has no open jobs. Job rest periods also fall back to this cooldown.">
        <div style={styles.grid}>
          <NumberField label="Coins min" value={safeCfg.work.coinsMin} onChange={(v) => setWork({ coinsMin: v })} />
          <NumberField label="Coins max" value={safeCfg.work.coinsMax} onChange={(v) => setWork({ coinsMax: v })} />
          <NumberField label="Cooldown (minutes)" value={safeCfg.work.cooldownMinutes} min={1} max={720} onChange={(v) => setWork({ cooldownMinutes: v })} />
          <NumberField label="XP min" value={safeCfg.work.xpMin} max={10_000} onChange={(v) => setWork({ xpMin: v })} />
          <NumberField label="XP max" value={safeCfg.work.xpMax} max={10_000} onChange={(v) => setWork({ xpMax: v })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Default shift messages (one per line)</label>
          <textarea
            style={{ ...styles.input, minHeight: 70 }}
            value={safeCfg.work.flavorLines.join("\n")}
            placeholder="{user} put in an honest shift."
            onChange={(e) => setWork({ flavorLines: e.target.value.split("\n") })}
          />
        </div>
      </Section>

      <Section title="Job board" hint="Build the jobs members can pick from with /work.">
        <label>
          <input type="checkbox" checked={safeCfg.work.jobsEnabled} onChange={(e) => setWork({ jobsEnabled: e.target.checked })} /> Show the job board on /work
        </label>
        <div style={{ ...styles.grid, marginTop: 10 }}>
          <NumberField
            label="Bonus shift chance (%)"
            value={Math.round(safeCfg.work.bonusChance * 100)}
            max={100}
            hint="Chance a shift pays extra"
            onChange={(v) => setWork({ bonusChance: v / 100 })}
          />
          <NumberField label="Bonus multiplier" value={safeCfg.work.bonusMultiplier} min={1} max={10} step={0.1} onChange={(v) => setWork({ bonusMultiplier: v })} />
        </div>

        <h4 style={{ color: "#ff6b6b", marginBottom: 6 }}>Promotions</h4>
        <label>
          <input type="checkbox" checked={safeCfg.work.promotions.enabled} onChange={(e) => setPromotions({ enabled: e.target.checked })} /> Members rank up in a job as they work it
        </label>
        {safeCfg.work.promotions.enabled ? (
          <div style={{ ...styles.grid, marginTop: 10 }}>
            <NumberField label="Shifts per rank" value={safeCfg.work.promotions.shiftsPerRank} min={1} max={1000} onChange={(v) => setPromotions({ shiftsPerRank: v })} />
            <NumberField label="Pay boost per rank (%)" value={safeCfg.work.promotions.payBoostPercent} max={500} onChange={(v) => setPromotions({ payBoostPercent: v })} />
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Rank titles, lowest first (one per line)</label>
              <textarea
                style={{ ...styles.input, minHeight: 90 }}
                value={safeCfg.work.promotions.rankTitles.join("\n")}
                onChange={(e) => setPromotions({ rankTitles: e.target.value.split("\n") })}
              />
            </div>
          </div>
        ) : null}

        <h4 style={{ color: "#ff6b6b", marginBottom: 6 }}>Jobs ({jobs.length}/25)</h4>
        {!jobs.length ? <p style={styles.hint}>No jobs yet. Add one, or start from the examples and rename them for your server.</p> : null}
        {jobs.map((job, index) => (
          <JobEditor
            key={`${job.id}-${index}`}
            job={job}
            index={index}
            total={jobs.length}
            roles={roles}
            onChange={(patch) => updateJob(index, patch)}
            onRemove={() => setJobs(jobs.filter((_, i) => i !== index))}
            onMove={(delta) => moveJob(index, delta)}
          />
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={styles.button} disabled={jobs.length >= 25} onClick={() => addJob()}>Add job</button>
          {!jobs.length ? (
            <button type="button" style={styles.button} onClick={() => setJobs(STARTER_JOBS.map((job) => ({ ...job, id: slugify(job.name, "job") })))}>
              Add example jobs
            </button>
          ) : null}
        </div>
      </Section>

      <ConfigJsonEditor
        title="Advanced Rewards Config"
        value={safeCfg}
        disabled={saving}
        onApply={(next) => setCfg(normalizeConfig({ ...DEFAULTS, ...(next as EconomyRewardsConfig) }))}
      />

      <button
        onClick={() => void save(prepareForSave(safeCfg))}
        disabled={saving}
        style={{ ...styles.input, width: "auto", cursor: "pointer", fontWeight: 900 }}
      >
        {saving ? "Saving..." : "Save Rewards"}
      </button>
    </div>
  );
}
