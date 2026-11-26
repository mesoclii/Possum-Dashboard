"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Snapshot = { name: string; kind: string; rarity: string; power: number; ability: string; story: string };
type Card = { id: string; cardKey: string; finish: string; cardSnapshot: Snapshot };
type Edition = Card & { quantity: number };
type Stack = { cardKey: string; editions: Edition[] };
type Choice = { lead: Card; support: Card | null };
type Round = { number: number; a: Choice; b: Choice; aPower: number; bPower: number; winner: string | null };
type Battle = {
  id: string; initiatorId: string; recipientId: string; status: string; updatedAt: string;
  deck: Card[]; used: string[]; yourWager: Card[]; theirWager: Card[]; round: number;
  turn: string | null; rounds: Round[]; winner: string | null; endReason: string | null; yourChoiceLocked: boolean;
};
type Response = { success?: boolean; error?: string; userId?: string; battles?: Battle[]; battle?: Battle };
type Selection = { cardKey: string; finish: string; quantity: number };
type Action = (action: string, body: object, success: string) => Promise<boolean>;

const describe = (cards: Card[]) => cards.length ? cards.map((card) => `${card.cardSnapshot.name} (${card.finish})`).join(", ") : "No cards";

function BattlePortrait({ card, artwork }: { card: Card; artwork?: string }) {
  return <div className="tcg-battle-portrait">
    {artwork ? <img src={`data:image/webp;base64,${artwork}`} alt={`Preview artwork for ${card.cardSnapshot.name}`} /> : <span aria-label="Artwork unavailable">{card.cardSnapshot.name.slice(0, 1)}</span>}
    <strong>{card.cardSnapshot.name}</strong><small>{card.finish} · {card.cardSnapshot.power} power</small>
  </div>;
}

function BattleCard({ battle, userId, act, artwork }: { battle: Battle; userId: string; act: Action; artwork: Record<string, string> }) {
  const [lead, setLead] = useState("");
  const [support, setSupport] = useState("");
  const initiated = battle.initiatorId === userId;
  const other = initiated ? battle.recipientId : battle.initiatorId;
  const available = battle.deck.filter((card) => !battle.used.includes(card.id));
  const leads = available.filter((card) => card.cardSnapshot.kind !== "gear");
  const supports = available.filter((card) => card.cardSnapshot.kind === "gear");
  const selectedLead = leads.find((card) => card.id === lead);
  const score = battle.rounds.filter((round) => round.winner === userId).length;
  const opponentScore = battle.rounds.filter((round) => round.winner === other).length;

  async function play() {
    if (!leads.some((card) => card.id === lead) || (support && !supports.some((card) => card.id === support))) return;
    const fingerprint = JSON.stringify({ battleId: battle.id, leadId: lead, supportId: support || null });
    const saved = sessionStorage.getItem("tcg-pending-battle-move");
    let requestKey = crypto.randomUUID();
    if (saved) {
      try {
        const previous: unknown = JSON.parse(saved);
        if (previous && typeof previous === "object" && "fingerprint" in previous && previous.fingerprint === fingerprint &&
            "requestKey" in previous && typeof previous.requestKey === "string") requestKey = previous.requestKey;
      } catch {
        console.warn("[TCG] Invalid saved battle move; creating a new request.");
        sessionStorage.removeItem("tcg-pending-battle-move");
      }
    }
    sessionStorage.setItem("tcg-pending-battle-move", JSON.stringify({ fingerprint, requestKey }));
    if (await act("battlePlay", { battleId: battle.id, leadId: lead, supportId: support || null, requestKey }, "Move submitted.")) {
      sessionStorage.removeItem("tcg-pending-battle-move");
      setLead("");
      setSupport("");
    }
  }

  return <article className="tcg-battle-card">
    <div className="tcg-trade-heading"><strong>Against {other}</strong><span>{battle.status.replaceAll("-", " ")}</span></div>
    <p><strong>Your wager:</strong> {describe(battle.yourWager)}<br /><strong>Their wager:</strong> {describe(battle.theirWager)}</p>
    {(battle.status === "active" || battle.status === "completed") && <>
      <div className="tcg-battle-score"><span>YOU <strong>{score}</strong></span><span>ROUND {Math.min(battle.round, 5)} / 5</span><span><strong>{opponentScore}</strong> THEM</span></div>
      {battle.rounds.map((round) => {
        const yours = initiated ? round.a : round.b;
        const theirs = initiated ? round.b : round.a;
        return <div className="tcg-battle-round" key={round.number}>
          <p>Round {round.number} · {round.winner === null ? "draw" : round.winner === userId ? "you won" : "they won"}</p>
          <div className="tcg-battle-contest"><div><BattlePortrait card={yours.lead} artwork={artwork[yours.lead.cardKey]} /><small>{initiated ? round.aPower : round.bPower} total{yours.support ? ` · support: ${yours.support.cardSnapshot.name}` : ""}</small></div>
            <span>VS</span><div><BattlePortrait card={theirs.lead} artwork={artwork[theirs.lead.cardKey]} /><small>{initiated ? round.bPower : round.aPower} total{theirs.support ? ` · support: ${theirs.support.cardSnapshot.name}` : ""}</small></div></div>
        </div>;
      })}
      {battle.status === "completed" && <p><strong>{battle.winner === null ? "Battle ended in a draw. Wagers returned." : battle.winner === userId ? "Victory! You receive their wager." : "Defeat. Your wager goes to the winner."}</strong> {battle.endReason === "forfeit" ? "The battle ended by forfeit." : battle.endReason === "timeout" ? "The battle ended due to inactivity or revoked access." : ""}</p>}
    </>}
    {battle.status === "awaiting-initiator" && initiated && <button type="button" className="tcg-secondary"
      onClick={() => { if (window.confirm(`Start this battle? Your wager: ${describe(battle.yourWager)}. Their wager: ${describe(battle.theirWager)}. The winner receives the loser's wager; a draw returns all wagers.`)) void act("battleConfirm", { battleId: battle.id }, "Battle started."); }}>Confirm and start</button>}
    {battle.status === "active" && (battle.turn === userId ? <div className="tcg-battle-move">
      <strong>Your turn · choose a lead and optional support</strong>
      <label>Lead card<select value={lead} onChange={(event) => setLead(event.target.value)}><option value="">Choose a lead</option>{leads.map((card) => <option key={card.id} value={card.id}>{card.cardSnapshot.name} · {card.cardSnapshot.power} power</option>)}</select></label>
      <label>Support card<select value={support} onChange={(event) => setSupport(event.target.value)}><option value="">No support</option>{supports.map((card) => <option key={card.id} value={card.id}>{card.cardSnapshot.name} · +{Math.floor(card.cardSnapshot.power / 3)} power</option>)}</select></label>
      {selectedLead && <BattlePortrait card={selectedLead} artwork={artwork[selectedLead.cardKey]} />}
      <button type="button" className="tcg-secondary" disabled={!lead} onClick={() => void play()}>Lock in move</button>
    </div> : <p>{battle.yourChoiceLocked ? "Your move is locked in." : "Waiting for the other player."} Refresh to see their move.</p>)}
    {(battle.status === "awaiting-recipient" || battle.status === "awaiting-initiator") && <button type="button" className="tcg-trade-link"
      onClick={() => { if (window.confirm("Cancel this challenge? All reserved cards will be released.")) void act("battleCancel", { battleId: battle.id }, "Challenge cancelled."); }}>Cancel challenge</button>}
    {battle.status === "active" && <>
      <button type="button" className="tcg-trade-link" onClick={() => { if (window.confirm("Forfeit? Your wager will transfer to the other player.")) void act("battleForfeit", { battleId: battle.id }, "Battle forfeited."); }}>Forfeit</button>
      <button type="button" className="tcg-trade-link" onClick={() => { if (window.confirm("End as a draw? This is available after 48 hours waiting for the other player, or if their tester access is revoked.")) void act("battleTimeout", { battleId: battle.id }, "Battle ended in a draw."); }}>End inactive battle</button>
    </>}
  </article>;
}

export default function BattlePanel({ stacks, refreshCollection, artwork, loadArtwork }: {
  stacks: Stack[]; refreshCollection: () => Promise<void>; artwork: Record<string, string>; loadArtwork: (cards: Card[]) => Promise<void>;
}) {
  const [userId, setUserId] = useState("");
  const [battles, setBattles] = useState<Battle[]>([]);
  const [recipient, setRecipient] = useState("");
  const [respondTo, setRespondTo] = useState<string | null>(null);
  const [deck, setDeck] = useState<Record<string, string>>({});
  const [wagers, setWagers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading battles...");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const loadBattles = useCallback(async () => {
    const response = await fetch("/api/tcg?action=battles", { cache: "no-store" });
    const data: Response = await response.json();
    if (!response.ok || !data.success || !data.userId || !Array.isArray(data.battles)) throw new Error(data.error || "Battles are unavailable.");
    setUserId(data.userId);
    setBattles(data.battles);
    void loadArtwork(data.battles.flatMap((battle) => [
      ...battle.deck, ...battle.yourWager, ...battle.theirWager,
      ...battle.rounds.flatMap((round) => [round.a.lead, round.b.lead, ...(round.a.support ? [round.a.support] : []), ...(round.b.support ? [round.b.support] : [])]),
    ]));
    setMessage("");
  }, [loadArtwork]);

  useEffect(() => { void loadBattles().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Battles are unavailable.")); }, [loadBattles]);

  async function act(action: string, body: object, success: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    let committed = false;
    try {
      const response = await fetch(`/api/tcg?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data: Response = await response.json();
      if (!response.ok || !data.success || !data.battle) throw new Error(data.error || "Battle request failed.");
      committed = true;
      await loadBattles();
      if (data.battle.status === "completed") await refreshCollection();
      setMessage(success);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Battle request failed.";
      setMessage(committed ? `${success} Refresh failed: ${detail}` : detail);
      return committed;
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function sendChallenge() {
    const deckCards: Selection[] = [], stakeCards: Selection[] = [];
    let leadCount = 0;
    for (const stack of stacks) for (const edition of stack.editions) {
      const key = `${edition.cardKey}:${edition.finish}`;
      const count = Number(deck[key] || "0"), stake = Number(wagers[key] || "0");
      if (![count, stake].every((value) => Number.isInteger(value) && value >= 0 && value <= edition.quantity)) {
        setMessage("Enter valid quantities for your owned cards."); return;
      }
      if (count) {
        deckCards.push({ cardKey: edition.cardKey, finish: edition.finish, quantity: count });
        if (edition.cardSnapshot.kind !== "gear") leadCount += count;
      }
      if (stake) stakeCards.push({ cardKey: edition.cardKey, finish: edition.finish, quantity: stake });
    }
    if (deckCards.reduce((sum, item) => sum + item.quantity, 0) !== 10 || leadCount < 5) { setMessage("Choose exactly 10 cards, including at least five non-support cards."); return; }
    if (stakeCards.reduce((sum, item) => sum + item.quantity, 0) > 2) { setMessage("Choose no more than two wager cards."); return; }
    if (!respondTo && !/^\d{16,20}$/.test(recipient.trim())) { setMessage("Enter the other player's Discord user ID."); return; }
    const challenge = battles.find((battle) => battle.id === respondTo);
    if (respondTo && (!challenge || challenge.status !== "awaiting-recipient")) { setMessage("This challenge is no longer available. Refresh battles."); return; }
    const stakeText = stakeCards.map((item) => `${item.cardKey} (${item.finish}) ×${item.quantity}`).join(", ") || "none";
    if (!window.confirm(`Your wager: ${stakeText}. ${challenge ? `Their wager: ${describe(challenge.theirWager)}.` : `Challenge ${recipient.trim()}.`} Your 10-card deck and wager are reserved until the battle ends or is cancelled. The winner receives the loser's wager; a draw returns all wagers.`)) return;
    let body: object;
    if (respondTo) body = { battleId: respondTo, deck: deckCards, wagers: stakeCards };
    else {
      const fingerprint = JSON.stringify({ recipientId: recipient.trim(), deck: deckCards, wagers: stakeCards });
      let requestKey = crypto.randomUUID();
      const saved = sessionStorage.getItem("tcg-pending-battle-challenge");
      if (saved) {
        try {
          const previous: unknown = JSON.parse(saved);
          if (previous && typeof previous === "object" && "fingerprint" in previous && previous.fingerprint === fingerprint &&
              "requestKey" in previous && typeof previous.requestKey === "string") requestKey = previous.requestKey;
        } catch { console.warn("[TCG] Invalid saved battle challenge; creating a new request."); sessionStorage.removeItem("tcg-pending-battle-challenge"); }
      }
      sessionStorage.setItem("tcg-pending-battle-challenge", JSON.stringify({ fingerprint, requestKey }));
      body = { recipientId: recipient.trim(), deck: deckCards, wagers: stakeCards, requestKey };
    }
    const sent = await act(respondTo ? "battleRespond" : "battleChallenge", body, respondTo ? "Response sent. The challenger must confirm." : "Challenge sent.");
    if (sent) {
      if (!respondTo) sessionStorage.removeItem("tcg-pending-battle-challenge");
      setDeck({}); setWagers({}); setRespondTo(null);
    }
  }

  return <section className="tcg-section tcg-trading">
    <div className="tcg-section-heading"><div><p className="tcg-eyebrow">PRIVATE TEST · FIVE-ROUND SHOWDOWN</p><h2>Battle arena</h2></div><span>Latest 50 battles</span></div>
    <p>Bring 10 cards, including at least five non-support cards. Each round, secretly lock in one unused lead and optional support; support adds one-third of its power, rounded down. Most round wins takes the battle; ties return wagers. Printed abilities are story text in this preview.</p>
    <p>Deck and wager cards are reserved until the battle ends or is cancelled. Either player may forfeit; after 48 hours of inactivity, the waiting player may end the battle as a draw.</p>
    <p className="tcg-trade-status" role="status">{message}</p>
    <div className="tcg-trade-layout">
      <div className="tcg-trade-compose">
        <h3>{respondTo ? "Accept a challenge" : "Build your deck"}</h3>
        {respondTo ? <button type="button" className="tcg-trade-link" onClick={() => { setRespondTo(null); setDeck({}); setWagers({}); }}>Cancel response</button> :
          <label>Opponent Discord user ID<input value={recipient} onChange={(event) => setRecipient(event.target.value)} inputMode="numeric" placeholder="Discord user ID" /></label>}
        <p>Choose your 10-card deck and optionally wager up to two owned cards. Wagers may also be part of your deck. Load more collection cards to see more choices.</p>
        <div className="tcg-trade-choices">
          {stacks.flatMap((stack) => stack.editions.map((edition) => {
            const key = `${edition.cardKey}:${edition.finish}`;
            return <div className="tcg-battle-choice" key={key}><span>{edition.cardSnapshot.name}<small>{edition.finish} · {edition.quantity} owned</small></span>
              <label>Deck<input aria-label={`${edition.cardSnapshot.name} ${edition.finish} deck quantity`} type="number" min="0" max={edition.quantity} step="1" value={deck[key] || ""} placeholder="0" onChange={(event) => setDeck((current) => ({ ...current, [key]: event.target.value }))} /></label>
              <label>Wager<input aria-label={`${edition.cardSnapshot.name} ${edition.finish} wager quantity`} type="number" min="0" max={Math.min(edition.quantity, 2)} step="1" value={wagers[key] || ""} placeholder="0" onChange={(event) => setWagers((current) => ({ ...current, [key]: event.target.value }))} /></label></div>;
          }))}
          {!stacks.length && <span>Open packs to build your deck.</span>}
        </div>
        <button type="button" className="tcg-secondary" disabled={busy || !userId} onClick={() => void sendChallenge()}>{respondTo ? "Confirm response" : "Send challenge"}</button>
      </div>
      <div className="tcg-trade-list">
        <h3>Your battles</h3>
        <button type="button" className="tcg-trade-link" disabled={busy} onClick={() => void loadBattles().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Battles are unavailable."))}>Refresh battles</button>
        {!battles.length && <p>No battles yet.</p>}
        {battles.map((battle) => <div key={battle.id}>
          <BattleCard battle={battle} userId={userId} act={act} artwork={artwork} />
          {battle.status === "awaiting-recipient" && battle.recipientId === userId && <button type="button" className="tcg-secondary" disabled={busy} onClick={() => { setRespondTo(battle.id); setDeck({}); setWagers({}); }}>Choose response deck</button>}
        </div>)}
      </div>
    </div>
  </section>;
}
