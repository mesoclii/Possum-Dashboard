"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./tcg.css";

type Snapshot = { name: string; rarity: string; kind: string; power: number; ability: string; story: string };
type Card = { id: string; cardKey: string; finish: string; cardSnapshot: Snapshot };
type Rules = { specialWeights: Record<string, number>; rarityWeights: Record<string, Record<string, number>> };
type Result = { success?: boolean; error?: string; status?: string; nextAvailableAt?: string; cards?: Card[]; nextCursor?: string | null; pack?: { cards: Card[] }; rules?: Rules; rulesetId?: string | null };

const rarities = ["common", "uncommon", "rare", "epic", "legendary", "mythical", "celestial"];
const specials = ["support", "rare", "holo", "shiny"];
const slots = ["standard", ...specials];

function CardView({ card }: { card: Card }) {
  const details = card.cardSnapshot;
  return <article className={`tcg-card tcg-finish-${card.finish}`}>
    <div className="tcg-card-top"><span>{details.kind}</span><span>{details.rarity}</span></div>
    <div className="tcg-card-crest" aria-hidden="true">{details.name.slice(0, 1)}</div>
    <p className="tcg-card-finish">{card.finish === "standard" ? "Standard edition" : `${card.finish} edition`}</p>
    <h3>{details.name}</h3>
    <div className="tcg-card-power">POWER <strong>{details.power}</strong></div>
    <p className="tcg-card-ability">{details.ability}</p>
    <p className="tcg-card-story">{details.story}</p>
    <p className="tcg-card-art">Preview design · artwork in development</p>
  </article>;
}

export default function TcgPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [opened, setOpened] = useState<Card[]>([]);
  const [message, setMessage] = useState("Checking your private test access...");
  const [signIn, setSignIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Rules | null>(null);
  const [rulesetId, setRulesetId] = useState<string | null>(null);
  const [rulesMessage, setRulesMessage] = useState("");
  const inFlight = useRef(false);

  const loadCollection = useCallback(async (next?: string) => {
    const query = next ? `?cursor=${encodeURIComponent(next)}` : "";
    const response = await fetch(`/api/tcg${query}`, { cache: "no-store" });
    const data: Result = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.cards)) {
      if (response.status === 401) setSignIn(true);
      throw new Error(data.error || "Your collection is unavailable.");
    }
    setCards((current) => next ? [...current, ...data.cards!] : data.cards!);
    setCursor(data.nextCursor || null);
    setReady(true);
    setMessage("Your collection is ready. Free packs reset 24 hours after your last claim.");
  }, []);

  useEffect(() => {
    void loadCollection().then(async () => {
      const response = await fetch("/api/tcg?action=rules", { cache: "no-store" });
      if (response.status === 403) return;
      const data: Result = await response.json();
      if (!response.ok || !data.success || !data.rules) throw new Error(data.error || "Developer controls are unavailable.");
      setRules(data.rules);
      setRulesetId(data.rulesetId || null);
      if (!data.rulesetId) setRulesMessage("Save the draft odds to initialize private test packs.");
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "TCG is unavailable."));
  }, [loadCollection]);

  async function ripPack() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setOpened([]);
    try {
      const key = sessionStorage.getItem("tcg-pending-request") || crypto.randomUUID();
      sessionStorage.setItem("tcg-pending-request", key);
      const response = await fetch("/api/tcg?action=open", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestKey: key }),
      });
      const data: Result = await response.json();
      if (!response.ok || !data.success || !data.pack || !Array.isArray(data.pack.cards)) {
        if (data.status === "cooldown" && data.nextAvailableAt) {
          sessionStorage.removeItem("tcg-pending-request");
          throw new Error(`Your next free pack is available ${new Date(data.nextAvailableAt).toLocaleString()}.`);
        }
        throw new Error(data.error || "Your pack could not be opened. Try again to recover the same request.");
      }
      sessionStorage.removeItem("tcg-pending-request");
      setOpened(data.pack.cards);
      await loadCollection();
      setMessage("Your pack is open and both cards are saved to your collection.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your pack could not be opened. Please retry.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function changeWeight(slot: string, key: string, value: string) {
    const next = Number(value) * 100;
    if (!Number.isInteger(next) || next < 0 || next > 10000) return;
    setRules((current) => {
      if (!current) return current;
      if (slot === "special") return { ...current, specialWeights: { ...current.specialWeights, [key]: next } };
      return { ...current, rarityWeights: { ...current.rarityWeights, [slot]: { ...current.rarityWeights[slot], [key]: next } } };
    });
  }

  async function saveRules() {
    if (!rules || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setRulesMessage("");
    try {
      const response = await fetch("/api/tcg?action=rules", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, expectedRulesetId: rulesetId }),
      });
      const data: Result = await response.json();
      if (!response.ok || !data.success || !data.rules || !data.rulesetId) throw new Error(data.error || "Could not save drop rates.");
      setRules(data.rules);
      setRulesetId(data.rulesetId);
      setRulesMessage("Drop rates saved as a new version.");
    } catch (error) {
      setRulesMessage(error instanceof Error ? error.message : "Could not save drop rates.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <main className="tcg-shell">
    <div className="tcg-orb tcg-orb-one" aria-hidden="true" /><div className="tcg-orb tcg-orb-two" aria-hidden="true" />
    <header className="tcg-header">
      <a href="/gaming" className="tcg-back">← Gaming Hub</a>
      <span className="tcg-badge">PRIVATE TEST · NOT FINAL</span>
    </header>
    <section className="tcg-hero">
      <p className="tcg-eyebrow">POSSUM TCG · THE CITY MEETS THE WILDS</p>
      <h1>Every pack<br /><em>starts a story.</em></h1>
      <p>Crews, creatures, vehicles and support cards share one world. Open your daily pack and begin your collection.</p>
      <div className="tcg-status" role="status" aria-live="polite">{message}</div>
      {signIn && <a className="tcg-button" href="/api/auth/discord/login?returnTo=%2Ftcg">Sign in with Discord</a>}
      {ready && <button className="tcg-button" disabled={busy} onClick={() => void ripPack()}>{busy ? "Working..." : "✦ Rip your free pack"}</button>}
      <p className="tcg-note">Two cards per pack · one free pack every 24 hours · test artwork and stories are not final. Wilds unlocks, rewards, trading and battles are not active yet.</p>
    </section>
    {opened.length > 0 && <section className="tcg-section"><div className="tcg-section-heading"><div><p className="tcg-eyebrow">YOUR LATEST PULL</p><h2>Fresh from the pack</h2></div><span>Saved to your collection</span></div><div className="tcg-grid tcg-reveal">{opened.map((card) => <CardView key={card.id} card={card} />)}</div></section>}
    {ready && <section className="tcg-section"><div className="tcg-section-heading"><div><p className="tcg-eyebrow">YOUR CARDS</p><h2>The collection</h2></div><span>{cards.length} loaded</span></div>
      {cards.length ? <div className="tcg-grid">{cards.map((card) => <CardView key={card.id} card={card} />)}</div> : <div className="tcg-empty">Your story starts with your first pack.</div>}
      {cursor && <button className="tcg-secondary" disabled={busy} onClick={() => void loadCollection(cursor).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load more cards."))}>Load more cards</button>}
    </section>}
    {rules && <section className="tcg-section tcg-admin"><details><summary>Developer controls <span>Drop-rate settings</span></summary>
      <p>All values are percentages. Each row must total 100%. Changes affect future packs only.</p>
      <div className="tcg-rules"><div className="tcg-rule-row"><strong>Special type</strong>{specials.map((key) => <label key={key}>{key}<input type="number" min="0" max="100" step="0.01" value={rules.specialWeights[key] / 100} onChange={(event) => changeWeight("special", key, event.target.value)} /></label>)}</div>
      {slots.map((slot) => <div className="tcg-rule-row" key={slot}><strong>{slot} rarity</strong>{rarities.map((rarity) => <label key={rarity}>{rarity}<input type="number" min="0" max="100" step="0.01" value={rules.rarityWeights[slot][rarity] / 100} onChange={(event) => changeWeight(slot, rarity, event.target.value)} /></label>)}</div>)}</div>
      <p role="status">{rulesMessage}</p><button className="tcg-secondary" disabled={busy} onClick={() => void saveRules()}>Save drop rates</button>
    </details></section>}
  </main>;
}
