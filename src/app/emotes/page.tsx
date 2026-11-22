"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Guild = { id: string; name: string; owner?: boolean; botPresent?: boolean };
type Asset = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; published?: boolean };
type CatalogItem = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; publishedAt: string; useCount: number };
type PendingCatalogItem = { id: string; sourceGuildId: string; sourceGuildName: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; submittedAt: string };
type PersonalItem = { id: string; sourceGuildId: string; sourceGuildName: string; sourceAssetId: string; name: string; assetType: "emoji" | "sticker"; animated: boolean; url: string; importedAt: string };

const shell: CSSProperties = { minHeight: "100vh", padding: "clamp(18px, 4vw, 48px)", color: "#ffe4ee", background: "radial-gradient(ellipse at 85% 0%, #5b082e 0%, transparent 36%), radial-gradient(ellipse at 0% 40%, #3b071f 0%, transparent 40%), #10000b" };
const panel: CSSProperties = { border: "1px solid #8a2450", borderRadius: 18, padding: 20, background: "linear-gradient(145deg, rgba(55,5,29,.95), rgba(18,0,12,.97))", boxShadow: "0 12px 32px rgba(0,0,0,.22)" };
const input: CSSProperties = { width: "100%", maxWidth: 480, padding: "10px 12px", border: "1px solid #8a2450", borderRadius: 9, color: "#fff", background: "#16000b" };
const button: CSSProperties = { padding: "10px 15px", borderRadius: 9, border: "1px solid #ff2e75", color: "#fff", background: "#a7003e", cursor: "pointer", fontWeight: 750 };
const muted: CSSProperties = { color: "#efb4c9", lineHeight: 1.65 };

export default function EmoteLibraryPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingCatalogItem[]>([]);
  const [isCatalogReviewer, setIsCatalogReviewer] = useState(false);
  const [publishingEnabled, setPublishingEnabled] = useState(false);
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [sourceGuildId, setSourceGuildId] = useState("");
  const [targetGuildId, setTargetGuildId] = useState("");
  const [name, setName] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [generalConfirmed, setGeneralConfirmed] = useState(false);
  const [personalRightsConfirmed, setPersonalRightsConfirmed] = useState(false);
  const [targetType, setTargetType] = useState<"emoji" | "sticker">("emoji");
  const [search, setSearch] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const guildName = (id: string) => guilds.find((entry) => entry.id === id)?.name || id;

  const loadCatalog = useCallback(async (includeReview = signedIn) => {
    const response = await fetch(`/api/jed-catalog${includeReview ? "?review=1" : ""}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "The public JED library is unavailable.");
    setItems(Array.isArray(body.items) ? body.items : []);
    setPublishingEnabled(body.publishingEnabled === true);
    setIsCatalogReviewer(body.reviewer === true);
    setPendingItems(body.reviewer === true && Array.isArray(body.pending) ? body.pending : []);
  }, [signedIn]);

  const loadGuildAssets = useCallback(async (guildId: string) => {
    if (!guildId) { setAssets([]); return; }
    const response = await fetch(`/api/jed-catalog?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not read that server's assets.");
    setAssets(Array.isArray(body.items) ? body.items : []);
  }, []);

  const loadPersonalItems = useCallback(async () => {
    const response = await fetch("/api/jed-catalog?collection=1", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "Your private JED collection is unavailable.");
    setPersonalItems(Array.isArray(body.items) ? body.items : []);
  }, []);

  useEffect(() => {
    let active = true;
    void loadCatalog().catch((error) => active && setMessage(error instanceof Error ? error.message : "Catalog unavailable."))
      .finally(() => active && setLoading(false));
    void (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session?brief=1", { cache: "no-store" });
        const session = await sessionResponse.json().catch(() => ({}));
        if (!session?.loggedIn) return;
        setSignedIn(true);
        void loadPersonalItems().catch((error) => active && setMessage(error instanceof Error ? error.message : "Private collection unavailable."));
        const [manageableResponse, installedResponse] = await Promise.all([
          fetch("/api/guilds", { cache: "no-store" }), fetch("/api/guilds/installed", { cache: "no-store" }),
        ]);
        const [manageable, installed] = await Promise.all([manageableResponse.json(), installedResponse.json()]);
        if (!manageableResponse.ok || !manageable?.loggedIn || !installedResponse.ok || installed?.success !== true) throw new Error("Could not load your manageable servers.");
        const botGuilds = new Set((Array.isArray(installed.guilds) ? installed.guilds : []).filter((entry: Guild) => entry?.botPresent !== false).map((entry: Guild) => entry.id));
        const options: Guild[] = (Array.isArray(manageable.guilds) ? manageable.guilds : [])
          .filter((entry: Guild) => typeof entry?.id === "string" && botGuilds.has(entry.id))
          .map((entry: Guild) => ({ id: entry.id, name: entry.name, owner: entry.owner, botPresent: true }));
        if (!active) return;
        setGuilds(options);
        const previous = window.localStorage.getItem("activeGuildId") || "";
        const first = options.find((entry) => entry.id === previous)?.id || options[0]?.id || "";
        setSourceGuildId(first);
        setTargetGuildId(first);
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Server access could not be loaded."); }
    })();
    return () => { active = false; };
  }, [loadCatalog, loadPersonalItems]);

  useEffect(() => {
    if (!sourceGuildId) { setAssets([]); return; }
    void loadGuildAssets(sourceGuildId).catch((error) => setMessage(error instanceof Error ? error.message : "Could not read server assets."));
  }, [sourceGuildId, loadGuildAssets]);

  const visibleItems = useMemo(() => items.filter((item) => `${item.name} ${item.assetType}`.toLowerCase().includes(search.trim().toLowerCase())), [items, search]);

  async function changeCatalog(action: string, extra: Record<string, unknown>) {
    if (!sourceGuildId) throw new Error("Choose a server first.");
    const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: sourceGuildId, action, ...extra }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "JED catalog operation failed.");
    return body;
  }

  async function publishAsset(asset: Asset) {
    setBusy(`publish:${asset.id}`); setMessage("");
    try {
      await changeCatalog(asset.published ? "withdraw" : "publish", asset.published
        ? { assetId: asset.id }
        : { assetId: asset.id, assetType: asset.assetType, name: asset.name, rightsConfirmed, generalAudienceConfirmed: generalConfirmed });
      setMessage(asset.published ? `${asset.name} was removed from the public library.` : `${asset.name} was added to the public library.`);
      await Promise.all([loadCatalog(), loadGuildAssets(sourceGuildId)]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update the listing."); }
    finally { setBusy(""); }
  }

  async function publishGif() {
    setBusy("publish-gif"); setMessage("");
    try {
      await changeCatalog("publish", { assetType: "gif", name, url: gifUrl, rightsConfirmed, generalAudienceConfirmed: generalConfirmed });
      setGifUrl(""); setName(""); setMessage("GIF added to the public JED library."); await loadCatalog();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add the GIF."); }
    finally { setBusy(""); }
  }

  async function exportItem(item: CatalogItem) {
    if (!targetGuildId) { setMessage("Choose the destination Discord server."); return; }
    if (!window.confirm(`Use JED to add “${item.name}” as a ${targetType} in ${guildName(targetGuildId)}? Possum Bot and your Discord account need Manage Expressions in that server.`)) return;
    setBusy(`export:${item.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: targetGuildId, action: "export", itemId: item.id, target: targetType, rightsConfirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "JED could not export this asset.");
      setMessage(`JED added ${item.name} to ${guildName(targetGuildId)}.`);
      await loadCatalog();
    } catch (error) { setMessage(error instanceof Error ? error.message : "JED export failed."); }
    finally { setBusy(""); }
  }

  async function reviewAsset(item: PendingCatalogItem, decision: "approve" | "reject") {
    if (!window.confirm(`${decision === "approve" ? "Approve for the public library" : "Reject and hide"} “${item.name}”?`)) return;
    setBusy(`review:${item.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: item.sourceGuildId, action: "review", itemId: item.id, decision }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not review this listing.");
      setMessage(decision === "approve" ? `${item.name} was approved and is now public.` : `${item.name} was rejected.`);
      await loadCatalog(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not review listing."); }
    finally { setBusy(""); }
  }

  async function importAllAssets() {
    if (!sourceGuildId) { setMessage("Choose the Alexandria/source server first."); return; }
    if (!personalRightsConfirmed) { setMessage("Confirm you are authorized to keep these assets in your private collection."); return; }
    setBusy("import-all"); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-all", guildId: sourceGuildId, rightsConfirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not import server assets.");
      setPersonalItems(Array.isArray(body.items) ? body.items : []);
      setPersonalRightsConfirmed(false);
      setMessage(`Imported ${body.added} new assets from ${guildName(sourceGuildId)}; ${Math.max(0, body.total - body.added)} were already in your collection.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import server assets."); }
    finally { setBusy(""); }
  }

  async function exportPersonalItem(item: PersonalItem) {
    if (!targetGuildId) { setMessage("Choose the destination Discord server."); return; }
    if (!window.confirm(`Add “${item.name}” to ${guildName(targetGuildId)} with JED?`)) return;
    setBusy(`personal-export:${item.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export-personal", guildId: targetGuildId, itemId: item.id, target: targetType, rightsConfirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "JED could not add this asset.");
      setMessage(`JED added ${item.name} to ${guildName(targetGuildId)}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "JED export failed."); }
    finally { setBusy(""); }
  }

  async function removePersonalItem(item: PersonalItem) {
    if (!window.confirm(`Remove “${item.name}” from your private dashboard collection?`)) return;
    setBusy(`personal-remove:${item.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-personal", itemId: item.id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not remove this asset.");
      setPersonalItems((previous) => previous.filter((entry) => entry.id !== item.id));
      setMessage(`${item.name} was removed from your private collection.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove this asset."); }
    finally { setBusy(""); }
  }

  return (
    <main style={shell}>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...panel, padding: "clamp(22px, 5vw, 44px)" }}>
          <div style={{ color: "#ff81ad", fontSize: 12, fontWeight: 900, letterSpacing: ".2em", textTransform: "uppercase" }}>JED · Public Library</div>
          <h1 style={{ margin: "8px 0", fontSize: "clamp(32px, 5vw, 52px)", color: "#fff" }}>Emoji, Sticker & GIF Studio</h1>
          <p style={{ ...muted, maxWidth: 900, marginBottom: 0 }}>Browse approved public assets or manage your private collection imported from a Discord server you manage. Your private collection is visible only to your account; ordinary JED saves remain in each server&apos;s automatic guild vault.</p>
        </header>

        {message ? <div role="status" style={panel}>{message}</div> : null}
        {!publishingEnabled ? <div style={panel}>New shared public submissions are disabled. Existing approved items remain available; use the private collection below for your server assets.</div> : null}

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>Browse the public library</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input aria-label="Search public assets" style={input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search emoji, sticker, or GIF" />
            <label style={muted}>Add to server <select style={input} value={targetGuildId} onChange={(event) => setTargetGuildId(event.target.value)} disabled={!guilds.length}>
              <option value="">Choose a destination</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
            </select></label>
            <label style={muted}>Save as <select style={{ ...input, maxWidth: 180 }} value={targetType} onChange={(event) => setTargetType(event.target.value as "emoji" | "sticker")}><option value="emoji">Emoji / GIF</option><option value="sticker">Sticker</option></select></label>
          </div>
          {!signedIn ? <p style={muted}><a href="/api/auth/discord/login?returnTo=%2Femotes" style={{ color: "#ff9ebc" }}>Sign in with Discord</a> and manage a server with Possum Bot to import or export.</p> : !guilds.length ? <p style={muted}>No server where you can manage expressions and Possum Bot is installed was found.</p> : null}
          {loading ? <p role="status">Loading public assets…</p> : visibleItems.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
              {visibleItems.map((item) => <article key={item.id} style={{ ...panel, padding: 14 }}>
                <img src={item.url} alt={item.name} loading="lazy" referrerPolicy="no-referrer" style={{ display: "block", width: "100%", height: 132, objectFit: "contain", background: "#10000b", borderRadius: 10 }} />
                <strong style={{ display: "block", marginTop: 10, overflowWrap: "anywhere" }}>{item.name}</strong>
                <div style={muted}>{item.assetType}{item.animated ? " · Animated" : ""} · {item.useCount} uses</div>
                <button type="button" style={{ ...button, width: "100%", marginTop: 10 }} disabled={!signedIn || !targetGuildId || Boolean(busy)} onClick={() => void exportItem(item)}>{busy === `export:${item.id}` ? "Using JED…" : "Add with JED"}</button>
              </article>)}
            </div>
          ) : <p style={muted}>{search ? "No matching public assets." : "No public assets have been shared yet."}</p>}
        </section>

        {signedIn && publishingEnabled && isCatalogReviewer ? <section style={panel}>
          <h2 style={{ marginTop: 0 }}>JED public-library review queue</h2>
          <p style={muted}>New submissions are private until a configured reviewer checks that they are general-audience and rights-cleared.</p>
          {pendingItems.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {pendingItems.map((item) => <article key={item.id} style={{ ...panel, padding: 14 }}>
              <img src={item.url} alt={item.name} loading="lazy" referrerPolicy="no-referrer" style={{ display: "block", width: "100%", height: 120, objectFit: "contain", background: "#10000b", borderRadius: 10 }} />
              <strong style={{ display: "block", marginTop: 8 }}>{item.name} · {item.assetType}</strong>
              <div style={muted}>Source: {item.sourceGuildName || "Discord server"}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" style={button} disabled={Boolean(busy)} onClick={() => void reviewAsset(item, "approve")}>Approve</button>
                <button type="button" style={{ ...button, background: "#421328" }} disabled={Boolean(busy)} onClick={() => void reviewAsset(item, "reject")}>Reject</button>
              </div>
            </article>)}
          </div> : <p style={muted}>No assets are waiting for review.</p>}
        </section> : null}

        {signedIn && publishingEnabled ? <section style={panel}>
          <h2 style={{ marginTop: 0 }}>Import from your Discord server</h2>
          <p style={muted}>Only servers where you can manage expressions and Possum Bot is installed are listed. Importing submits an asset privately for review; it does not change the source server or publish the asset automatically.</p>
          <label style={{ ...muted, display: "block" }}>Source server<br /><select style={input} value={sourceGuildId} onChange={(event) => setSourceGuildId(event.target.value)}>
            <option value="">Choose a source server</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
          </select></label>
          <div style={{ ...panel, marginTop: 14, display: "grid", gap: 9 }}>
            <label style={muted}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> I own this asset or have the right to redistribute it to a public catalog and other Discord servers.</label>
            <label style={muted}><input type="checkbox" checked={generalConfirmed} onChange={(event) => setGeneralConfirmed(event.target.checked)} /> I confirm this asset is suitable for a general-audience gallery and is not adult content.</label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
            {assets.map((asset) => <article key={asset.id} style={{ ...panel, padding: 12 }}>
              <img src={asset.url} alt={asset.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 104, objectFit: "contain", background: "#10000b", borderRadius: 8 }} />
              <strong style={{ display: "block", marginTop: 8, overflowWrap: "anywhere" }}>{asset.name}</strong>
              <div style={muted}>{asset.assetType}{asset.animated ? " · Animated" : ""}</div>
              <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={Boolean(busy) || (!asset.published && !(rightsConfirmed && generalConfirmed))} onClick={() => void publishAsset(asset)}>
                {busy === `publish:${asset.id}` ? "Saving…" : asset.published ? "Remove from public library" : "Publish to library"}
              </button>
            </article>)}
          </div>
          {sourceGuildId && !assets.length ? <p style={muted}>No supported Discord emoji or stickers were found.</p> : null}
          <div style={{ borderTop: "1px solid #5d1b39", marginTop: 20, paddingTop: 16 }}>
            <h3>Add a GIF URL</h3>
            <p style={muted}>Only HTTPS media from supported Discord, Tenor, Giphy, or Imgur hosts can be cataloged. JED revalidates and processes the URL during export.</p>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={input} maxLength={32} value={name} onChange={(event) => setName(event.target.value)} placeholder="GIF name" aria-label="GIF name" />
              <input style={input} maxLength={2000} value={gifUrl} onChange={(event) => setGifUrl(event.target.value)} placeholder="https://media.tenor.com/..." aria-label="GIF URL" />
              <button type="button" style={button} disabled={Boolean(busy) || !sourceGuildId || !name.trim() || !gifUrl.trim() || !(rightsConfirmed && generalConfirmed)} onClick={() => void publishGif()}>{busy === "publish-gif" ? "Adding…" : "Publish GIF"}</button>
            </div>
          </div>
        </section> : null}

        {signedIn ? <section id="private-collection" style={panel}>
          <h2 style={{ marginTop: 0 }}>My private server collection</h2>
          <p style={muted}>Import every supported custom emoji and PNG/APNG/GIF sticker from a server you manage. Static and animated emojis are included. This collection is private to your Discord account and does not send anything to the public library or require moderator approval.</p>
          <label style={{ ...muted, display: "block" }}>Source server<br /><select style={input} value={sourceGuildId} onChange={(event) => setSourceGuildId(event.target.value)}>
            <option value="">Choose a source server</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
          </select></label>
          <p style={muted}><label><input type="checkbox" checked={personalRightsConfirmed} onChange={(event) => setPersonalRightsConfirmed(event.target.checked)} /> I am authorized to keep these assets in my private collection and use them in servers I manage.</label></p>
          <button type="button" style={button} disabled={!sourceGuildId || !personalRightsConfirmed || Boolean(busy)} onClick={() => void importAllAssets()}>
            {busy === "import-all" ? "Importing server assets…" : `Import all ${assets.length} listed assets`}
          </button>
          <h3>Saved assets ({personalItems.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {personalItems.map((item) => <article key={item.id} style={{ ...panel, padding: 12 }}>
              <img src={item.url} alt={item.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 104, objectFit: "contain", background: "#10000b", borderRadius: 8 }} />
              <strong style={{ display: "block", marginTop: 8, overflowWrap: "anywhere" }}>{item.name}</strong>
              <div style={muted}>{item.assetType}{item.animated ? " · Animated" : ""} · {item.sourceGuildName}</div>
              <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={!targetGuildId || Boolean(busy)} onClick={() => void exportPersonalItem(item)}>
                {busy === `personal-export:${item.id}` ? "Using JED…" : `Add to ${guildName(targetGuildId)}`}
              </button>
              <button type="button" style={{ ...button, width: "100%", marginTop: 8, background: "#421328" }} disabled={Boolean(busy)} onClick={() => void removePersonalItem(item)}>
                {busy === `personal-remove:${item.id}` ? "Removing…" : "Remove"}
              </button>
            </article>)}
          </div>
          {!personalItems.length ? <p style={muted}>Your private collection is empty.</p> : null}
        </section> : null}

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>18+ catalog mode</h2>
          <p style={muted}>The server-side NSFW preference is available in the JED dashboard and defaults off. Adult assets are not accepted into this public feed and the toggle cannot bypass age checks. Adult browsing/export stays locked until age assurance, moderation, and access checks are configured.</p>
        </section>
      </div>
    </main>
  );
}
