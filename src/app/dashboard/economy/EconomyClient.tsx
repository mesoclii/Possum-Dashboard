"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { resolveGuildContext, fetchRuntimeEngine, saveRuntimeEngine, fetchDashboardConfig, saveDashboardConfig, readJsonOrThrow } from "@/lib/liveRuntime";

type EnginePayload = {
  config?: Record<string, any>;
  summary?: Array<{ label: string; value: string }>;
  details?: Record<string, any>;
};

type EngineKey = "store" | "economyRewards" | "progression" | "inviteTracker" | "radio" | "giveaways" | "eventPoints";

const card: CSSProperties = {
  border: "1px solid rgba(255,0,0,.28)",
  borderRadius: 12,
  background: "rgba(38,0,0,.24)",
  marginBottom: 14,
  padding: 14,
};

const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid rgba(255,0,0,.35)",
  color: "#ffd1d1",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
};

const LINKS: Array<{ engine: EngineKey; href: string; title: string; description: string }> = [
  { engine: "eventPoints", href: "/dashboard/economy/events", title: "Event Points", description: "Separate event-only currency, house standings, and custom event boards." },
  { engine: "store", href: "/dashboard/economy/store", title: "Store", description: "Catalog, stock, pricing, and role/item grant behavior." },
  { engine: "economyRewards", href: "/dashboard/economy/rewards", title: "Daily + Work", description: "/daily and /work payouts, cooldowns, and optional work XP." },
  { engine: "progression", href: "/dashboard/economy/progression", title: "Progression", description: "XP intake, level rewards, multipliers, and anti-abuse." },
  { engine: "inviteTracker", href: "/dashboard/economy/leaderboard", title: "Invite Tracker", description: "Invite leaderboard routing and recruiter thresholds." },
  { engine: "radio", href: "/dashboard/economy/radio-birthday", title: "Radio", description: "Birthday rewards, broadcast routing, and Radio profiles." },
  { engine: "giveaways", href: "/dashboard/giveaways", title: "Giveaways", description: "Giveaway lifecycle, host rules, and prize controls." },
];

export default function EconomyClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [economyEnabled, setEconomyEnabled] = useState(true);
  const [engines, setEngines] = useState<Record<EngineKey, EnginePayload>>({
    eventPoints: {},
    store: {},
    economyRewards: {},
    progression: {},
    inviteTracker: {},
    radio: {},
    giveaways: {},
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [coinGrant, setCoinGrant] = useState({ targetUserId: "", amount: "", reason: "staff reward" });
  const [grantingCoins, setGrantingCoins] = useState(false);

  useEffect(() => {
    const resolved = resolveGuildContext();
    setGuildId(resolved.guildId);
    setGuildName(resolved.guildName);
  }, []);

  async function loadAll(targetGuildId: string) {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const failedEngines: string[] = [];
      const [dashboard, ...runtimeEntries] = await Promise.all([
        fetchDashboardConfig(targetGuildId),
        ...LINKS.map(async (entry) => {
          try {
            const json = await fetchRuntimeEngine(targetGuildId, entry.engine);
            return [entry.engine, {
              config: json?.config || {},
              summary: Array.isArray(json?.summary) ? json.summary : [],
              details: json?.details && typeof json.details === "object" ? json.details : {},
            }] as const;
          } catch {
            failedEngines.push(entry.title);
            return [entry.engine, {}] as const;
          }
        }),
      ]);
      setEconomyEnabled(Boolean(dashboard?.features?.economyEnabled));
      setEngines(Object.fromEntries(runtimeEntries) as Record<EngineKey, EnginePayload>);
      if (failedEngines.length) setMessage(`Could not load: ${failedEngines.join(", ")}. Controls for those are read-only until a reload succeeds.`);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load economy hub.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll(guildId);
  }, [guildId]);

  async function saveFeature(next: boolean) {
    if (!guildId) return;
    try {
      setMessage("");
      await saveDashboardConfig(guildId, { features: { economyEnabled: next } });
      setEconomyEnabled(next);
      setMessage(`Economy feature gate ${next ? "enabled" : "disabled"}.`);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    }
  }

  async function saveEngine(engine: EngineKey, patch: Record<string, unknown>, okLabel: string) {
    if (!guildId) return;
    try {
      setMessage("");
      const json = await saveRuntimeEngine(guildId, engine, patch);
      setEngines((prev) => ({
        ...prev,
        [engine]: {
          config: json?.config || {},
          summary: Array.isArray(json?.summary) ? json.summary : [],
          details: prev[engine]?.details || {},
        },
      }));
      setMessage(okLabel);
    } catch (err: any) {
      setMessage(err?.message || "Save failed.");
    }
  }

  function readSnowflake(value: string) {
    const match = String(value || "").match(/\d{16,20}/);
    return match ? match[0] : "";
  }

  async function grantCoins() {
    if (!guildId) return;
    const targetUserId = readSnowflake(coinGrant.targetUserId);
    const amount = Math.floor(Number(coinGrant.amount || 0));
    if (!targetUserId) {
      setMessage("Enter a valid member ID or paste a Discord mention.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      setMessage("Coin grant amount must be a whole number between 1 and 1,000,000,000.");
      return;
    }

    try {
      setGrantingCoins(true);
      setMessage("");
      const res = await fetch("/api/bot/grant-coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          targetUserId,
          amount,
          reason: String(coinGrant.reason || "").trim() || "staff reward",
        }),
      });
      const json = await readJsonOrThrow(res);
      setCoinGrant((prev) => ({ ...prev, amount: "" }));
      setMessage(`Granted ${amount} coins to ${targetUserId}. New shared balance: ${json?.balance ?? "updated"}.`);
    } catch (err: any) {
      setMessage(err?.message || "Coin grant failed.");
    } finally {
      setGrantingCoins(false);
    }
  }

  if (!guildId && !loading) {
    return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  const eventCurrencySummary = Array.isArray(engines.eventPoints.summary) ? engines.eventPoints.summary : [];
  const eventCurrencyLabel = eventCurrencySummary.find((row) => row.label === "Currency")?.value || "Event currency not configured";
  const walletHolderCount = eventCurrencySummary.find((row) => row.label === "Wallet Holders")?.value || "0";
  const eventBalanceRows = Array.isArray(engines.eventPoints.details?.memberBalances) ? engines.eventPoints.details.memberBalances.slice(0, 6) : [];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", color: "#f8b4b4" }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ff4a4a" }}>Economy Hub</h1>
            <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
            <div style={{ color: "#ffb5b5", fontSize: 12, marginTop: 8 }}>
              This hub now reads live engines directly. The old economy command/currency shadow config has been removed because it was not mapped to bot runtime.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ color: "#fff", fontWeight: 800 }}>
              <input type="checkbox" checked={economyEnabled} onChange={(event) => void saveFeature(event.target.checked)} /> Economy feature gate
            </label>
            <Link href={`/dashboard/slash-commands?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Native Commands</Link>
          </div>
        </div>
        {message ? <div style={{ marginTop: 10, color: "#ffb3f0" }}>{message}</div> : null}
      </div>

      {loading ? <div style={card}>Loading live economy engines...</div> : null}

      {!loading ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
            {LINKS.map((entry) => (
              <div key={entry.engine} style={card}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#ffadad" }}>{entry.title}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#fff" }}>
                  {(engines[entry.engine].summary || [])[0]?.value
                    || (entry.engine === "economyRewards" && engines.economyRewards.config
                      ? (engines.economyRewards.config.enabled === false ? "Disabled" : "Enabled")
                      : "Unknown")}
                </div>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{entry.description}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Event Currency Visibility</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
              Your special event currency is tied into store pricing already. This section keeps it visible from the main economy hub instead of burying it only on the Event Points page.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Currency</div>
                <div style={{ color: "#fff", fontWeight: 900 }}>{eventCurrencyLabel}</div>
              </div>
              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ color: "#ffb0b0", fontSize: 12, marginBottom: 6 }}>Wallet Holders</div>
                <div style={{ color: "#fff", fontWeight: 900 }}>{walletHolderCount}</div>
              </div>
            </div>
            <div style={{ marginTop: 12, color: "#ffb3b3", fontSize: 12 }}>
              Top balances:
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {eventBalanceRows.length ? eventBalanceRows.map((row: any) => (
                <div key={String(row.id || row.title)} style={{ borderTop: "1px solid #330000", paddingTop: 8 }}>
                  <div style={{ color: "#fff", fontWeight: 800 }}>{row.name || row.title || "Member"}</div>
                  <div style={{ color: "#ffb3b3", fontSize: 12 }}>{row.value || "-"}</div>
                </div>
              )) : <div style={{ color: "#ffb3b3", fontSize: 12 }}>No special event currency balances recorded yet.</div>}
            </div>
            <div style={{ marginTop: 10 }}>
              <Link href={`/dashboard/economy/events?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Event Points</Link>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Staff Coin Grant</h3>
            <div style={{ color: "#ffb3b3", fontSize: 12, marginBottom: 10 }}>
              Grant coins from this guild control panel. Coins are shared on the bot account, and the grant is logged against this guild.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <div style={{ marginBottom: 6, color: "#ffb0b0", fontSize: 12 }}>Member ID or Mention</div>
                <input
                  style={input}
                  value={coinGrant.targetUserId}
                  onChange={(event) => setCoinGrant((prev) => ({ ...prev, targetUserId: event.target.value }))}
                  placeholder="Paste a Discord ID or @mention"
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, color: "#ffb0b0", fontSize: 12 }}>Coins</div>
                <input
                  type="number"
                  min={1}
                  step={1}
                  style={input}
                  value={coinGrant.amount}
                  onChange={(event) => setCoinGrant((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="5000"
                />
              </div>
              <div>
                <div style={{ marginBottom: 6, color: "#ffb0b0", fontSize: 12 }}>Reason</div>
                <input
                  style={input}
                  value={coinGrant.reason}
                  onChange={(event) => setCoinGrant((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="staff reward"
                />
              </div>
              <button
                onClick={() => void grantCoins()}
                disabled={grantingCoins}
                style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900, paddingInline: 18 }}
              >
                {grantingCoins ? "Granting..." : "Give Coins"}
              </button>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live Engine Controls</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Store</div>
                <label><input type="checkbox" checked={Boolean(engines.store.config?.active)} onChange={(event) => void saveEngine("store", { active: event.target.checked }, `Store ${event.target.checked ? "enabled" : "disabled"}.`)} /> Active</label>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{(engines.store.summary || []).map((row) => `${row.label}: ${row.value}`).join(" | ")}</div>
                <div style={{ marginTop: 10 }}><Link href={`/dashboard/economy/store?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Store</Link></div>
              </div>

              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Daily + Work</div>
                <label><input type="checkbox" checked={engines.economyRewards.config?.enabled !== false} onChange={(event) => void saveEngine("economyRewards", { enabled: event.target.checked }, `Daily + Work rewards ${event.target.checked ? "enabled" : "disabled"}.`)} /> Rewards enabled</label>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>
                  Daily: {Number(engines.economyRewards.config?.daily?.coins ?? 250)} coins / {Number(engines.economyRewards.config?.daily?.cooldownHours ?? 24)}h | Work: {Number(engines.economyRewards.config?.work?.coinsMin ?? 25)}-{Number(engines.economyRewards.config?.work?.coinsMax ?? 75)} coins / {Number(engines.economyRewards.config?.work?.cooldownMinutes ?? 30)}m
                </div>
                <div style={{ marginTop: 10 }}><Link href={`/dashboard/economy/rewards?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Daily + Work</Link></div>
              </div>

              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Progression</div>
                <label><input type="checkbox" checked={Boolean(engines.progression.config?.active)} onChange={(event) => void saveEngine("progression", { active: event.target.checked }, `Progression ${event.target.checked ? "enabled" : "disabled"}.`)} /> Active</label>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{(engines.progression.summary || []).map((row) => `${row.label}: ${row.value}`).join(" | ")}</div>
                <div style={{ marginTop: 10 }}><Link href={`/dashboard/economy/progression?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Progression</Link></div>
              </div>

              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Invite Tracker</div>
                <label><input type="checkbox" checked={Boolean(engines.inviteTracker.config?.enabled)} onChange={(event) => void saveEngine("inviteTracker", { enabled: event.target.checked }, `Invite Tracker ${event.target.checked ? "enabled" : "disabled"}.`)} /> Enabled</label>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{(engines.inviteTracker.summary || []).map((row) => `${row.label}: ${row.value}`).join(" | ")}</div>
                <div style={{ marginTop: 10 }}><Link href={`/dashboard/economy/leaderboard?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Invite Leaderboard</Link></div>
              </div>

              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Radio</div>
                <label><input type="checkbox" checked={Boolean(engines.radio.config?.birthday?.enabled)} onChange={(event) => void saveEngine("radio", { birthday: { enabled: event.target.checked } }, `Radio birthday rewards ${event.target.checked ? "enabled" : "disabled"}.`)} /> Birthday rewards enabled</label>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{(engines.radio.summary || []).map((row) => `${row.label}: ${row.value}`).join(" | ")}</div>
                <div style={{ marginTop: 10 }}><Link href={`/dashboard/economy/radio-birthday?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Radio</Link></div>
              </div>

              <div style={{ border: "1px solid #4f0000", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Giveaways</div>
                <label><input type="checkbox" checked={Boolean(engines.giveaways.config?.active)} onChange={(event) => void saveEngine("giveaways", { active: event.target.checked }, `Giveaways ${event.target.checked ? "enabled" : "disabled"}.`)} /> Active</label>
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 8 }}>{(engines.giveaways.summary || []).map((row) => `${row.label}: ${row.value}`).join(" | ")}</div>
                <div style={{ marginTop: 10 }}><Link href={`/dashboard/giveaways?guildId=${encodeURIComponent(guildId)}`} style={{ ...input, width: "auto", textDecoration: "none", fontWeight: 800 }}>Open Giveaways</Link></div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
