"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TradePanel from "./TradePanel";
import BattlePanel from "./BattlePanel";
import "./tcg.css";

type Snapshot = { name: string; rarity: string; kind: string; power: number; ability: string; story: string };
type Card = { id: string; cardKey: string; finish: string; cardSnapshot: Snapshot };
type CatalogCard = { id: string; name: string; kind: string; rarity: string; power: number; ability: string; story: string };
type Edition = Card & { quantity: number };
type CardStack = { cardKey: string; quantity: number; editions: Edition[] };
type Rules = { specialWeights: Record<string, number>; rarityWeights: Record<string, Record<string, number>> };
type Result = { success?: boolean; error?: string; status?: string; replayed?: boolean; nextAvailableAt?: string; stacks?: CardStack[]; cards?: CatalogCard[]; nextCursor?: string | null; unlimitedTestPacks?: boolean; pack?: { cards: Card[] }; rules?: Rules; rulesetId?: string | null };
type PackPhase = "idle" | "sealed" | "tearing" | "reveal";

const rarities = ["common", "uncommon", "rare", "epic", "legendary", "mythical", "celestial"];
const specials = ["support", "rare", "holo", "shiny"];
const slots = ["standard", ...specials];
const GALLERY_PAGE_SIZE = 24;

function isCatalogCard(value: unknown): value is CatalogCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<CatalogCard>;
  return typeof card.id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id) &&
    typeof card.name === "string" && typeof card.kind === "string" &&
    typeof card.rarity === "string" && Number.isInteger(card.power) &&
    typeof card.ability === "string" && typeof card.story === "string";
}

function CardView({ card, artwork }: { card: Card; artwork?: string }) {
  const details = card.cardSnapshot;
  return <article className={`tcg-card tcg-rarity-${details.rarity} tcg-finish-${card.finish}`}>
    <div className="tcg-card-top"><span>{details.kind}</span><span>{details.rarity}</span></div>
    <div className="tcg-card-crest">{artwork ? <img src={`data:image/webp;base64,${artwork}`} alt={`Draft artwork for ${details.name}`} /> : <span aria-label="Artwork unavailable">{details.name.slice(0, 1)}</span>}</div>
    <p className="tcg-card-finish">{card.finish === "standard" ? "Standard edition" : `${card.finish} edition`}</p>
    <h3>{details.name}</h3>
    <div className="tcg-card-power">POWER <strong>{details.power}</strong></div>
    <p className="tcg-card-ability">{details.ability}</p>
    <p className="tcg-card-story">{details.story}</p>
    <p className="tcg-card-art">{artwork ? "Private preview artwork · not final" : "Artwork unavailable · private preview"}</p>
  </article>;
}

function StackView({ stack, artwork }: { stack: CardStack; artwork?: string }) {
  const [selectedFinish, setSelectedFinish] = useState(stack.editions[0].finish);
  const selected = stack.editions.find((edition) => edition.finish === selectedFinish) || stack.editions[0];
  return <div className="tcg-stack">
    <div className="tcg-stack-count"><strong>{stack.quantity} {stack.quantity === 1 ? "copy" : "copies"}</strong><span>in your collection</span></div>
    <CardView card={selected} artwork={artwork} />
    <div className="tcg-editions" aria-label={`${selected.cardSnapshot.name} editions`}>
      {stack.editions.map((edition) => <button key={edition.finish} type="button" aria-pressed={selected.finish === edition.finish}
        onClick={() => setSelectedFinish(edition.finish)}>{edition.finish} <strong>×{edition.quantity}</strong></button>)}
    </div>
  </div>;
}

export default function TcgPage() {
  const [stacks, setStacks] = useState<CardStack[]>([]);
  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryKind, setGalleryKind] = useState("all");
  const [galleryRarity, setGalleryRarity] = useState("all");
  const [galleryPage, setGalleryPage] = useState(0);
  const [artwork, setArtwork] = useState<Record<string, string>>({});
  const [artworkMessage, setArtworkMessage] = useState("");
  const artworkRequested = useRef(new Set<string>());
  const [cursor, setCursor] = useState<string | null>(null);
  const [opened, setOpened] = useState<Card[]>([]);
  const [replayedPack, setReplayedPack] = useState(false);
  const [message, setMessage] = useState("Checking your private test access...");
  const [signIn, setSignIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [unlimitedTestPacks, setUnlimitedTestPacks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Rules | null>(null);
  const [rulesetId, setRulesetId] = useState<string | null>(null);
  const [rulesMessage, setRulesMessage] = useState("");
  const [packPhase, setPackPhase] = useState<PackPhase>("idle");
  const [revealedCount, setRevealedCount] = useState(0);
  const inFlight = useRef(false);
  const tearing = useRef(false);
  const revealed = useRef(0);
  const pointerStart = useRef<number | null>(null);
  const tearTimer = useRef<number | null>(null);
  const packStage = useRef<HTMLElement | null>(null);
  const opening = packPhase !== "idle" && revealedCount < opened.length;

  const loadArtwork = useCallback(async (newCards: Array<Card | string>) => {
    const keys = [...new Set(newCards.map((card) => typeof card === "string" ? card : card.cardKey))]
      .filter((key) => !artworkRequested.current.has(key));
    for (let offset = 0; offset < keys.length; offset += 50) {
      const batch = keys.slice(offset, offset + 50);
      batch.forEach((key) => artworkRequested.current.add(key));
      try {
        const response = await fetch(`/api/tcg?action=artwork&keys=${encodeURIComponent(batch.join(","))}`, { cache: "no-store" });
        const data: unknown = await response.json();
        if (!response.ok || !data || typeof data !== "object" || !("success" in data) || data.success !== true ||
            !("artwork" in data) || !data.artwork || typeof data.artwork !== "object" || !("missing" in data) || !Array.isArray(data.missing)) {
          throw new Error("Preview artwork could not be loaded.");
        }
        const received: Record<string, string> = {};
        for (const [key, value] of Object.entries(data.artwork)) {
          if (!batch.includes(key) || typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("Invalid preview artwork response.");
          received[key] = value;
        }
        setArtwork((current) => ({ ...current, ...received }));
        if (data.missing.length) setArtworkMessage("Some preview artwork is unavailable.");
      } catch (error) {
        batch.forEach((key) => artworkRequested.current.delete(key));
        setArtworkMessage(error instanceof Error ? error.message : "Preview artwork could not be loaded.");
      }
    }
  }, []);

  const loadCollection = useCallback(async (next?: string) => {
    const query = next ? `?view=stacks&cursor=${encodeURIComponent(next)}` : "?view=stacks";
    const response = await fetch(`/api/tcg${query}`, { cache: "no-store" });
    const data: Result = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.stacks)) {
      if (response.status === 401) setSignIn(true);
      throw new Error(data.error || "Your collection is unavailable.");
    }
    setStacks((current) => next ? [...current, ...data.stacks!] : data.stacks!);
    void loadArtwork(data.stacks.flatMap((stack) => stack.editions));
    setCursor(data.nextCursor || null);
    setUnlimitedTestPacks(data.unlimitedTestPacks === true);
    setReady(true);
    setMessage(data.unlimitedTestPacks ? "Your collection is ready. Unlimited packs are enabled for private testing." : "Your collection is ready. Free packs reset 24 hours after your last claim.");
  }, [loadArtwork]);

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

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setCatalogState("loading");
    setArtworkMessage("");
    void fetch("/api/tcg?action=catalog", { cache: "no-store" })
      .then(async (response) => {
        const data: Result = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.cards) || !data.cards.every(isCatalogCard) ||
            new Set(data.cards.map((card) => card.id)).size !== data.cards.length) {
          if (response.status === 401) setSignIn(true);
          throw new Error(data.error || "The card gallery could not be loaded.");
        }
        if (!cancelled) {
          setCatalog(data.cards);
          setCatalogState("ready");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCatalogState("error");
          setArtworkMessage(error instanceof Error ? error.message : "The card gallery could not be loaded.");
        }
      });
    return () => { cancelled = true; };
  }, [ready, catalogRetry]);

  const galleryCards = useMemo(() => {
    const query = gallerySearch.trim().toLowerCase();
    return catalog.filter((card) => (galleryKind === "all" || card.kind === galleryKind) &&
      (galleryRarity === "all" || card.rarity === galleryRarity) &&
      (!query || [card.name, card.kind, card.rarity, card.ability, card.story].some((value) => value.toLowerCase().includes(query))))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, galleryKind, galleryRarity, gallerySearch]);
  const visibleGalleryCards = useMemo(() => galleryCards.slice(galleryPage * GALLERY_PAGE_SIZE, (galleryPage + 1) * GALLERY_PAGE_SIZE), [galleryCards, galleryPage]);
  const galleryPageCount = Math.max(1, Math.ceil(galleryCards.length / GALLERY_PAGE_SIZE));
  const galleryKinds = useMemo(() => [...new Set(catalog.map((card) => card.kind))].sort(), [catalog]);

  useEffect(() => {
    if (catalogState === "ready") void loadArtwork(visibleGalleryCards.map((card) => card.id));
  }, [catalogState, loadArtwork, visibleGalleryCards]);

  useEffect(() => () => {
    if (tearTimer.current !== null) window.clearTimeout(tearTimer.current);
  }, []);

  useEffect(() => {
    if (packPhase === "sealed") {
      packStage.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  }, [packPhase]);

  async function ripPack() {
    if (inFlight.current || opening) return;
    inFlight.current = true;
    setBusy(true);
    setOpened([]);
    setPackPhase("idle");
    try {
      const key = sessionStorage.getItem("tcg-pending-request") || crypto.randomUUID();
      sessionStorage.setItem("tcg-pending-request", key);
      const response = await fetch("/api/tcg?action=open", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestKey: key }),
      });
      const data: Result = await response.json();
      if (!response.ok || !data.success || !data.pack || !Array.isArray(data.pack.cards) || data.pack.cards.length !== 2) {
        if (data.status === "cooldown" && data.nextAvailableAt) {
          sessionStorage.removeItem("tcg-pending-request");
          throw new Error(`Your next free pack is available ${new Date(data.nextAvailableAt).toLocaleString()}.`);
        }
        throw new Error(data.error || "Your pack could not be opened. Try again to recover the same request.");
      }
      sessionStorage.removeItem("tcg-pending-request");
      tearing.current = false;
      revealed.current = 0;
      setRevealedCount(0);
      setOpened(data.pack.cards);
      setReplayedPack(data.replayed === true);
      void loadArtwork(data.pack.cards);
      setPackPhase("sealed");
      setMessage(data.replayed ? "Recovered your previous pack. Check your collection for current ownership." : "Your cards are saved. Tear open your pack to reveal them.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your pack could not be opened. Please retry.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function finishTear() {
    if (tearTimer.current !== null) window.clearTimeout(tearTimer.current);
    tearTimer.current = null;
    setPackPhase("reveal");
    setMessage("Your pack is open. Reveal your cards one at a time.");
  }

  function tearPack() {
    if (packPhase !== "sealed" || tearing.current) return;
    tearing.current = true;
    setPackPhase("tearing");
    setMessage("Tearing open your pack...");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishTear();
    } else {
      tearTimer.current = window.setTimeout(finishTear, 1350);
    }
  }

  function revealCard(index: number) {
    if (packPhase !== "reveal" || index !== revealed.current) return;
    revealed.current = index + 1;
    setRevealedCount(index + 1);
    if (index + 1 < opened.length) {
      setMessage("One more card awaits. Reveal your special pull.");
    } else {
      const savedMessage = replayedPack ? "Previous pack recovered. Check your collection for current ownership." : "Both cards are saved to your collection.";
      setMessage(savedMessage);
      void loadCollection()
        .then(() => setMessage(savedMessage))
        .catch((error: unknown) => setMessage(error instanceof Error ? `Collection refresh failed: ${error.message}` : "The collection could not refresh."));
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
      <p>Crews, creatures, vehicles and support cards share one world. Open a pack and begin your collection.</p>
      <div className="tcg-status" role="status" aria-live="polite">{message}</div>
      {signIn && <a className="tcg-button" href="/api/auth/discord/login?returnTo=%2Ftcg">Sign in with Discord</a>}
      {ready && !opening && <button className="tcg-button" disabled={busy} onClick={() => void ripPack()}>{busy ? "Preparing your pack..." : "✦ Rip your free pack"}</button>}
      <p className="tcg-note">Two cards per pack · {ready && unlimitedTestPacks ? "unlimited packs during private testing" : "one free pack every 24 hours"} · test artwork, stories and battle rules are not final. Wilds unlocks and rewards are not active yet.</p>
      {artworkMessage && <p className="tcg-note" role="status">{artworkMessage}</p>}
    </section>
    {(packPhase === "sealed" || packPhase === "tearing") && <section ref={packStage} className="tcg-section tcg-opening" aria-label="Pack opening">
      <div className="tcg-opening-copy"><p className="tcg-eyebrow">THE CITY MEETS THE WILDS</p><h2>Your story is sealed inside.</h2><p>{packPhase === "sealed" ? "Drag across the pack or tap to tear it open." : "The seal is breaking..."}</p></div>
      <div className="tcg-pack-stage">
        <div className="tcg-pack-glow" aria-hidden="true" />
        <button type="button" className={`tcg-pack tcg-pack-${packPhase}`} disabled={packPhase !== "sealed"} aria-label="Tear open your pack"
          onPointerDown={(event) => { pointerStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerUp={(event) => { if (pointerStart.current !== null && Math.abs(event.clientX - pointerStart.current) >= 45) tearPack(); pointerStart.current = null; }}
          onPointerCancel={() => { pointerStart.current = null; }}
          onClick={tearPack}>
          <span className="tcg-pack-top" aria-hidden="true"><span>TEAR HERE</span></span>
          <span className="tcg-pack-body" aria-hidden="true"><span className="tcg-pack-edition">PRIVATE TEST · FIRST EDITION</span><span className="tcg-pack-brand">POSSUM<br /><em>WILDS</em></span><span className="tcg-pack-emblem">✦</span><span className="tcg-pack-subtitle">THE CITY MEETS THE WILDS</span><span className="tcg-pack-count">2 CARDS INSIDE</span></span>
        </button>
        {packPhase === "tearing" && <div className="tcg-pack-burst" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>}
      </div>
      {packPhase === "tearing" && <button type="button" className="tcg-skip" onClick={finishTear}>Skip animation</button>}
    </section>}
    {packPhase === "reveal" && opened.length > 0 && <section className="tcg-section tcg-pulls"><div className="tcg-section-heading"><div><p className="tcg-eyebrow">YOUR LATEST PULL</p><h2>{opening ? "See what you found." : "Fresh from the pack"}</h2></div><span>{revealedCount} of {opened.length} revealed · {replayedPack ? "check collection for current ownership" : "saved to your collection"}</span></div>
      <div className="tcg-grid tcg-reveal-grid">{opened.map((card, index) => <div className={`tcg-flip${index < revealedCount ? " tcg-flip-revealed" : ""}`} key={card.id}>
        <div className="tcg-flip-inner">
          <button type="button" className="tcg-card-back" disabled={index !== revealedCount} onClick={() => revealCard(index)} aria-hidden={index < revealedCount} aria-label={`Reveal card ${index + 1} of ${opened.length}`}>
            <span className="tcg-card-back-mark">✦</span><strong>POSSUM<br /><em>WILDS</em></strong><span>{index === revealedCount ? "TAP TO REVEAL" : "REVEAL IN ORDER"}</span>
          </button>
          <div className="tcg-card-front" aria-hidden={index >= revealedCount}><CardView card={card} artwork={artwork[card.cardKey]} /></div>
        </div>
      </div>)}</div>
    </section>}
    {ready && !opening && <section className="tcg-section"><div className="tcg-section-heading"><div><p className="tcg-eyebrow">YOUR CARDS</p><h2>The collection</h2></div><span>{stacks.length} unique cards · {stacks.reduce((total, stack) => total + stack.quantity, 0)} copies loaded</span></div>
      {stacks.length ? <div className="tcg-grid">{stacks.map((stack) => <StackView key={stack.cardKey} stack={stack} artwork={artwork[stack.cardKey]} />)}</div> : <div className="tcg-empty">Your story starts with your first pack.</div>}
      {cursor && <button className="tcg-secondary" disabled={busy} onClick={() => void loadCollection(cursor).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load more cards."))}>Load more cards</button>}
    </section>}
    {ready && !opening && <section className="tcg-section tcg-gallery" aria-labelledby="tcg-gallery-title">
      <div className="tcg-section-heading"><div><p className="tcg-eyebrow">THE CITY MEETS THE WILDS</p><h2 id="tcg-gallery-title">Card gallery</h2></div>
        <span>{catalogState === "ready" ? `${galleryCards.length} of ${catalog.length} cards` : "Full set preview"}</span></div>
      <p className="tcg-gallery-intro">Explore the full card set and its artwork, whether or not a card is in your collection. Preview artwork is still in progress.</p>
      <div className="tcg-gallery-controls">
        <label>Search cards<input type="search" value={gallerySearch} onChange={(event) => { setGallerySearch(event.target.value); setGalleryPage(0); }} placeholder="Name, story, ability..." /></label>
        <label>Card type<select value={galleryKind} onChange={(event) => { setGalleryKind(event.target.value); setGalleryPage(0); }}><option value="all">All types</option>{galleryKinds.map((kind) => <option value={kind} key={kind}>{kind}</option>)}</select></label>
        <label>Rarity<select value={galleryRarity} onChange={(event) => { setGalleryRarity(event.target.value); setGalleryPage(0); }}><option value="all">All rarities</option>{rarities.map((rarity) => <option value={rarity} key={rarity}>{rarity}</option>)}</select></label>
      </div>
      {catalogState === "loading" && <p className="tcg-gallery-state" role="status">Loading the card gallery...</p>}
      {catalogState === "error" && <div className="tcg-empty" role="status">{artworkMessage || "The card gallery is unavailable."} <button type="button" className="tcg-gallery-retry" onClick={() => setCatalogRetry((retry) => retry + 1)}>Try again</button></div>}
      {catalogState === "ready" && (visibleGalleryCards.length ? <div className="tcg-grid tcg-gallery-grid">{visibleGalleryCards.map((card) => <CardView key={card.id} card={{ id: card.id, cardKey: card.id, finish: "standard", cardSnapshot: card }} artwork={artwork[card.id]} />)}</div> : <div className="tcg-empty">No cards match those filters.</div>)}
      {catalogState === "ready" && galleryCards.length > 0 && <div className="tcg-gallery-pager"><span>Page {galleryPage + 1} of {galleryPageCount}</span><div>
        <button type="button" className="tcg-secondary" disabled={galleryPage === 0} onClick={() => setGalleryPage((page) => Math.max(0, page - 1))}>Previous</button>
        <button type="button" className="tcg-secondary" disabled={galleryPage + 1 >= galleryPageCount} onClick={() => setGalleryPage((page) => Math.min(galleryPageCount - 1, page + 1))}>Next</button>
      </div></div>}
    </section>}
    {ready && !opening && <TradePanel stacks={stacks} refreshCollection={loadCollection} />}
    {ready && !opening && <BattlePanel stacks={stacks} refreshCollection={loadCollection} artwork={artwork} loadArtwork={loadArtwork} />}
    {rules && <section className="tcg-section tcg-admin"><details><summary>Developer controls <span>Drop-rate settings</span></summary>
      <p>All values are percentages. Each row must total 100%. Changes affect future packs only.</p>
      <div className="tcg-rules"><div className="tcg-rule-row"><strong>Special type</strong>{specials.map((key) => <label key={key}>{key}<input type="number" min="0" max="100" step="0.01" value={rules.specialWeights[key] / 100} onChange={(event) => changeWeight("special", key, event.target.value)} /></label>)}</div>
      {slots.map((slot) => <div className="tcg-rule-row" key={slot}><strong>{slot} rarity</strong>{rarities.map((rarity) => <label key={rarity}>{rarity}<input type="number" min="0" max="100" step="0.01" value={rules.rarityWeights[slot][rarity] / 100} onChange={(event) => changeWeight(slot, rarity, event.target.value)} /></label>)}</div>)}</div>
      <p role="status">{rulesMessage}</p><button className="tcg-secondary" disabled={busy} onClick={() => void saveRules()}>Save drop rates</button>
    </details></section>}
  </main>;
}
