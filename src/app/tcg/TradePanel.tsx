"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Edition = { cardKey: string; finish: string; quantity: number; cardSnapshot: { name: string } };
type Stack = { cardKey: string; editions: Edition[] };
type TradeItem = { cardId: string; offeredBy: string; card: { cardKey: string; finish: string; cardSnapshot: { name: string } } };
type Trade = { id: string; initiatorId: string; recipientId: string; status: string; items: TradeItem[] };
type TradeResponse = { success?: boolean; error?: string; userId?: string; trades?: Trade[] };
type Selection = { cardKey: string; finish: string; quantity: number };

function describeItems(trade: Trade, userId: string) {
  const grouped = new Map<string, { name: string; finish: string; count: number }>();
  for (const item of trade.items.filter((entry) => entry.offeredBy === userId)) {
    const key = `${item.card.cardKey}:${item.card.finish}`;
    const entry = grouped.get(key) || { name: item.card.cardSnapshot.name, finish: item.card.finish, count: 0 };
    entry.count++;
    grouped.set(key, entry);
  }
  return [...grouped.values()].map((item) => `${item.name} (${item.finish}) ×${item.count}`).join(", ") || "Not selected yet";
}

export default function TradePanel({ stacks, refreshCollection }: { stacks: Stack[]; refreshCollection: () => Promise<void> }) {
  const [userId, setUserId] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [respondTo, setRespondTo] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading trades...");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const loadTrades = useCallback(async () => {
    const response = await fetch("/api/tcg?action=trades", { cache: "no-store" });
    const data: TradeResponse = await response.json();
    if (!response.ok || !data.success || !data.userId || !Array.isArray(data.trades)) {
      throw new Error(data.error || "Trades are unavailable.");
    }
    setUserId(data.userId);
    setTrades(data.trades);
    setMessage("");
  }, []);

  useEffect(() => {
    void loadTrades().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Trades are unavailable."));
  }, [loadTrades]);

  async function submit(action: string, body: object, success: string, refresh = false) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    let committed = false;
    try {
      const response = await fetch(`/api/tcg?action=${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data: TradeResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Trade request failed.");
      committed = true;
      await loadTrades();
      if (refresh) await refreshCollection();
      setMessage(success);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Trade request failed.";
      setMessage(committed ? `${success} Refresh failed: ${detail}` : detail);
      return committed;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function sendOffer() {
    const cards: Selection[] = [];
    for (const stack of stacks) {
      for (const edition of stack.editions) {
        const quantity = Number(quantities[`${edition.cardKey}:${edition.finish}`] || "0");
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > edition.quantity) {
          setMessage("Enter a valid quantity for each edition."); return;
        }
        if (quantity) cards.push({ cardKey: edition.cardKey, finish: edition.finish, quantity });
      }
    }
    const total = cards.reduce((sum, card) => sum + card.quantity, 0);
    if (!total || total > 100) { setMessage("Choose between 1 and 100 card copies."); return; }
    if (!respondTo && !/^\d{16,20}$/.test(recipientId.trim())) { setMessage("Enter the other player's Discord user ID."); return; }
    const selectionSummary = cards.map((card) => {
      const edition = stacks.find((stack) => stack.cardKey === card.cardKey)?.editions.find((item) => item.finish === card.finish);
      return `${edition?.cardSnapshot.name || card.cardKey} (${card.finish}) ×${card.quantity}`;
    }).join(", ");
    const respondingTrade = trades.find((trade) => trade.id === respondTo);
    if (respondTo && (!respondingTrade || respondingTrade.status !== "awaiting-recipient")) {
      setMessage("This trade is no longer available for a response. Refresh your trades."); return;
    }
    if (!window.confirm(respondingTrade
      ? `You offer: ${selectionSummary}. They offer: ${describeItems(respondingTrade, respondingTrade.initiatorId)}. The other player must confirm the exchange.`
      : `Offer ${selectionSummary} to ${recipientId.trim()}? No cards transfer until both players agree.`)) return;
    const action = respondTo ? "tradeRespond" : "trades";
    let body: object;
    if (respondTo) {
      body = { tradeId: respondTo, cards };
    } else {
      const fingerprint = JSON.stringify({ recipientId: recipientId.trim(), cards });
      const pending = sessionStorage.getItem("tcg-pending-trade");
      let requestKey = crypto.randomUUID();
      if (pending) {
        try {
          const previous: unknown = JSON.parse(pending);
          if (previous && typeof previous === "object" && "fingerprint" in previous && previous.fingerprint === fingerprint &&
              "requestKey" in previous && typeof previous.requestKey === "string") requestKey = previous.requestKey;
        } catch {
          console.warn("[TCG] Invalid saved trade request; creating a new request.");
          sessionStorage.removeItem("tcg-pending-trade");
        }
      }
      sessionStorage.setItem("tcg-pending-trade", JSON.stringify({ fingerprint, requestKey }));
      body = { recipientId: recipientId.trim(), cards, requestKey };
    }
    const sent = await submit(action, body, respondTo ? "Your response was sent. The other player can confirm the trade." : "Your offer was sent. The other player can respond.");
    if (sent) {
      if (!respondTo) sessionStorage.removeItem("tcg-pending-trade");
      setRespondTo(null);
      setQuantities({});
    }
  }

  async function finishTrade(trade: Trade) {
    if (!window.confirm(`Confirm this trade? You give: ${describeItems(trade, userId)}. You receive: ${describeItems(trade, trade.recipientId)}. This transfers the cards.`)) return;
    await submit("tradeComplete", { tradeId: trade.id }, "Trade completed.", true);
  }

  return <section className="tcg-section tcg-trading">
    <div className="tcg-section-heading"><div><p className="tcg-eyebrow">PRIVATE TEST · PLAYER EXCHANGE</p><h2>Trade cards</h2></div><span>Latest 50 trades</span></div>
    <p>Offer cards to another approved tester using their Discord user ID. They choose their cards, then you confirm the exchange. Cards remain yours until confirmation.</p>
    <p className="tcg-trade-status" role="status">{message}</p>
    <div className="tcg-trade-layout">
      <div className="tcg-trade-compose">
        <h3>{respondTo ? "Respond to a trade" : "Create an offer"}</h3>
        {respondTo ? <button type="button" className="tcg-trade-link" onClick={() => { setRespondTo(null); setQuantities({}); }}>Cancel response</button> :
          <label>Recipient Discord user ID<input value={recipientId} onChange={(event) => setRecipientId(event.target.value)} inputMode="numeric" placeholder="Discord user ID" /></label>}
        <p>Choose copies from loaded cards. Use “Load more cards” in your collection to include additional cards.</p>
        <div className="tcg-trade-choices">
          {stacks.flatMap((stack) => stack.editions.map((edition) => {
            const key = `${edition.cardKey}:${edition.finish}`;
            return <label key={key}><span>{edition.cardSnapshot.name} <small>{edition.finish} · {edition.quantity} owned</small></span>
              <input aria-label={`${edition.cardSnapshot.name} ${edition.finish} quantity`} type="number" min="0" max={edition.quantity} step="1"
                value={quantities[key] || ""} placeholder="0" onChange={(event) => setQuantities((current) => ({ ...current, [key]: event.target.value }))} /></label>;
          }))}
          {!stacks.length && <span>Open a pack to add cards to your collection.</span>}
        </div>
        <button type="button" className="tcg-secondary" disabled={busy || !userId} onClick={() => void sendOffer()}>{respondTo ? "Confirm response" : "Send offer"}</button>
      </div>
      <div className="tcg-trade-list">
        <h3>Your trades</h3>
        <button type="button" className="tcg-trade-link" disabled={busy} onClick={() => void loadTrades().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Trades are unavailable."))}>Refresh trades</button>
        {!trades.length && <p>No trades yet.</p>}
        {trades.map((trade) => {
          const initiated = trade.initiatorId === userId;
          const other = initiated ? trade.recipientId : trade.initiatorId;
          return <article className="tcg-trade" key={trade.id}>
            <div className="tcg-trade-heading"><strong>With {other}</strong><span>{trade.status.replaceAll("-", " ")}</span></div>
            <p><strong>You offer:</strong> {describeItems(trade, userId)}</p>
            <p><strong>They offer:</strong> {describeItems(trade, other)}</p>
            {trade.status === "awaiting-recipient" && !initiated && <button type="button" className="tcg-secondary" disabled={busy} onClick={() => { setRespondTo(trade.id); setQuantities({}); }}>Choose response cards</button>}
            {trade.status === "awaiting-initiator" && initiated && <button type="button" className="tcg-secondary" disabled={busy} onClick={() => void finishTrade(trade)}>Confirm exchange</button>}
            {(trade.status === "awaiting-recipient" || trade.status === "awaiting-initiator") && <button type="button" className="tcg-trade-link" disabled={busy}
              onClick={() => { if (window.confirm("Cancel this trade? No cards will change hands.")) void submit("tradeCancel", { tradeId: trade.id }, "Trade cancelled."); }}>Cancel trade</button>}
          </article>;
        })}
      </div>
    </div>
  </section>;
}
