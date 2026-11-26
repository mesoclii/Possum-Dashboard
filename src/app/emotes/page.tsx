"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Guild = { id: string; name: string; owner?: boolean; botPresent?: boolean };
type Asset = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; published?: boolean };
type CatalogItem = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; audience?: "general" | "adult"; url: string; publishedAt: string; useCount: number };
type PendingCatalogItem = { id: string; sourceGuildId: string; sourceGuildName: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; audience?: "general" | "adult"; url: string; submittedAt: string };
type PersonalItem = { id: string; sourceGuildId: string; sourceGuildName: string; sourceAssetId: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; uploaded?: boolean; publicListingStatus?: string; url: string; importedAt: string };

function parseDiscordAssetLinks(value: string) {
  const found = new Map<string, { url: string; name: string; assetType: "emoji" | "sticker"; animated: boolean }>();
  const emojiPattern = /<(a?):([a-zA-Z0-9_]{2,32}):(\d{16,20})>/g;
  for (const match of value.matchAll(emojiPattern)) {
    const animated = match[1] === "a";
    const id = match[3];
    const assetType = "emoji" as const;
    found.set(`${assetType}:${id}`, {
      url: `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`,
      name: match[2], assetType, animated,
    });
  }
  const stickerSharePattern = /https:\/\/discord\.com\/stickers\/(\d{16,20})/gi;
  for (const match of value.matchAll(stickerSharePattern)) {
    const id = match[1];
    found.set(`sticker:${id}`, {
      url: `https://media.discordapp.net/stickers/${id}.png?size=320`,
      name: `sticker_${id}`, assetType: "sticker", animated: false,
    });
  }
  const urlPattern = /https:\/\/[^\s<>()[\]{}]+/gi;
  for (const match of value.matchAll(urlPattern)) {
    const raw = match[0].replace(/[),.!?]+$/g, "");
    try {
      const url = new URL(raw);
      if (url.username || url.password || url.port || !["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname.toLowerCase())) continue;
      const assetMatch = url.pathname.match(/^\/(emojis|stickers)\/(\d{16,20})\.(png|gif|webp)$/i);
      if (!assetMatch) continue;
      const assetType = assetMatch[1].toLowerCase() === "emojis" ? "emoji" : "sticker";
      const id = assetMatch[2];
      found.set(`${assetType}:${id}`, {
        url: url.toString(),
        name: assetType === "emoji" ? `emoji_${id}` : `sticker_${id}`,
        assetType, animated: assetMatch[3].toLowerCase() === "gif",
      });
    } catch { /* Ignore text that is not a Discord CDN asset URL. */ }
  }
  return [...found.values()];
}

function catalogImageUrl(item: { id: string; url: string; audience?: "general" | "adult" }, guildId = "") {
  return item.url.startsWith("jed-upload:")
    ? `/api/jed-catalog?publicAssetId=${encodeURIComponent(item.id)}${item.audience === "adult" ? `&audience=adult&guildId=${encodeURIComponent(guildId)}` : ""}`
    : item.url;
}

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
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [sourceGuildId, setSourceGuildId] = useState("");
  const [targetGuildId, setTargetGuildId] = useState("");
  const [name, setName] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [generalConfirmed, setGeneralConfirmed] = useState(false);
  const [personalRightsConfirmed, setPersonalRightsConfirmed] = useState(false);
  const [linkedRightsConfirmed, setLinkedRightsConfirmed] = useState(false);
  const [linkedAssetText, setLinkedAssetText] = useState("");
  const [uploadRightsConfirmed, setUploadRightsConfirmed] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<"emoji" | "sticker" | "gif">("emoji");
  const [audience, setAudience] = useState<"general" | "adult">("general");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [targetType, setTargetType] = useState<"emoji" | "sticker">("emoji");
  const [search, setSearch] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [importStatus, setImportStatus] = useState("");

  const guildName = (id: string) => guilds.find((entry) => entry.id === id)?.name || id;

  const loadCatalog = useCallback(async (includeReview = signedIn, selectedAudience: "general" | "adult" = audience, guildId = targetGuildId) => {
    const params = new URLSearchParams();
    if (includeReview) params.set("review", "1");
    if (selectedAudience === "adult") { params.set("audience", "adult"); if (guildId) params.set("guildId", guildId); }
    const response = await fetch(`/api/jed-catalog${params.size ? `?${params}` : ""}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "The public JED library is unavailable.");
    setItems(Array.isArray(body.items) ? body.items : []);
    setPublishingEnabled(body.publishingEnabled === true);
    setIsCatalogReviewer(body.reviewer === true);
    setPendingItems(body.reviewer === true && Array.isArray(body.pending) ? body.pending : []);
  }, [signedIn, audience, targetGuildId]);

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
    const next = Array.isArray(body.items) ? body.items as PersonalItem[] : [];
    setPersonalItems(next);
    setNameDrafts(Object.fromEntries(next.map((item) => [item.id, item.name])));
  }, []);

  useEffect(() => {
    let active = true;
    setItems([]);
    setPendingItems([]);
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
    if (!sourceGuildId) { setAssets([]); setAssetsLoading(false); setImportStatus(""); return; }
    let active = true;
    setAssetsLoading(true);
    setImportStatus("");
    void loadGuildAssets(sourceGuildId)
      .catch((error) => active && setImportStatus(error instanceof Error ? error.message : "Could not read server assets."))
      .finally(() => active && setAssetsLoading(false));
    return () => { active = false; };
  }, [sourceGuildId, loadGuildAssets]);

  const visibleItems = useMemo(() => items.filter((item) => `${item.name} ${item.assetType}`.toLowerCase().includes(search.trim().toLowerCase())), [items, search]);
  const audienceConfirmed = audience === "adult" ? adultConfirmed : generalConfirmed;

  async function changeCatalog(action: string, extra: Record<string, unknown>) {
    if (!sourceGuildId) throw new Error("Choose a server first.");
    const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: sourceGuildId, action, audience, ...extra }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) {
      const error = new Error(body?.error || "JED catalog operation failed.") as Error & { verificationUrl?: string };
      if (typeof body?.verificationUrl === "string") error.verificationUrl = body.verificationUrl;
      throw error;
    }
    return body;
  }

  async function publishAsset(asset: Asset) {
    setBusy(`publish:${asset.id}`); setMessage(""); setVerificationUrl("");
    try {
      await changeCatalog(asset.published ? "withdraw" : "publish", asset.published
        ? { assetId: asset.id }
        : { assetId: asset.id, assetType: asset.assetType, name: asset.name, rightsConfirmed, generalAudienceConfirmed: audience === "general" && generalConfirmed, adultAudienceConfirmed: audience === "adult" && adultConfirmed });
      setMessage(asset.published ? `${asset.name} was removed from the public library.` : `${asset.name} was added to the public library.`);
      await Promise.all([loadCatalog(), loadGuildAssets(sourceGuildId)]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update the listing."); setVerificationUrl(String((error as Error & { verificationUrl?: string })?.verificationUrl || "")); }
    finally { setBusy(""); }
  }

  async function publishGif() {
    setBusy("publish-gif"); setMessage(""); setVerificationUrl("");
    try {
      await changeCatalog("publish", { assetType: "gif", name, url: gifUrl, rightsConfirmed, generalAudienceConfirmed: audience === "general" && generalConfirmed, adultAudienceConfirmed: audience === "adult" && adultConfirmed });
      setGifUrl(""); setName(""); setMessage("GIF added to the public JED library."); await loadCatalog();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add the GIF."); setVerificationUrl(String((error as Error & { verificationUrl?: string })?.verificationUrl || "")); }
    finally { setBusy(""); }
  }

  async function publishPersonalItem(item: PersonalItem) {
    if (!publishingEnabled) { setMessage("Public JED submissions are currently closed."); return; }
    if (!sourceGuildId) { setMessage("Choose a server to submit the asset from."); return; }
    if (!rightsConfirmed || !audienceConfirmed) { setMessage(audience === "adult" ? "Confirm permission to share the asset and mark it as adult-only." : "Confirm permission to share the asset and that it is appropriate for all ages."); return; }
    setBusy(`personal-publish:${item.id}`); setMessage(""); setVerificationUrl("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish-personal", guildId: sourceGuildId, itemId: item.id, rightsConfirmed, audience, generalAudienceConfirmed: audience === "general" && generalConfirmed, adultAudienceConfirmed: audience === "adult" && adultConfirmed }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) {
        const error = new Error(body?.error || "Could not submit this asset.") as Error & { verificationUrl?: string };
        if (typeof body?.verificationUrl === "string") error.verificationUrl = body.verificationUrl;
        throw error;
      }
      setPersonalItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, publicListingStatus: body.status || "pending_review" } : entry));
      setMessage(`“${item.name}” was submitted for public review. It will appear in the library after approval.`);
      await loadCatalog(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit this asset."); setVerificationUrl(String((error as Error & { verificationUrl?: string })?.verificationUrl || "")); }
    finally { setBusy(""); }
  }

  async function exportItem(item: CatalogItem) {
    if (!targetGuildId) { setMessage("Choose the destination Discord server."); return; }
    if (!window.confirm(`Use JED to add “${item.name}” as a ${targetType} in ${guildName(targetGuildId)}? Possum Bot and your Discord account need Manage Expressions in that server.`)) return;
    setBusy(`export:${item.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: targetGuildId, action: "export", itemId: item.id, target: targetType, audience, rightsConfirmed: true }) });
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
    if (!sourceGuildId) { setImportStatus("Choose the source server first."); return; }
    if (!personalRightsConfirmed) { setImportStatus("Check the permission box above to enable this private import."); return; }
    if (assetsLoading) { setImportStatus("Wait for the selected server's assets to finish loading."); return; }
    if (!assets.length) { setImportStatus("No supported custom emojis or PNG/APNG/GIF stickers were found in this server."); return; }
    setBusy("import-all"); setMessage(""); setImportStatus(`Importing ${assets.length} assets from ${guildName(sourceGuildId)}…`);
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-all", guildId: sourceGuildId, rightsConfirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not import server assets.");
      setPersonalItems(Array.isArray(body.items) ? body.items : []);
      setNameDrafts(Object.fromEntries((Array.isArray(body.items) ? body.items as PersonalItem[] : []).map((item) => [item.id, item.name])));
      setPersonalRightsConfirmed(false);
      const skipped = Number(body.skipped) || Math.max(0, Number(body.total) - Number(body.added));
      const resultMessage = `Imported ${body.added} new assets from ${guildName(sourceGuildId)}; ${skipped} invalid or already-saved assets were skipped.`;
      setImportStatus(resultMessage); setMessage(resultMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not import server assets.";
      setImportStatus(errorMessage); setMessage(errorMessage);
    } finally { setBusy(""); }
  }

  async function importDiscordLinks() {
    if (!linkedRightsConfirmed) { setImportStatus("Confirm that you made these assets or have permission to save them."); return; }
    const linkedAssets = parseDiscordAssetLinks(linkedAssetText);
    if (!linkedAssets.length) { setImportStatus("Paste custom emoji markup such as <:name:id> or direct Discord emoji/sticker CDN links."); return; }
    setBusy("import-links"); setImportStatus(`Saving ${linkedAssets.length} Discord asset link${linkedAssets.length === 1 ? "" : "s"} to your private collection…`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-linked-personal", rightsConfirmed: true, assets: linkedAssets }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not import those Discord assets.");
      const next = Array.isArray(body.items) ? body.items as PersonalItem[] : [];
      setPersonalItems(next);
      setNameDrafts(Object.fromEntries(next.map((item) => [item.id, item.name])));
      setLinkedAssetText("");
      const details = Array.isArray(body.errors) && body.errors.length ? ` Some could not be fetched: ${body.errors.join("; ")}` : "";
      const result = `Saved ${Number(body.added) || 0} new asset${Number(body.added) === 1 ? "" : "s"}; ${Number(body.skipped) || 0} duplicate or unavailable link${Number(body.skipped) === 1 ? "" : "s"} skipped.${details}`;
      setImportStatus(result); setMessage(result);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not import those Discord assets.";
      setImportStatus(text); setMessage(text);
    } finally { setBusy(""); }
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
    if (!window.confirm(`Remove “${item.name}” from your private dashboard collection? Any public submission will also be withdrawn.`)) return;
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

  async function withdrawPersonalItem(item: PersonalItem) {
    if (!window.confirm(`Withdraw “${item.name}” from the public JED library?`)) return;
    setBusy(`personal-withdraw:${item.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw-personal", itemId: item.id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not withdraw this public submission.");
      setPersonalItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, publicListingStatus: "withdrawn" } : entry));
      setMessage(`“${item.name}” was withdrawn from the public JED library.`);
      await loadCatalog(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not withdraw this public submission."); }
    finally { setBusy(""); }
  }

  async function renamePersonalItem(item: PersonalItem) {
    const nextName = String(nameDrafts[item.id] || "").trim();
    setBusy(`personal-rename:${item.id}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename-personal", itemId: item.id, name: nextName }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not save this asset name.");
      setPersonalItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, name: body.item?.name || nextName } : entry));
      setNameDrafts((previous) => ({ ...previous, [item.id]: body.item?.name || nextName }));
      setMessage(`Saved the name “${body.item?.name || nextName}”.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this asset name."); }
    finally { setBusy(""); }
  }

  async function uploadPersonalAsset() {
    if (!uploadFile || !uploadRightsConfirmed) { setMessage("Choose an image and confirm you are allowed to keep it in your private collection."); return; }
    if (uploadFile.size < 1 || uploadFile.size > 5 * 1024 * 1024) { setMessage("Choose a PNG, JPEG, WebP, or GIF under 5 MiB."); return; }
    setBusy("personal-upload"); setMessage("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read that image."));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read that image."));
        reader.readAsDataURL(uploadFile);
      });
      const contentBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload-personal", name: uploadName, assetType: uploadType, contentBase64, rightsConfirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not upload this private asset.");
      setUploadFile(null); setUploadName(""); setUploadRightsConfirmed(false);
      await loadPersonalItems();
      setMessage(`Saved “${body.item?.name || uploadName}” in your private JED collection.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not upload this private asset."); }
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

        {message ? <div role="status" style={panel}>{message}{verificationUrl ? <p><a href={verificationUrl} target="_blank" rel="noreferrer" style={{ color: "#ff9ebc" }}>Complete the k-ID check</a></p> : null}</div> : null}
        {!publishingEnabled ? <div style={panel}>New shared public submissions are disabled. Existing approved items remain available; use the private collection below for your server assets.</div> : null}

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>Browse the public library</h2>
          <div role="group" aria-label="Catalog audience" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" aria-pressed={audience === "general"} style={{ ...button, background: audience === "general" ? "#a7003e" : "#260b18" }} onClick={() => setAudience("general")}>SFW · All ages</button>
            <button type="button" aria-pressed={audience === "adult"} style={{ ...button, background: audience === "adult" ? "#a7003e" : "#260b18" }} onClick={() => setAudience("adult")}>18+ · NSFW</button>
          </div>
          {audience === "adult" ? <p style={muted}>The 18+ shelf is separate from all-ages assets and requires k-ID&apos;s mature-language permission for the signed-in account. The SFW shelf stays open. Publishing assets for others also requires the mods permission. Enable 18+ catalog submissions in the selected server&apos;s JED settings, then complete the AgeKey check in Adult Emote Studio. <a href="/dashboard/jed/adult-emotes" style={{ color: "#ff9ebc" }}>Open Adult Emote Studio</a> · <a href="/dashboard/security/age-assurance" style={{ color: "#ff9ebc" }}>Set up AgeKey</a></p> : null}
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
              <img src={catalogImageUrl(item, targetGuildId)} alt={item.name} loading="lazy" referrerPolicy="no-referrer" style={{ display: "block", width: "100%", height: 132, objectFit: "contain", background: "#10000b", borderRadius: 10 }} />
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
              <img src={catalogImageUrl(item, targetGuildId)} alt={item.name} loading="lazy" referrerPolicy="no-referrer" style={{ display: "block", width: "100%", height: 120, objectFit: "contain", background: "#10000b", borderRadius: 10 }} />
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
            <p style={muted}>This is about permission to reuse, not trademark registration. Being visible on Discord or the internet alone does not grant permission to republish someone else&apos;s work.</p>
            <label style={muted}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> I made this asset or its creator/license allows me to share it publicly.</label>
            {audience === "general" ? <label style={muted}><input type="checkbox" checked={generalConfirmed} onChange={(event) => setGeneralConfirmed(event.target.checked)} /> This is suitable for all ages and is not adult or restricted content.</label> : <label style={muted}><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} /> This is adult/NSFW content and belongs only in the 18+ library.</label>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
            {assets.map((asset) => <article key={asset.id} style={{ ...panel, padding: 12 }}>
              <img src={asset.url} alt={asset.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 104, objectFit: "contain", background: "#10000b", borderRadius: 8 }} />
              <strong style={{ display: "block", marginTop: 8, overflowWrap: "anywhere" }}>{asset.name}</strong>
              <div style={muted}>{asset.assetType}{asset.animated ? " · Animated" : ""}</div>
              <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={Boolean(busy) || (!asset.published && !(rightsConfirmed && audienceConfirmed))} onClick={() => void publishAsset(asset)}>
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
              <button type="button" style={button} disabled={Boolean(busy) || !sourceGuildId || !name.trim() || !gifUrl.trim() || !(rightsConfirmed && audienceConfirmed)} onClick={() => void publishGif()}>{busy === "publish-gif" ? "Adding…" : `Submit GIF to ${audience === "adult" ? "18+" : "all-ages"} review`}</button>
            </div>
          </div>
        </section> : null}

        {signedIn ? <section id="private-collection" style={panel}>
          <h2 style={{ marginTop: 0 }}>My private server collection</h2>
          <p style={muted}>This collection is private to your Discord account. Importing adds to your existing items and preserves names you have customized. A Discord server has expressions rather than a built-in GIF library; save GIFs and other media here by upload or with JED from a link or message attachment.</p>
          <section style={{ ...panel, marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Create an asset from your own file</h3>
            <p style={muted}>Upload a PNG, JPEG, WebP, or GIF up to 5 MiB. JED stores the original privately and converts it to Discord&apos;s supported emoji or sticker size when you add it to a server.</p>
            <div style={{ display: "grid", gap: 10, maxWidth: 640 }}>
              <label style={muted}>Asset name<br /><input style={input} maxLength={32} value={uploadName} onChange={(event) => setUploadName(event.target.value)} placeholder="my_asset" /></label>
              <label style={muted}>Asset type<br /><select style={input} value={uploadType} onChange={(event) => setUploadType(event.target.value as "emoji" | "sticker" | "gif")}><option value="emoji">Emoji</option><option value="sticker">Sticker</option><option value="gif">GIF / animated source</option></select></label>
              <label style={muted}>Image file<br /><input key={uploadFile?.name || "empty"} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} /></label>
              <label style={muted}><input type="checkbox" checked={uploadRightsConfirmed} onChange={(event) => setUploadRightsConfirmed(event.target.checked)} /> I made this asset or have permission to save and use it in my private collection.</label>
              <button type="button" style={button} disabled={!uploadFile || !uploadName.trim() || !uploadRightsConfirmed || Boolean(busy)} onClick={() => void uploadPersonalAsset()}>{busy === "personal-upload" ? "Saving…" : "Upload to my private JED collection"}</button>
            </div>
          </section>
          <h3>Import from a server without adding Possum Bot</h3>
          <p style={muted}>Discord does not let a website enumerate a member&apos;s server emoji lists. For a server that does not have Possum Bot, paste copied custom emoji markup, a Discord sticker share link, or a direct Discord CDN link below. JED downloads supported PNG, GIF, and WebP assets into your private collection; it does not need access to the source server.</p>
          <label style={{ ...muted, display: "block" }}>Discord emoji mentions, sticker links, or CDN links (one or more)<br /><textarea style={{ ...input, display: "block", minHeight: 100, maxWidth: 760, resize: "vertical" }} value={linkedAssetText} onChange={(event) => setLinkedAssetText(event.target.value)} placeholder={"<:possum:123456789012345678>\nhttps://discord.com/stickers/123456789012345678\nhttps://cdn.discordapp.com/emojis/123456789012345678.png"} /></label>
          <p style={muted}><label><input type="checkbox" checked={linkedRightsConfirmed} onChange={(event) => setLinkedRightsConfirmed(event.target.checked)} /> I made these assets or have permission to keep them in my private collection.</label></p>
          <button type="button" style={button} disabled={Boolean(busy) || !linkedAssetText.trim() || !linkedRightsConfirmed} onClick={() => void importDiscordLinks()}>
            {busy === "import-links" ? "Saving Discord assets…" : "Save linked assets to my collection"}
          </button>
          <h3>Import expressions from a Discord server with Possum Bot installed</h3>
          <p style={muted}>Import every supported custom emoji and PNG/APNG/GIF sticker from a server you manage. This appends items and never removes existing roles, expressions, or saved assets.</p>
          <label style={{ ...muted, display: "block" }}>Source server<br /><select style={input} value={sourceGuildId} onChange={(event) => setSourceGuildId(event.target.value)}>
            <option value="">Choose a source server</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
          </select></label>
          <p style={muted}><label><input type="checkbox" checked={personalRightsConfirmed} onChange={(event) => setPersonalRightsConfirmed(event.target.checked)} /> I made these assets or have permission to save and use them in the servers I manage.</label></p>
          <button type="button" style={button} disabled={Boolean(busy) || assetsLoading} onClick={() => void importAllAssets()}>
            {assetsLoading ? "Loading server assets…" : busy === "import-all" ? "Importing server assets…" : `Import all ${assets.length} listed assets`}
          </button>
          {importStatus ? <p role="status" aria-live="polite" style={{ ...muted, marginTop: 8 }}>{importStatus}</p> : null}
          <h3>Saved assets ({personalItems.length})</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {personalItems.map((item) => <article key={item.id} style={{ ...panel, padding: 12 }}>
              <img src={item.uploaded ? `/api/jed-catalog?assetId=${encodeURIComponent(item.id)}` : item.url} alt={item.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 104, objectFit: "contain", background: "#10000b", borderRadius: 8 }} />
              <label style={{ ...muted, display: "block", marginTop: 8 }}>Name<br /><input style={input} maxLength={32} value={nameDrafts[item.id] ?? item.name} onChange={(event) => setNameDrafts((previous) => ({ ...previous, [item.id]: event.target.value }))} /></label>
              <div style={muted}>{item.assetType}{item.animated ? " · Animated" : ""} · {item.sourceGuildName}</div>
              {item.publicListingStatus === "pending_review" ? <div style={muted}>Public listing: awaiting review</div> : item.publicListingStatus === "published" ? <div style={muted}>Public listing: published</div> : null}
              <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={Boolean(busy) || (nameDrafts[item.id] ?? item.name) === item.name} onClick={() => void renamePersonalItem(item)}>{busy === `personal-rename:${item.id}` ? "Saving…" : "Save name"}</button>
              <button type="button" style={{ ...button, width: "100%", marginTop: 8 }} disabled={!targetGuildId || Boolean(busy)} onClick={() => void exportPersonalItem(item)}>
                {busy === `personal-export:${item.id}` ? "Using JED…" : `Add to ${guildName(targetGuildId)}`}
              </button>
              {publishingEnabled && item.uploaded ? <button type="button" style={{ ...button, width: "100%", marginTop: 8, background: "#51203a" }} disabled={!sourceGuildId || !rightsConfirmed || !audienceConfirmed || Boolean(busy)} onClick={() => void publishPersonalItem(item)}>
                {busy === `personal-publish:${item.id}` ? "Submitting…" : "Submit to public library for review"}
              </button> : null}
              {item.uploaded && ["published", "pending_review"].includes(item.publicListingStatus || "") ? <button type="button" style={{ ...button, width: "100%", marginTop: 8, background: "#421328" }} disabled={Boolean(busy)} onClick={() => void withdrawPersonalItem(item)}>
                {busy === `personal-withdraw:${item.id}` ? "Withdrawing…" : "Withdraw from public library"}
              </button> : null}
              <button type="button" style={{ ...button, width: "100%", marginTop: 8, background: "#421328" }} disabled={Boolean(busy)} onClick={() => void removePersonalItem(item)}>
                {busy === `personal-remove:${item.id}` ? "Removing…" : "Remove"}
              </button>
            </article>)}
          </div>
          {!personalItems.length ? <p style={muted}>Your private collection is empty.</p> : null}
        </section> : null}

      </div>
    </main>
  );
}
