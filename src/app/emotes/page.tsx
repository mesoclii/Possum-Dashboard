"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Guild = { id: string; name: string; owner?: boolean; manageable?: boolean; botPresent?: boolean };
type Asset = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; published?: boolean; sourceGuildId?: string; sourceGuildName?: string };
type CatalogItem = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; publishedAt: string; useCount: number };
type PendingCatalogItem = { id: string; sourceGuildId: string; sourceGuildName: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; submittedAt: string };
type PersonalItem = { id: string; sourceGuildId: string; sourceGuildName: string; sourceAssetId: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; uploaded?: boolean; downloadName?: string; url: string; importedAt: string };

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
  const [sourceGuildId, setSourceGuildId] = useState("all");
  const [targetGuildId, setTargetGuildId] = useState("");
  const [botInviteUrl, setBotInviteUrl] = useState("");
  const [assetLoadMessage, setAssetLoadMessage] = useState("");
  const [name, setName] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [linkedAssetUrl, setLinkedAssetUrl] = useState("");
  const [linkedAssetName, setLinkedAssetName] = useState("");
  const [linkedAssetType, setLinkedAssetType] = useState<"emoji" | "sticker">("emoji");
  const [uploadName, setUploadName] = useState("");
  const [uploadAssetType, setUploadAssetType] = useState<"emoji" | "sticker" | "gif">("emoji");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [generalConfirmed, setGeneralConfirmed] = useState(false);
  const [personalRightsConfirmed, setPersonalRightsConfirmed] = useState(false);
  const [targetType, setTargetType] = useState<"emoji" | "sticker">("emoji");
  const [search, setSearch] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);

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

  const loadGuildAssets = useCallback(async (guildId: string): Promise<Asset[]> => {
    if (!guildId) return [];
    const response = await fetch(`/api/jed-catalog?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not read that server's assets.");
    return (Array.isArray(body.items) ? body.items : []).map((item: Asset) => ({
      ...item,
      sourceGuildId: guildId,
      sourceGuildName: String(body.guildName || "Discord server"),
    }));
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
          fetch("/api/guilds?includeAll=1", { cache: "no-store" }), fetch("/api/guilds/installed", { cache: "no-store" }),
        ]);
        const [manageable, installed] = await Promise.all([manageableResponse.json(), installedResponse.json()]);
        if (!manageableResponse.ok || !manageable?.loggedIn || !installedResponse.ok || installed?.success !== true) throw new Error("Could not load your Discord servers.");
        const botGuilds = new Set((Array.isArray(installed.guilds) ? installed.guilds : []).filter((entry: Guild) => entry?.botPresent !== false).map((entry: Guild) => entry.id));
        const options: Guild[] = (Array.isArray(manageable.guilds) ? manageable.guilds : [])
          .filter((entry: Guild) => typeof entry?.id === "string")
          .map((entry: Guild) => ({ id: entry.id, name: entry.name, owner: entry.owner, manageable: entry.manageable === true, botPresent: botGuilds.has(entry.id) }));
        if (!active) return;
        setGuilds(options);
        setBotInviteUrl(typeof installed.inviteUrl === "string" ? installed.inviteUrl : "");
        const previous = window.localStorage.getItem("activeGuildId") || "";
        const readableGuilds = options.filter((entry) => entry.botPresent);
        const destinations = options.filter((entry) => entry.botPresent && entry.manageable);
        const first = destinations.find((entry) => entry.id === previous)?.id || destinations[0]?.id || "";
        setSourceGuildId("all");
        setTargetGuildId(first);
        setAssetLoadMessage(readableGuilds.length ? `Loading assets from ${readableGuilds.length} server${readableGuilds.length === 1 ? "" : "s"} where Possum Bot is installed…` : "Possum Bot is not installed in your servers yet.");
        const loaded: Asset[] = [];
        const failures: string[] = [];
        for (let offset = 0; offset < readableGuilds.length; offset += 3) {
          const batch = readableGuilds.slice(offset, offset + 3);
          const results = await Promise.all(batch.map(async (guild) => {
            try { return (await loadGuildAssets(guild.id)).map((asset) => ({ ...asset, sourceGuildName: guild.name })); }
            catch (error) { failures.push(guild.name); return []; }
          }));
          loaded.push(...results.flat());
          if (!active) return;
        }
        setAssets(loaded);
        setAssetLoadMessage(failures.length
          ? `Loaded ${loaded.length} assets. Could not read ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? ` and ${failures.length - 5} more` : ""}; check Possum Bot's access there.`
          : `Loaded ${loaded.length} assets from ${readableGuilds.length} server${readableGuilds.length === 1 ? "" : "s"}.`);
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Server access could not be loaded."); }
    })();
    return () => { active = false; };
  }, [loadCatalog, loadGuildAssets, loadPersonalItems]);

  const readableGuilds = useMemo(() => guilds.filter((guild) => guild.botPresent), [guilds]);
  const destinationGuilds = useMemo(() => guilds.filter((guild) => guild.botPresent && guild.manageable), [guilds]);
  const selectedSourceGuild = guilds.find((guild) => guild.id === sourceGuildId);
  const visibleGuildAssets = useMemo(() => sourceGuildId === "all" ? assets : assets.filter((asset) => asset.sourceGuildId === sourceGuildId), [assets, sourceGuildId]);

  const visibleItems = useMemo(() => items.filter((item) => `${item.name} ${item.assetType}`.toLowerCase().includes(search.trim().toLowerCase())), [items, search]);

  async function changeCatalog(action: string, extra: Record<string, unknown>, guildId = sourceGuildId) {
    if (!guildId || guildId === "all") throw new Error("Choose one source server first.");
    const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, action, ...extra }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "JED catalog operation failed.");
    return body;
  }

  async function publishAsset(asset: Asset) {
    setBusy(`publish:${asset.id}`); setMessage("");
    try {
      const sourceId = String(asset.sourceGuildId || sourceGuildId);
      await changeCatalog(asset.published ? "withdraw" : "publish", asset.published
        ? { assetId: asset.id }
        : { assetId: asset.id, assetType: asset.assetType, name: asset.name, rightsConfirmed, generalAudienceConfirmed: generalConfirmed }, sourceId);
      setMessage(asset.published ? `${asset.name} was removed from the public library.` : `${asset.name} was added to the public library.`);
      await Promise.all([loadCatalog(), loadGuildAssets(sourceId).then((updated) => setAssets((current) => [...current.filter((entry) => entry.sourceGuildId !== sourceId), ...updated]))]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update the listing."); }
    finally { setBusy(""); }
  }

  async function publishGif() {
    setBusy("publish-gif"); setMessage("");
    try {
      await changeCatalog("publish", { assetType: "gif", name, url: gifUrl, rightsConfirmed, generalAudienceConfirmed: generalConfirmed }, sourceGuildId);
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
    const selectedGuilds = sourceGuildId === "all" ? readableGuilds : readableGuilds.filter((guild) => guild.id === sourceGuildId);
    if (!selectedGuilds.length) {
      setMessage(selectedSourceGuild
        ? `${selectedSourceGuild.name}: Possum Bot must be installed before JED can read this server's emotes.`
        : "Choose a server where Possum Bot is installed, or choose all available servers.");
      return;
    }
    if (!personalRightsConfirmed) { setMessage("Confirm you are authorized to keep these assets in your private collection."); return; }
    setBusy("import-all"); setMessage("");
    try {
      let added = 0;
      let skipped = 0;
      let importedFrom = 0;
      let finalItems: PersonalItem[] = [];
      const failures: string[] = [];
      for (const guild of selectedGuilds) {
        const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "import-all", guildId: guild.id, rightsConfirmed: true }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.success !== true) {
          failures.push(`${guild.name}${body?.error ? ` (${body.error})` : ""}`);
          continue;
        }
        importedFrom += 1;
        added += Number(body.added || 0);
        skipped += Number(body.skipped || 0);
        if (Array.isArray(body.errors) && body.errors.length) failures.push(`${guild.name}: ${body.errors.join("; ")}`);
        if (Array.isArray(body.items)) finalItems = body.items;
      }
      if (importedFrom) setPersonalItems(finalItems);
      setPersonalRightsConfirmed(false);
      setMessage(`Saved ${added} new assets from ${importedFrom} server${importedFrom === 1 ? "" : "s"}; ${skipped} duplicates or unavailable assets were skipped.${failures.length ? ` Could not read: ${failures.join(", ")}.` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import server assets."); }
    finally { setBusy(""); }
  }

  async function importOneAsset(asset: Asset) {
    if (!personalRightsConfirmed) { setMessage("Confirm you are authorized to keep this asset in your private collection."); return; }
    if (!asset.sourceGuildId) { setMessage("Choose an asset from one of your Discord servers first."); return; }
    setBusy(`import-one:${asset.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-one", guildId: asset.sourceGuildId, assetId: asset.id, rightsConfirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not save this server asset.");
      setPersonalItems(Array.isArray(body.items) ? body.items : []);
      setMessage(body.added ? `Saved a private copy of ${asset.name} from ${asset.sourceGuildName}.` : `${asset.name} was already saved in your private collection.`);
      if (Array.isArray(body.errors) && body.errors.length) setMessage(`${asset.name} could not be downloaded: ${body.errors.join("; ")}`);
      setPersonalRightsConfirmed(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this server asset."); }
    finally { setBusy(""); }
  }

  async function importLinkedAsset() {
    if (!personalRightsConfirmed) { setMessage("Confirm you are authorized to keep this asset in your private collection."); return; }
    if (!linkedAssetUrl.trim() || !linkedAssetName.trim()) { setMessage("Enter a Discord CDN link and an asset name."); return; }
    setBusy("import-link"); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-linked-personal",
          rightsConfirmed: true,
          assets: [{
            name: linkedAssetName.trim(),
            assetType: linkedAssetType,
            animated: /\.gif(?:[?#]|$)/i.test(linkedAssetUrl.trim()),
            url: linkedAssetUrl.trim(),
          }],
        }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not save this Discord asset link.");
      setPersonalItems(Array.isArray(body.items) ? body.items : []);
      setLinkedAssetUrl("");
      setLinkedAssetName("");
      setPersonalRightsConfirmed(false);
      setMessage(`Saved ${body.added || 0} linked asset${body.added === 1 ? "" : "s"}; ${body.skipped || 0} duplicate or unavailable.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this Discord asset link."); }
    finally { setBusy(""); }
  }

  async function uploadPersonalAsset() {
    if (!personalRightsConfirmed) { setMessage("Confirm you are authorized to keep this asset in your private collection."); return; }
    if (!uploadFile || !uploadName.trim()) { setMessage("Choose an image and enter an asset name."); return; }
    if (uploadFile.size > 5 * 1024 * 1024) { setMessage("Choose an image under 5 MiB."); return; }
    setBusy("upload-personal"); setMessage("");
    try {
      const bytes = new Uint8Array(await uploadFile.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload-personal",
          rightsConfirmed: true,
          name: uploadName.trim(),
          assetType: uploadAssetType,
          contentBase64: btoa(binary),
        }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not save this image.");
      await loadPersonalItems();
      setUploadFile(null);
      setUploadName("");
      setPersonalRightsConfirmed(false);
      if (uploadInput.current) uploadInput.current.value = "";
      setMessage(`Saved ${body.item?.name || "the image"} to your private collection.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this image."); }
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
          <p style={{ ...muted, maxWidth: 900, marginBottom: 0 }}>Browse approved public assets or manage your private Discord asset collection. Your private collection is visible only to your account; ordinary JED saves remain in each server&apos;s automatic guild vault.</p>
        </header>

        {message ? <div role="status" style={panel}>{message}</div> : null}
        {!publishingEnabled ? <div style={panel}>New shared public submissions are disabled. Existing approved items remain available; use the private collection below for your server assets.</div> : null}

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>Browse the public library</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input aria-label="Search public assets" style={input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search emoji, sticker, or GIF" />
            <label style={muted}>Add to server <select style={input} value={targetGuildId} onChange={(event) => setTargetGuildId(event.target.value)} disabled={!destinationGuilds.length}>
              <option value="">Choose a destination</option>{destinationGuilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
            </select></label>
            <label style={muted}>Save as <select style={{ ...input, maxWidth: 180 }} value={targetType} onChange={(event) => setTargetType(event.target.value as "emoji" | "sticker")}><option value="emoji">Emoji / GIF</option><option value="sticker">Sticker</option></select></label>
          </div>
          {!signedIn ? <p style={muted}><a href="/api/auth/discord/login?returnTo=%2Femotes" style={{ color: "#ff9ebc" }}>Sign in with Discord</a> to see your servers and save JED assets.</p> : !destinationGuilds.length ? <p style={muted}>To add assets into a Discord server, Possum Bot must be installed there and your account must be able to manage that server.</p> : null}
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

        {signedIn ? <section style={panel}>
          <h2 style={{ marginTop: 0 }}>Import from your Discord server</h2>
          <p style={muted}>JED lists every server you belong to. It can read that server&apos;s inventory when Possum Bot is installed there. Saving a private copy does not change the server or publish the asset.</p>
          <label style={{ ...muted, display: "block" }}>Source server<br /><select style={input} value={sourceGuildId} onChange={(event) => setSourceGuildId(event.target.value)}>
            <option value="all">All servers where JED can read assets</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name} — {guild.botPresent ? "Possum Bot installed" : "Add Possum Bot to read assets"}</option>)}
          </select></label>
          {sourceGuildId !== "all" && selectedSourceGuild && !selectedSourceGuild.botPresent ? <div style={{ ...panel, marginTop: 10 }}>
            <strong>{selectedSourceGuild.name}</strong><p style={muted}>You’re a member, but Possum Bot isn’t installed there, so Discord won’t let JED read the server’s emoji/sticker inventory. Add the app to this server to enable bulk listing and import.</p>
            {botInviteUrl ? <a href={(() => { try { const url = new URL(botInviteUrl); url.searchParams.set("guild_id", selectedSourceGuild.id); url.searchParams.set("disable_guild_select", "true"); return url.toString(); } catch { return botInviteUrl; } })()} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", display: "inline-block" }}>Add Possum Bot to {selectedSourceGuild.name}</a> : null}
          </div> : null}
          <div style={{ ...panel, marginTop: 14, display: "grid", gap: 9 }}>
            <label style={muted}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> I own this asset or have the right to redistribute it to a public catalog and other Discord servers.</label>
            <label style={muted}><input type="checkbox" checked={generalConfirmed} onChange={(event) => setGeneralConfirmed(event.target.checked)} /> I confirm this asset is suitable for a general-audience gallery and is not adult content.</label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
            {visibleGuildAssets.map((asset) => <article key={`${asset.sourceGuildId}:${asset.id}`} style={{ ...panel, padding: 12 }}>
              <img src={asset.url} alt={asset.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 104, objectFit: "contain", background: "#10000b", borderRadius: 8 }} />
              <strong style={{ display: "block", marginTop: 8, overflowWrap: "anywhere" }}>{asset.name}</strong>
              <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={!personalRightsConfirmed || Boolean(busy)} onClick={() => void importOneAsset(asset)}>
                {busy === `import-one:${asset.id}` ? "Saving copy…" : "Save private copy"}
              </button>
              <div style={muted}>{asset.assetType}{asset.animated ? " · Animated" : ""} · {asset.sourceGuildName}</div>
              {publishingEnabled ? <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={Boolean(busy) || !guilds.find((guild) => guild.id === asset.sourceGuildId)?.manageable || (!asset.published && !(rightsConfirmed && generalConfirmed))} onClick={() => void publishAsset(asset)}>
                {busy === `publish:${asset.id}` ? "Saving…" : asset.published ? "Remove from public library" : "Publish to library"}
              </button> : null}
            </article>)}
          </div>
          {assetLoadMessage ? <p role="status" style={muted}>{assetLoadMessage}</p> : null}
          {!publishingEnabled ? <p style={muted}>Public catalog submissions are disabled. Private imports and downloads remain available.</p> : null}
          {sourceGuildId !== "all" && selectedSourceGuild && selectedSourceGuild.botPresent && !visibleGuildAssets.length ? <p style={muted}>No supported Discord emoji or stickers were found in {selectedSourceGuild.name}.</p> : null}
          {sourceGuildId === "all" && !visibleGuildAssets.length && !assetLoadMessage ? <p style={muted}>No server assets are available yet.</p> : null}
          <div style={{ borderTop: "1px solid #5d1b39", marginTop: 20, paddingTop: 16 }}>
            <h3>Add a GIF URL</h3>
            <p style={muted}>Only HTTPS media from supported Discord, Tenor, Giphy, or Imgur hosts can be cataloged. JED revalidates and processes the URL during export.</p>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={input} maxLength={32} value={name} onChange={(event) => setName(event.target.value)} placeholder="GIF name" aria-label="GIF name" />
              <input style={input} maxLength={2000} value={gifUrl} onChange={(event) => setGifUrl(event.target.value)} placeholder="https://media.tenor.com/..." aria-label="GIF URL" />
              <button type="button" style={button} disabled={Boolean(busy) || sourceGuildId === "all" || !selectedSourceGuild?.botPresent || !selectedSourceGuild?.manageable || !name.trim() || !gifUrl.trim() || !(rightsConfirmed && generalConfirmed)} onClick={() => void publishGif()}>{busy === "publish-gif" ? "Adding…" : "Publish GIF"}</button>
            </div>
          </div>
        </section> : null}

        {signedIn ? <section id="private-collection" style={panel}>
          <h2 style={{ marginTop: 0 }}>My private asset collection</h2>
          <p style={muted}>JED lists emotes and supported stickers from every server you belong to where Possum Bot is installed. The server name appears on each asset. Choose one server or leave “All servers” selected to import across all available servers. Servers without the bot stay visible in the selector; add Possum Bot there to unlock their inventory. This collection is private to your account and is never published automatically.</p>
          <label style={{ ...muted, display: "block" }}>Source server<br /><select style={input} value={sourceGuildId} onChange={(event) => setSourceGuildId(event.target.value)}>
            <option value="all">All servers where JED can read assets</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name} — {guild.botPresent ? "Possum Bot installed" : "Add Possum Bot to read assets"}</option>)}
          </select></label>
          {sourceGuildId !== "all" && selectedSourceGuild && !selectedSourceGuild.botPresent ? <div style={{ ...panel, marginTop: 10 }}>
            <strong>{selectedSourceGuild.name}</strong><p style={muted}>Possum Bot isn’t in this server, so it cannot read the server inventory yet. Once an admin adds it, refresh this page and the server’s assets will appear here.</p>
            {botInviteUrl ? <a href={(() => { try { const url = new URL(botInviteUrl); url.searchParams.set("guild_id", selectedSourceGuild.id); url.searchParams.set("disable_guild_select", "true"); return url.toString(); } catch { return botInviteUrl; } })()} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", display: "inline-block" }}>Add Possum Bot to {selectedSourceGuild.name}</a> : null}
          </div> : null}
          <p style={muted}><label><input type="checkbox" checked={personalRightsConfirmed} onChange={(event) => setPersonalRightsConfirmed(event.target.checked)} /> I am authorized to keep these assets in my private collection and use them in servers I manage.</label></p>
          <button type="button" style={button} disabled={!personalRightsConfirmed || !readableGuilds.length || (sourceGuildId !== "all" && !selectedSourceGuild?.botPresent) || Boolean(busy)} onClick={() => void importAllAssets()}>
            {busy === "import-all" ? "Importing server assets…" : `Import all ${visibleGuildAssets.length} listed assets${sourceGuildId === "all" ? ` from ${readableGuilds.length} servers` : ""}`}
          </button>
          {assetLoadMessage ? <p role="status" style={muted}>{assetLoadMessage}</p> : null}
          {visibleGuildAssets.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
            {visibleGuildAssets.map((asset) => <article key={`${asset.sourceGuildId}:${asset.id}`} style={{ ...panel, padding: 12 }}>
              <img src={asset.url} alt={asset.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 104, objectFit: "contain", background: "#10000b", borderRadius: 8 }} />
              <strong style={{ display: "block", marginTop: 8, overflowWrap: "anywhere" }}>{asset.name}</strong>
              <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={!personalRightsConfirmed || Boolean(busy)} onClick={() => void importOneAsset(asset)}>
                {busy === `import-one:${asset.id}` ? "Saving copy…" : "Save private copy"}
              </button>
              <div style={muted}>{asset.assetType}{asset.animated ? " · Animated" : ""} · {asset.sourceGuildName}</div>
            </article>)}
          </div> : null}
          <div style={{ ...panel, marginTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Save a Discord asset link</h3>
            <p style={muted}>Paste a direct Discord CDN URL for an emoji or sticker. JED downloads and validates the image into your private collection.</p>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={input} maxLength={32} value={linkedAssetName} onChange={(event) => setLinkedAssetName(event.target.value)} placeholder="Asset name" aria-label="Linked asset name" />
              <input style={input} maxLength={2000} value={linkedAssetUrl} onChange={(event) => setLinkedAssetUrl(event.target.value)} placeholder="https://cdn.discordapp.com/emojis/..." aria-label="Discord asset CDN URL" />
              <select style={{ ...input, maxWidth: 220 }} value={linkedAssetType} onChange={(event) => setLinkedAssetType(event.target.value as "emoji" | "sticker")} aria-label="Linked asset type">
                <option value="emoji">Emoji</option><option value="sticker">Sticker</option>
              </select>
              <button type="button" style={button} disabled={Boolean(busy) || !linkedAssetUrl.trim() || !linkedAssetName.trim() || !personalRightsConfirmed} onClick={() => void importLinkedAsset()}>
                {busy === "import-link" ? "Saving link…" : "Save linked asset"}
              </button>
            </div>
          </div>
          <div style={{ ...panel, marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Upload a copied image</h3>
            <p style={muted}>Choose a PNG, JPEG, WebP, or GIF image under 5 MiB. JED validates it before saving.</p>
            <div style={{ display: "grid", gap: 10 }}>
              <input style={input} maxLength={32} value={uploadName} onChange={(event) => setUploadName(event.target.value)} placeholder="Asset name" aria-label="Uploaded asset name" />
              <select style={{ ...input, maxWidth: 220 }} value={uploadAssetType} onChange={(event) => setUploadAssetType(event.target.value as "emoji" | "sticker" | "gif")} aria-label="Uploaded asset type">
                <option value="emoji">Emoji</option><option value="sticker">Sticker</option><option value="gif">GIF</option>
              </select>
              <input ref={uploadInput} style={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose an image to upload" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
              <button type="button" style={button} disabled={Boolean(busy) || !uploadFile || !uploadName.trim() || !personalRightsConfirmed} onClick={() => void uploadPersonalAsset()}>
                {busy === "upload-personal" ? "Saving image…" : "Save uploaded image"}
              </button>
            </div>
          </div>
          <h3>Saved assets ({personalItems.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {personalItems.map((item) => <article key={item.id} style={{ ...panel, padding: 12 }}>
              <img src={item.url} alt={item.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 104, objectFit: "contain", background: "#10000b", borderRadius: 8 }} />
              <strong style={{ display: "block", marginTop: 8, overflowWrap: "anywhere" }}>{item.name}</strong>
              <a href={item.url} download={item.downloadName || item.name} style={{ ...button, display: "block", textAlign: "center", textDecoration: "none", marginTop: 8 }}>Download saved copy</a>
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
