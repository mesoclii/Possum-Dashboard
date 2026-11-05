"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type Summary = {
  billingActive: boolean;
  balance: { available: number; included: number; promo: number; purchased: number; held: number };
  usageByPersona: { persona: string; requests: number; credits: number }[];
  limits: { perUserDailyCredits: number; perPersonaDailyCredits: number };
  autoPurchase: { enabled: boolean; triggerCredits: number; packCredits: number; monthlyCapCents: number; spentThisMonthCents: number };
  subscription: { status: string; creditsPerPeriod: number } | null;
  recentPurchases: { kind: string; credits: number; amountCents: number; status: string; createdAt: string }[];
  catalog: { packs: { key: string; credits: number; available: boolean }[]; subscription: { credits: number; available: boolean } };
};

const wrap: CSSProperties = { color: "#ffd0d0", maxWidth: 1000 };
const card: CSSProperties = { border: "1px solid rgba(255,0,0,.36)", borderRadius: 12, padding: 14, background: "rgba(100,0,0,.10)", marginBottom: 14 };
const button: CSSProperties = {
  border: "1px solid #7a0000",
  borderRadius: 10,
  background: "#130707",
  color: "#ffd7d7",
  padding: "10px 12px",
  fontWeight: 800,
  cursor: "pointer",
};
const field: CSSProperties = { background: "#0a0a0a", border: "1px solid rgba(255,0,0,.45)", color: "#ffd5d5", borderRadius: 8, padding: "8px 10px", width: 140 };

const fmt = (n: number) => Number(n).toLocaleString("en-US");

async function api(path: string, body?: Record<string, unknown>) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error || "Request failed.");
  return json;
}

export default function BillingClient() {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [data, setData] = useState<Summary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [perUser, setPerUser] = useState("0");
  const [perPersona, setPerPersona] = useState("0");
  const [autoOn, setAutoOn] = useState(false);
  const [trigger, setTrigger] = useState("500");
  const [pack, setPack] = useState("2000");
  const [capUsd, setCapUsd] = useState("15");

  const load = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const json = (await api(`/api/ai-billing/summary?guildId=${encodeURIComponent(id)}`)) as Summary;
      setData(json);
      setPerUser(String(json.limits.perUserDailyCredits));
      setPerPersona(String(json.limits.perPersonaDailyCredits));
      setAutoOn(json.autoPurchase.enabled);
      setTrigger(String(json.autoPurchase.triggerCredits));
      setPack(String(json.autoPurchase.packCredits));
      setCapUsd(String(json.autoPurchase.monthlyCapCents / 100));
      setMessage("");
    } catch (error: any) {
      setMessage(error?.message || "Could not load AI billing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = (params.get("guildId") || localStorage.getItem("activeGuildId") || "").trim();
    setGuildId(id);
    setGuildName((localStorage.getItem("activeGuildName") || "").trim());
    if (id) void load(id);
    else setLoading(false);
  }, [load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      setMessage(ok);
      await load(guildId);
    } catch (error: any) {
      setMessage(error?.message || "Something went wrong.");
    }
  };

  const buy = (body: Record<string, unknown>) =>
    run(async () => {
      const json = await api("/api/ai-billing/checkout", { guildId, ...body });
      if (json?.url) window.location.href = json.url;
    }, "Opening secure checkout...");

  if (!guildId) return <div style={wrap}>Pick a server first.</div>;

  return (
    <div style={wrap}>
      <h1 style={{ marginTop: 0 }}>AI Billing{guildName ? `: ${guildName}` : ""}</h1>
      {message ? <div style={{ ...card, color: "#fff" }}>{message}</div> : null}
      {loading && !data ? <div>Loading...</div> : null}
      {data ? (
        <>
          {!data.billingActive ? (
            <div style={card}>AI billing isn't switched on yet, so the existing free AI limits still apply. Credits can't be bought until it is.</div>
          ) : null}

          <div style={card}>
            <h2 style={{ marginTop: 0 }}>Credits: {fmt(data.balance.available)}</h2>
            <div>
              Monthly allowance {fmt(data.balance.included)} | Bonus {fmt(data.balance.promo)} | Purchased {fmt(data.balance.purchased)} | In use now {fmt(data.balance.held)}
            </div>
            {data.subscription ? <div>AI subscription ({data.subscription.status}): {fmt(data.subscription.creditsPerPeriod)} credits per renewal</div> : null}
          </div>

          {data.billingActive ? (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Buy credits</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {data.catalog.packs.map((p) => (
                  <button key={p.key} style={{ ...button, opacity: p.available ? 1 : 0.4 }} disabled={!p.available} onClick={() => buy({ pack: p.key })}>
                    {fmt(p.credits)} credits ({p.key})
                  </button>
                ))}
                <button style={{ ...button, opacity: data.catalog.subscription.available ? 1 : 0.4 }} disabled={!data.catalog.subscription.available} onClick={() => buy({ subscription: true })}>
                  Subscribe: {fmt(data.catalog.subscription.credits)} credits per month
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>To allow auto-purchase, buy a pack with the card saved:</div>
              <button style={{ ...button, marginTop: 6 }} onClick={() => buy({ pack: "small", saveCard: true })}>
                Buy small pack and save card
              </button>
            </div>
          ) : null}

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Usage by persona (30 days)</h3>
            {data.usageByPersona.length ? (
              data.usageByPersona.map((row) => (
                <div key={row.persona}>
                  {row.persona}: {fmt(row.credits)} credits ({fmt(row.requests)} replies)
                </div>
              ))
            ) : (
              <div>No usage yet.</div>
            )}
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Spending limits (credits per day, 0 = no limit)</h3>
            <label>
              Per person <input style={field} value={perUser} onChange={(e) => setPerUser(e.target.value)} />
            </label>{" "}
            <label>
              Per persona <input style={field} value={perPersona} onChange={(e) => setPerPersona(e.target.value)} />
            </label>{" "}
            <button style={button} onClick={() => run(() => api("/api/ai-billing/settings", { guildId, perUserDailyCredits: Number(perUser) || 0, perPersonaDailyCredits: Number(perPersona) || 0 }), "Limits saved.")}>
              Save limits
            </button>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Auto-purchase</h3>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              Charges your saved card when credits run low. It will never spend more than the monthly cap. Spent this month: ${(data.autoPurchase.spentThisMonthCents / 100).toFixed(2)}
            </div>
            <label>
              <input type="checkbox" checked={autoOn} onChange={(e) => setAutoOn(e.target.checked)} /> Enabled
            </label>{" "}
            <label>
              Top up below <input style={field} value={trigger} onChange={(e) => setTrigger(e.target.value)} />
            </label>{" "}
            <label>
              Credits per top-up <input style={field} value={pack} onChange={(e) => setPack(e.target.value)} />
            </label>{" "}
            <label>
              Monthly cap (USD) <input style={field} value={capUsd} onChange={(e) => setCapUsd(e.target.value)} />
            </label>{" "}
            <button
              style={button}
              onClick={() =>
                run(
                  () =>
                    api("/api/ai-billing/autopurchase", {
                      guildId,
                      enabled: autoOn,
                      triggerCredits: Number(trigger) || 0,
                      packCredits: Number(pack) || 0,
                      monthlyCapCents: Math.round((Number(capUsd) || 0) * 100),
                    }),
                  "Auto-purchase saved."
                )
              }
            >
              Save
            </button>
          </div>

          {data.recentPurchases.length ? (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Recent purchases</h3>
              {data.recentPurchases.map((p, i) => (
                <div key={i}>
                  {new Date(p.createdAt).toLocaleDateString()}: {p.kind.toLowerCase()} {fmt(p.credits)} credits, ${(p.amountCents / 100).toFixed(2)} ({p.status.toLowerCase()})
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
