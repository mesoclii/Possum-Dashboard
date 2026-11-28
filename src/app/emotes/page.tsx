"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

type Guild = { id: string; name: string; iconUrl?: string | null; owner?: boolean; manageable?: boolean; botPresent?: boolean };
type Asset = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; published?: boolean; inVault?: boolean; sourceGuildId?: string; sourceGuildName?: string };
type CatalogItem = { id: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; publishedAt: string; useCount: number; tags?: string[] };
type PendingCatalogItem = { id: string; sourceGuildId: string; sourceGuildName: string; name: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; url: string; submittedAt: string };
type PersonalItem = { id: string; sourceGuildId: string; sourceGuildName: string; sourceAssetId: string; name: string; originalName?: string; assetType: "emoji" | "sticker" | "gif"; animated: boolean; uploaded?: boolean; downloadName?: string; url: string; importedAt: string; collection?: string; favorite?: boolean; tags?: string[]; contentRating?: "unreviewed" | "general" | "adult"; sources?: Array<{ guildId?: string; guildName?: string; assetId?: string; url?: string }>; sha256?: string; visualFingerprint?: string; fileBytes?: number };
type PersonalCollection = { name: string; description: string; visibility: "private"; assetCount: number; createdAt?: string; updatedAt?: string };
type PersonalStats = { total: number; uploaded: number; animated: number; favorites: number; unreviewed: number; bytes: number; sources: number };
type ImportJob = { id: string; guildId: string; guildName: string; collection?: string; status: string; total: number; processed: number; added: number; skipped: number; errors: string[]; error: string; retryable?: boolean; createdAt: string; updatedAt: string };

const shell: CSSProperties = { minHeight: "100vh", padding: "clamp(18px, 4vw, 48px)", color: "#ffe4ee", background: "radial-gradient(ellipse at 85% 0%, #5b082e 0%, transparent 36%), radial-gradient(ellipse at 0% 40%, #3b071f 0%, transparent 40%), #10000b" };
const panel: CSSProperties = { border: "1px solid #8a2450", borderRadius: 18, padding: 20, background: "linear-gradient(145deg, rgba(55,5,29,.95), rgba(18,0,12,.97))", boxShadow: "0 12px 32px rgba(0,0,0,.22)" };
const input: CSSProperties = { width: "100%", maxWidth: 480, padding: "10px 12px", border: "1px solid #8a2450", borderRadius: 9, color: "#fff", background: "#16000b" };
const button: CSSProperties = { padding: "10px 15px", borderRadius: 9, border: "1px solid #ff2e75", color: "#fff", background: "#a7003e", cursor: "pointer", fontWeight: 750 };
const muted: CSSProperties = { color: "#efb4c9", lineHeight: 1.65 };
const accent: CSSProperties = { color: "#ff75aa" };
const cardGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gap: 14 };

type JedView = "discover" | "explorer" | "vault" | "public" | "import" | "review";
type JedFilter = "all" | "favorites" | "animated" | "recent" | "multi-source" | "needs-review";
type AccessTier = { key: "full" | "member" | "installable" | "restricted"; label: string; tone: string };

// How much Emoji Explorer can do with a server, from the viewer's Discord
// membership and whether Possum Bot is installed there.
function accessTier(guild: Guild): AccessTier {
  if (guild.botPresent && guild.manageable) return { key: "full", label: "Bot installed · You manage this server", tone: "#4fd18b" };
  if (guild.botPresent) return { key: "member", label: "Bot installed · Emojis available", tone: "#4fd18b" };
  if (guild.manageable) return { key: "installable", label: "Bot not installed · You can add it", tone: "#ffc65c" };
  return { key: "restricted", label: "Bot not installed · An admin must add it", tone: "#ff7a9c" };
}
const TIER_ORDER: Record<AccessTier["key"], number> = { full: 0, member: 1, installable: 2, restricted: 3 };
const ACTIVE_JOB_STATES = ["queued", "running", "cancel_requested"];
const PUBLIC_PAGE_SIZE = 24;
const PRIVATE_PAGE_SIZE = 60;
const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

function fingerprintDistance(left: string, right: string): number {
  if (!/^[0-9a-f]{16}$/i.test(left) || !/^[0-9a-f]{16}$/i.test(right)) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    distance += NIBBLE_BITS[parseInt(left[index], 16) ^ parseInt(right[index], 16)];
  }
  return distance;
}

export default function EmoteLibraryPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingCatalogItem[]>([]);
  const [isCatalogReviewer, setIsCatalogReviewer] = useState(false);
  const [publishingEnabled, setPublishingEnabled] = useState(false);
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
  const [personalCollections, setPersonalCollections] = useState<PersonalCollection[]>([]);
  const [personalStats, setPersonalStats] = useState<PersonalStats>({ total: 0, uploaded: 0, animated: 0, favorites: 0, unreviewed: 0, bytes: 0, sources: 0 });
  const [personalTotal, setPersonalTotal] = useState(0);
  const [personalPage, setPersonalPage] = useState(0);
  const [personalSort, setPersonalSort] = useState<"recent" | "oldest" | "name" | "favorites">("recent");
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
  const [linkedAssetType, setLinkedAssetType] = useState<"emoji" | "sticker" | "gif">("emoji");
  const [uploadName, setUploadName] = useState("");
  const [uploadAssetType, setUploadAssetType] = useState<"emoji" | "sticker" | "gif">("emoji");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [generalConfirmed, setGeneralConfirmed] = useState(false);
  const [personalRightsConfirmed, setPersonalRightsConfirmed] = useState(false);
  const [targetType, setTargetType] = useState<"emoji" | "sticker">("emoji");
  const [search, setSearch] = useState("");
  const [publicTypeFilter, setPublicTypeFilter] = useState("all");
  const [publicSortFilter, setPublicSortFilter] = useState<"recent" | "popular">("recent");
  const [publicPage, setPublicPage] = useState(0);
  const [publicTotal, setPublicTotal] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<JedView>("discover");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [assetSearch, setAssetSearch] = useState("");
  const [personalSearch, setPersonalSearch] = useState("");
  const [personalTypeFilter, setPersonalTypeFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [smartFilter, setSmartFilter] = useState<JedFilter>("all");
  const [selectedPersonal, setSelectedPersonal] = useState<string[]>([]);
  const [bulkCollection, setBulkCollection] = useState("");
  const [manageCollectionName, setManageCollectionName] = useState("");
  const [renamedCollection, setRenamedCollection] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [detailsId, setDetailsId] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const [similarTo, setSimilarTo] = useState("");
  const [vaultHealth, setVaultHealth] = useState<{ missingFiles: number; integrityMismatches: number } | null>(null);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerGuildId, setExplorerGuildId] = useState("");
  const [explorerAssets, setExplorerAssets] = useState<Asset[]>([]);
  const [explorerAssetSearch, setExplorerAssetSearch] = useState("");
  const [explorerSelected, setExplorerSelected] = useState<string[]>([]);
  const [explorerCollection, setExplorerCollection] = useState("");
  const [explorerStatus, setExplorerStatus] = useState("");
  const [leaveConfirmName, setLeaveConfirmName] = useState("");
  const explorerRequestId = useRef(0);
  const explorerHadActiveJob = useRef(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const catalogRequestId = useRef(0);
  const personalRequestId = useRef(0);
  const importWasActive = useRef(false);

  const guildName = (id: string) => guilds.find((entry) => entry.id === id)?.name || id;

  const loadCatalog = useCallback(async (includeReview = signedIn, options: { query?: string; type?: string; sort?: "recent" | "popular"; limit?: number; offset?: number } = {}) => {
    const requestId = ++catalogRequestId.current;
    const params = new URLSearchParams();
    if (includeReview) params.set("review", "1");
    if (options.query) params.set("q", options.query.slice(0, 80));
    if (options.type && options.type !== "all") params.set("type", options.type);
    if (options.sort === "popular") params.set("sort", options.sort);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    const response = await fetch(`/api/jed-catalog${params.size ? `?${params}` : ""}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (requestId !== catalogRequestId.current) return;
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "The public JED library is unavailable.");
    setItems(Array.isArray(body.items) ? body.items : []);
    setPublicTotal(Number.isFinite(Number(body.total)) ? Number(body.total) : 0);
    setPublishingEnabled(body.publishingEnabled === true);
    setIsCatalogReviewer(body.reviewer === true);
    setPendingItems(body.reviewer === true && Array.isArray(body.pending) ? body.pending : []);
  }, [signedIn]);

  useEffect(() => {
    if (view !== "public") return;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void loadCatalog(signedIn, { query: search.trim(), type: publicTypeFilter, sort: publicSortFilter, limit: PUBLIC_PAGE_SIZE, offset: publicPage * PUBLIC_PAGE_SIZE })
        .catch((error) => setMessage(error instanceof Error ? error.message : "The public JED library is unavailable."))
        .finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [view, signedIn, search, publicTypeFilter, publicSortFilter, publicPage, loadCatalog]);

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

  const personalQuery = useMemo(() => ({
    query: personalSearch.trim(),
    type: personalTypeFilter,
    collection: collectionFilter,
    smart: smartFilter,
    similarTo,
    sort: personalSort,
    limit: PRIVATE_PAGE_SIZE,
    offset: personalPage * PRIVATE_PAGE_SIZE,
  }), [personalSearch, personalTypeFilter, collectionFilter, smartFilter, similarTo, personalSort, personalPage]);
  const personalQueryRef = useRef(personalQuery);
  personalQueryRef.current = personalQuery;

  const loadPersonalItems = useCallback(async (options: Partial<typeof personalQuery> = {}) => {
    const requestId = ++personalRequestId.current;
    const params = new URLSearchParams({ collection: "1" });
    if (options.query) params.set("q", options.query);
    if (options.type && options.type !== "all") params.set("type", options.type);
    if (options.collection && options.collection !== "all") params.set("collectionName", options.collection);
    if (options.smart && options.smart !== "all") params.set("smart", options.smart);
    if (options.similarTo) params.set("similarTo", options.similarTo);
    if (options.sort) params.set("sort", options.sort);
    params.set("limit", String(options.limit || PRIVATE_PAGE_SIZE));
    params.set("offset", String(options.offset || 0));
    const response = await fetch(`/api/jed-catalog?${params}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "Your private JED collection is unavailable.");
    if (requestId !== personalRequestId.current) return;
    setPersonalItems(Array.isArray(body.items) ? body.items : []);
    setPersonalCollections(Array.isArray(body.collections) ? body.collections : []);
    setPersonalStats(body.stats && typeof body.stats === "object" ? body.stats : { total: Number(body.total) || 0, uploaded: 0, animated: 0, favorites: 0, unreviewed: 0, bytes: 0, sources: 0 });
    setPersonalTotal(Number.isFinite(Number(body.total)) ? Number(body.total) : 0);
  }, []);

  const loadImportJobs = useCallback(async () => {
    const response = await fetch("/api/jed-catalog?importJobs=1", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success !== true) throw new Error(body?.error || "JED import queue is unavailable.");
    const next = Array.isArray(body.jobs) ? body.jobs as ImportJob[] : [];
    const active = next.some((job) => ["queued", "running", "cancel_requested"].includes(job.status));
    if (importWasActive.current && !active) void loadPersonalItems(personalQueryRef.current).catch(() => undefined);
    importWasActive.current = active;
    setImportJobs(next);
  }, [loadPersonalItems]);

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
        void loadPersonalItems({ limit: PRIVATE_PAGE_SIZE, offset: 0 }).catch((error) => active && setMessage(error instanceof Error ? error.message : "Private collection unavailable."));
        void loadImportJobs().catch((error) => active && setMessage(error instanceof Error ? error.message : "JED import queue unavailable."));
        const [manageableResponse, installedResponse] = await Promise.all([
          fetch("/api/guilds?includeAll=1", { cache: "no-store" }), fetch("/api/guilds/installed", { cache: "no-store" }),
        ]);
        const [manageable, installed] = await Promise.all([manageableResponse.json(), installedResponse.json()]);
        if (!manageableResponse.ok || !manageable?.loggedIn || !installedResponse.ok || installed?.success !== true) throw new Error("Could not load your Discord servers.");
        const botGuilds = new Set((Array.isArray(installed.guilds) ? installed.guilds : []).filter((entry: Guild) => entry?.botPresent !== false).map((entry: Guild) => entry.id));
        const options: Guild[] = (Array.isArray(manageable.guilds) ? manageable.guilds : [])
          .filter((entry: Guild) => typeof entry?.id === "string")
          .map((entry: Guild) => ({ id: entry.id, name: entry.name, iconUrl: typeof entry.iconUrl === "string" ? entry.iconUrl : null, owner: entry.owner, manageable: entry.manageable === true, botPresent: botGuilds.has(entry.id) }));
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
  }, [loadCatalog, loadGuildAssets, loadPersonalItems, loadImportJobs]);

  useEffect(() => {
    if (!signedIn || view !== "vault") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void loadPersonalItems(personalQuery).catch((error) => active && setMessage(error instanceof Error ? error.message : "Private collection unavailable."));
    }, 120);
    return () => { active = false; window.clearTimeout(timer); };
  }, [signedIn, view, personalQuery, loadPersonalItems]);

  const openExplorerGuild = useCallback(async (guildId: string, botPresent: boolean, keepSelection = false) => {
    const requestId = ++explorerRequestId.current;
    setExplorerGuildId(guildId);
    if (!keepSelection) { setExplorerSelected([]); setExplorerAssets([]); setExplorerAssetSearch(""); setLeaveConfirmName(""); }
    if (!botPresent) { setExplorerStatus(""); return; }
    if (!keepSelection) setExplorerStatus("Reading this server's emojis and stickers…");
    try {
      const loaded = await loadGuildAssets(guildId);
      if (requestId !== explorerRequestId.current) return;
      setExplorerAssets(loaded);
      setExplorerStatus(loaded.length ? "" : "This server has no emojis or supported stickers.");
    } catch (error) {
      if (requestId === explorerRequestId.current) setExplorerStatus(error instanceof Error ? error.message : "Could not read that server's assets.");
    }
  }, [loadGuildAssets]);

  const explorerJob = useMemo(() => importJobs.find((job) => job.guildId === explorerGuildId), [importJobs, explorerGuildId]);
  const explorerJobActive = Boolean(explorerJob && ACTIVE_JOB_STATES.includes(explorerJob.status));

  // When an Explorer import finishes, refresh the "In vault" badges.
  useEffect(() => {
    if (explorerHadActiveJob.current && !explorerJobActive && explorerGuildId) void openExplorerGuild(explorerGuildId, true, true);
    explorerHadActiveJob.current = explorerJobActive;
  }, [explorerJobActive, explorerGuildId, openExplorerGuild]);

  useEffect(() => {
    if (!signedIn || !(view === "import" || (view === "explorer" && explorerJobActive))) return;
    let active = true;
    const refresh = () => { if (active) void loadImportJobs().catch((error) => setMessage(error instanceof Error ? error.message : "JED import queue unavailable.")); };
    refresh();
    const timer = window.setInterval(refresh, 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [signedIn, view, explorerJobActive, loadImportJobs]);

  const readableGuilds = useMemo(() => guilds.filter((guild) => guild.botPresent), [guilds]);
  const destinationGuilds = useMemo(() => guilds.filter((guild) => guild.botPresent && guild.manageable), [guilds]);
  const selectedSourceGuild = guilds.find((guild) => guild.id === sourceGuildId);
  const explorerGuild = guilds.find((guild) => guild.id === explorerGuildId);
  const explorerGuilds = useMemo(() => {
    const needle = explorerSearch.trim().toLowerCase();
    return guilds.filter((guild) => !needle || guild.name.toLowerCase().includes(needle))
      .sort((a, b) => TIER_ORDER[accessTier(a).key] - TIER_ORDER[accessTier(b).key] || a.name.localeCompare(b.name));
  }, [guilds, explorerSearch]);
  const tierCounts = useMemo(() => guilds.reduce((counts, guild) => {
    counts[accessTier(guild).key] += 1;
    return counts;
  }, { full: 0, member: 0, installable: 0, restricted: 0 } as Record<AccessTier["key"], number>), [guilds]);
  const visibleExplorerAssets = useMemo(() => {
    const needle = explorerAssetSearch.trim().toLowerCase();
    return explorerAssets.filter((asset) => !needle || asset.name.toLowerCase().includes(needle));
  }, [explorerAssets, explorerAssetSearch]);
  const visibleGuildAssets = useMemo(() => sourceGuildId === "all" ? assets : assets.filter((asset) => asset.sourceGuildId === sourceGuildId), [assets, sourceGuildId]);

  const visibleItems = useMemo(() => items.filter((item) => `${item.name} ${item.assetType}`.toLowerCase().includes(search.trim().toLowerCase())), [items, search]);
  const filteredGuildAssets = useMemo(() => visibleGuildAssets.filter((asset) =>
    (assetTypeFilter === "all" || asset.assetType === assetTypeFilter) &&
    `${asset.name} ${asset.assetType} ${asset.sourceGuildName}`.toLowerCase().includes(assetSearch.trim().toLowerCase())),
  [visibleGuildAssets, assetTypeFilter, assetSearch]);
  const collections = useMemo(() => {
    const names = new Set(personalCollections.map((collection) => collection.name));
    for (const item of personalItems) names.add(String(item.collection || "Inbox"));
    return [...names].sort((a, b) => a === "Inbox" ? -1 : b === "Inbox" ? 1 : a.localeCompare(b));
  }, [personalCollections, personalItems]);
  const filteredPersonalItems = useMemo(() => {
    const needle = personalSearch.trim().toLowerCase();
    const selected = similarTo ? personalItems.find((item) => item.id === similarTo) : undefined;
    return personalItems.filter((item) => {
      const sourceNames = (Array.isArray(item.sources) ? item.sources : []).map((source) => source.guildName || "").join(" ");
      const text = `${item.name} ${item.originalName || ""} ${item.assetType} ${item.sourceGuildName || ""} ${sourceNames} ${(item.tags || []).join(" ")}`.toLowerCase();
      const matchesText = !needle || text.includes(needle);
      const matchesType = personalTypeFilter === "all" || item.assetType === personalTypeFilter;
      const matchesCollection = collectionFilter === "all" || String(item.collection || "Inbox") === collectionFilter;
      const matchesSmart = smartFilter === "all" ||
        (smartFilter === "favorites" && item.favorite === true) ||
        (smartFilter === "animated" && item.animated === true) ||
        (smartFilter === "multi-source" && Array.isArray(item.sources) && item.sources.length > 1) ||
        (smartFilter === "needs-review" && (!item.contentRating || item.contentRating === "unreviewed")) ||
        (smartFilter === "recent" && Date.now() - new Date(item.importedAt).getTime() < 7 * 24 * 60 * 60 * 1000);
      const matchesSimilar = !selected || (item.id !== selected.id && fingerprintDistance(item.visualFingerprint || "", selected.visualFingerprint || "") <= 12);
      return matchesText && matchesType && matchesCollection && matchesSmart && matchesSimilar;
    });
  }, [personalItems, personalSearch, personalTypeFilter, collectionFilter, smartFilter, similarTo]);
  const vaultStats = personalStats;

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
      await loadCatalog(signedIn, { query: search.trim(), type: publicTypeFilter, sort: publicSortFilter, limit: PUBLIC_PAGE_SIZE, offset: publicPage * PUBLIC_PAGE_SIZE });
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
      const queued: ImportJob[] = [];
      const failures: string[] = [];
      for (let index = 0; index < selectedGuilds.length; index += 1) {
        const guild = selectedGuilds[index];
        setImportProgress(`Scanning ${guild.name} · ${index + 1} of ${selectedGuilds.length}`);
        const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start-import", guildId: guild.id, rightsConfirmed: true }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body?.success !== true) {
          failures.push(`${guild.name}${body?.error ? ` (${body.error})` : ""}`);
          continue;
        }
        if (body.job) queued.push(body.job as ImportJob);
      }
      if (queued.length) {
        setImportJobs((current) => [...queued, ...current.filter((job) => !queued.some((entry) => entry.id === job.id))]);
        importWasActive.current = true;
      }
      setPersonalRightsConfirmed(false);
      setImportProgress("");
      setView("import");
      await loadImportJobs();
      setMessage(`Queued ${queued.length} server import${queued.length === 1 ? "" : "s"}. JED will save assets in resumable batches.${failures.length ? ` Could not queue: ${failures.join(", ")}.` : ""}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not queue server assets."); }
    finally { setBusy(""); setImportProgress(""); }
  }

  async function updateImportJob(jobId: string, action: "cancel-import" | "retry-import") {
    setBusy(`job:${jobId}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, jobId }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not update this import.");
      await loadImportJobs();
      setMessage(action === "cancel-import" ? "Import cancellation requested." : "Import queued to resume.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update import."); }
    finally { setBusy(""); }
  }

  async function inspectVault() {
    setBusy("inspect-vault"); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inspect-personal-vault" }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not inspect your vault.");
      setVaultHealth({ missingFiles: Number(body.report?.missingFiles) || 0, integrityMismatches: Number(body.report?.integrityMismatches) || 0 });
      setMessage("Private vault integrity scan finished. No assets were changed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not inspect vault integrity."); }
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
      await loadPersonalItems(personalQuery);
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
      await loadPersonalItems(personalQuery);
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
      await loadPersonalItems(personalQuery);
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
      if (personalItems.length === 1 && personalPage > 0) setPersonalPage((page) => page - 1);
      else await loadPersonalItems(personalQuery);
      setMessage(`${item.name} was removed from your private collection.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove this asset."); }
    finally { setBusy(""); }
  }

  async function updatePersonalItem(itemId: string, metadata: Record<string, unknown>) {
    setBusy(`metadata:${itemId}`); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-personal", itemId, metadata }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not update this asset.");
      await loadPersonalItems(personalQuery);
      setMessage(`Saved JED details for ${body.item?.name || "asset"}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update asset details."); }
    finally { setBusy(""); }
  }

  async function updateSelected(metadata: Record<string, unknown>) {
    if (!selectedPersonal.length) return;
    setBusy("bulk-metadata"); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-personal-bulk", itemIds: selectedPersonal, metadata }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not update selected assets.");
      await loadPersonalItems(personalQuery);
      setSelectedPersonal([]);
      setMessage(`Updated ${body.updated || 0} selected JED assets.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update selected assets."); }
    finally { setBusy(""); }
  }

  async function manageCollection(operation: "create" | "rename" | "describe" | "empty" | "delete") {
    const target = operation === "create" ? newCollectionName.trim() : manageCollectionName;
    if (!target || (operation !== "create" && target === "Inbox")) return;
    if (operation === "rename" && !renamedCollection.trim()) { setMessage("Enter the new collection name."); return; }
    if ((operation === "empty" || operation === "delete") && !window.confirm(operation === "delete"
      ? `Delete the collection “${target}”? Its assets will move to Inbox and will not be deleted.`
      : `Move every asset in “${target}” to Inbox? No assets will be deleted.`)) return;
    setBusy("manage-collection"); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manage-personal-collection", collection: target, operation,
          newName: renamedCollection, description: operation === "create" ? newCollectionDescription : collectionDescription }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not update this collection.");
      await loadPersonalItems({ ...personalQuery, offset: 0 });
      setPersonalPage(0);
      setPersonalCollections(Array.isArray(body.collections) ? body.collections : []);
      setCollectionFilter("all");
      if (operation === "create") { setNewCollectionName(""); setNewCollectionDescription(""); setManageCollectionName(target); }
      if (operation === "delete") { setManageCollectionName(""); setRenamedCollection(""); setCollectionDescription(""); }
      if (operation === "rename") { setManageCollectionName(body.collection || renamedCollection); setRenamedCollection(""); }
      if (operation === "describe") setMessage(`Saved the description for “${target}”.`);
      else if (operation === "create") setMessage(`Created private collection “${target}”.`);
      else if (operation === "rename") setMessage(`Renamed the collection and moved ${body.updated} assets.`);
      else if (operation === "delete") setMessage(`Deleted the collection. ${body.updated} assets were moved to Inbox; none were deleted.`);
      else setMessage(`Moved ${body.updated} assets to Inbox. Nothing was deleted.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update this collection."); }
    finally { setBusy(""); }
  }

  // Source-only invite: Possum Bot only has to be a member to list a server's
  // emojis and stickers, so this link requests no permissions at all.
  function sourceInviteUrl(guildId: string) {
    if (!botInviteUrl) return "";
    try {
      const url = new URL(botInviteUrl);
      for (const key of ["response_type", "redirect_uri", "state"]) url.searchParams.delete(key);
      url.searchParams.set("scope", "bot");
      url.searchParams.set("permissions", "0");
      url.searchParams.set("guild_id", guildId);
      url.searchParams.set("disable_guild_select", "true");
      return url.toString();
    } catch { return ""; }
  }

  async function copyAdminRequest(guild: Guild) {
    const link = sourceInviteUrl(guild.id);
    if (!link) { setMessage("The Possum Bot invite link is unavailable right now."); return; }
    const text = `Hi! Could you add Possum Bot to ${guild.name}? I'd like to save a few of the server's emojis to my private collection. The invite asks for no permissions, and the bot can be removed right after: ${link}`;
    try { await navigator.clipboard.writeText(text); setMessage(`Request copied. Send it to an owner or admin of ${guild.name}.`); }
    catch { setMessage(`Copy this request for an admin: ${text}`); }
  }

  async function refreshServerAccess() {
    setBusy("explorer-refresh"); setMessage("");
    try {
      const response = await fetch("/api/guilds/installed", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Could not refresh server access.");
      const present = new Set((Array.isArray(body.guilds) ? body.guilds : []).filter((entry: Guild) => entry?.botPresent !== false).map((entry: Guild) => entry.id));
      setGuilds((current) => current.map((guild) => ({ ...guild, botPresent: present.has(guild.id) })));
      if (typeof body.inviteUrl === "string") setBotInviteUrl(body.inviteUrl);
      if (explorerGuildId) void openExplorerGuild(explorerGuildId, present.has(explorerGuildId));
      setMessage("Server access refreshed. A server you just added Possum Bot to can take up to 30 seconds to show as installed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not refresh server access."); }
    finally { setBusy(""); }
  }

  async function importExplorerSelection() {
    if (!explorerGuild?.botPresent || !explorerSelected.length) return;
    if (!personalRightsConfirmed) { setMessage("Confirm you are authorized to keep these assets in your private collection."); return; }
    const collection = explorerCollection.trim();
    setBusy("explorer-import"); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start-import", guildId: explorerGuild.id, assetIds: explorerSelected, collection: collection || undefined, rightsConfirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true || !body.job) throw new Error(body?.error || "Could not queue the selected assets.");
      const job = body.job as ImportJob;
      setImportJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)]);
      importWasActive.current = true;
      setExplorerSelected([]);
      setPersonalRightsConfirmed(false);
      setMessage(`Saving ${job.total} asset${job.total === 1 ? "" : "s"} from ${explorerGuild.name} to ${collection ? `“${collection}”` : "your Inbox"}. Duplicates already in your vault are skipped.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not queue the selected assets."); }
    finally { setBusy(""); }
  }

  async function leaveExplorerGuild() {
    const guild = explorerGuild;
    if (!guild?.botPresent || !guild.manageable) return;
    if (!window.confirm(`Remove Possum Bot from ${guild.name}? Everything you saved stays in your vault, but any Possum Bot features set up in that server stop working until it is added again.`)) return;
    setBusy("explorer-leave"); setMessage("");
    try {
      const response = await fetch("/api/jed-catalog", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave-source-guild", guildId: guild.id, confirmName: leaveConfirmName }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Possum Bot could not leave that server.");
      setGuilds((current) => current.map((entry) => entry.id === guild.id ? { ...entry, botPresent: false } : entry));
      setAssets((current) => current.filter((asset) => asset.sourceGuildId !== guild.id));
      setTargetGuildId((current) => current === guild.id ? "" : current);
      setExplorerAssets([]); setExplorerSelected([]); setLeaveConfirmName(""); setExplorerStatus("");
      setMessage(`Possum Bot left ${guild.name}. Your saved assets are still in your vault.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Possum Bot could not leave that server."); }
    finally { setBusy(""); }
  }

  function toggleExplorerAsset(assetId: string) {
    setExplorerSelected((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]);
  }

  function toggleSelected(itemId: string) {
    setSelectedPersonal((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  }

  function assetCardImage(url: string, alt: string, size = 148) {
    return <img src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: size, objectFit: "contain", background: "linear-gradient(145deg,#170712,#08040a)", borderRadius: 14, border: "1px solid #472039" }} />;
  }

  const tabStyle = (active: boolean): CSSProperties => ({ ...button, background: active ? "linear-gradient(105deg,#ff347d,#a9004b)" : "#170710", borderColor: active ? "#ff79a7" : "#59203a", padding: "11px 16px" });
  const smallButton: CSSProperties = { ...button, padding: "7px 10px", fontSize: 13 };
  const field: CSSProperties = { ...input, maxWidth: "none", boxSizing: "border-box" };
  const statCard: CSSProperties = { ...panel, padding: "13px 16px", minWidth: 120, flex: "1 1 120px" };
  const sourceSelector = <label style={{ ...muted, display: "grid", gap: 6, minWidth: 230 }}>Asset source
    <select style={field} value={sourceGuildId} onChange={(event) => setSourceGuildId(event.target.value)}>
      <option value="all">Every server JED can read</option>
      {guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}{guild.botPresent ? " · connected" : " · add Possum Bot"}</option>)}
    </select>
  </label>;

  return (
    <main style={shell}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={{ ...panel, padding: "clamp(22px, 5vw, 48px)", overflow: "hidden" }}>
          <div style={{ ...accent, fontSize: 12, fontWeight: 900, letterSpacing: ".22em", textTransform: "uppercase" }}>JED · Your expression library</div>
          <h1 style={{ margin: "10px 0 8px", fontSize: "clamp(34px, 5vw, 60px)", lineHeight: 1.02, color: "#fff" }}>Find it. Keep it. Make it yours.</h1>
          <p style={{ ...muted, maxWidth: 900, margin: "0 0 20px" }}>One workspace for discovering Discord expressions, organizing your private vault, sharing approved public assets, and sending assets into servers you manage.</p>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <a href="/dashboard/jed" style={{ ...smallButton, textDecoration: "none" }}>JED controls</a>
            <a href="/dashboard/jed/private-media" style={{ ...smallButton, textDecoration: "none", background: "#241020" }}>Private media</a>
            <a href="/dashboard/jed/adult-emotes" style={{ ...smallButton, textDecoration: "none", background: "#241020" }}>Adult Emote Studio</a>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
            <div style={statCard}><strong style={{ display: "block", fontSize: 23 }}>{vaultStats.total}</strong><span style={muted}>Vault assets</span></div>
            <div style={statCard}><strong style={{ display: "block", fontSize: 23 }}>{vaultStats.favorites}</strong><span style={muted}>Favorites</span></div>
            <div style={statCard}><strong style={{ display: "block", fontSize: 23 }}>{readableGuilds.length}</strong><span style={muted}>Connected servers</span></div>
            <div style={statCard}><strong style={{ display: "block", fontSize: 23 }}>{items.length}</strong><span style={muted}>Public assets</span></div>
          </div>
        </header>

        {message ? <div role="status" style={{ ...panel, borderColor: "#ff4d8b" }}>{message}</div> : null}
        {!publishingEnabled ? <div style={{ ...panel, padding: 14 }}><strong>Public sharing is currently closed.</strong> Existing approved assets remain available, and private vault imports continue to work.</div> : null}
        {!signedIn ? <div style={panel}>Sign in to manage your vault and inspect server assets. <a href="/api/auth/discord/login?returnTo=%2Femotes" style={{ ...smallButton, display: "inline-block", marginLeft: 10, textDecoration: "none" }}>Sign in with Discord</a></div> : null}

        <nav aria-label="JED sections" style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {([[ "discover", "Discover" ], [ "explorer", "Emoji Explorer" ], [ "vault", "My Vault" ], [ "public", "Public Library" ], [ "import", "Import & Sources" ], ...(isCatalogReviewer ? [[ "review", "Review Queue" ]] : [])] as Array<[JedView, string]>).map(([key, label]) =>
            <button key={key} type="button" style={tabStyle(view === key)} onClick={() => setView(key)}>{label}{key === "explorer" ? " · " + guilds.length : key === "vault" ? " · " + personalItems.length : key === "public" ? " · " + items.length : key === "review" ? " · " + pendingItems.length : ""}</button>
          )}
        </nav>

        {view === "discover" ? <section style={{ ...panel, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "end" }}>
            <div><div style={accent}>DISCOVERY</div><h2 style={{ margin: "5px 0" }}>Browse server expressions</h2><p style={{ ...muted, margin: 0 }}>See emoji and stickers across servers where you are a member and JED has been installed.</p></div>
            {signedIn ? sourceSelector : null}
          </div>
          {sourceGuildId !== "all" && selectedSourceGuild && !selectedSourceGuild.botPresent ? <div style={{ ...panel, background: "#180813" }}>
            <strong>{selectedSourceGuild.name}</strong><p style={muted}>Discord only exposes a server&apos;s expression inventory to an app installed there. Ask a server administrator to add Possum Bot to make its assets discoverable.</p>
            {sourceInviteUrl(selectedSourceGuild.id) ? <a href={sourceInviteUrl(selectedSourceGuild.id)} target="_blank" rel="noreferrer" style={{ ...smallButton, display: "inline-block", textDecoration: "none" }}>Add Possum Bot to {selectedSourceGuild.name}</a> : null}
          </div> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ ...muted, display: "grid", gap: 5, flex: "1 1 260px" }}>Search discovered assets<input style={field} value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Name, type, or server" /></label>
            <label style={{ ...muted, display: "grid", gap: 5 }}>Type<select style={{ ...field, minWidth: 150 }} value={assetTypeFilter} onChange={(event) => setAssetTypeFilter(event.target.value)}><option value="all">All types</option><option value="emoji">Emoji</option><option value="sticker">Stickers</option><option value="gif">GIFs</option></select></label>
            <label style={{ ...muted, display: "grid", gap: 5 }}>Destination<select style={{ ...field, minWidth: 190 }} value={targetGuildId} onChange={(event) => setTargetGuildId(event.target.value)}><option value="">Choose a server</option>{destinationGuilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label>
            <button type="button" style={smallButton} disabled={!personalRightsConfirmed || !visibleGuildAssets.length || Boolean(busy)} onClick={() => void importAllAssets()}>{busy === "import-all" ? "Importing…" : "Import all from source"}</button>
          </div>
          <div style={{ ...panel, display: "flex", gap: 12, flexWrap: "wrap", padding: 13 }}>
            <label style={muted}><input type="checkbox" checked={personalRightsConfirmed} onChange={(event) => setPersonalRightsConfirmed(event.target.checked)} /> I have permission to save these assets privately.</label>
            {publishingEnabled ? <><label style={muted}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> I have rights to share selected assets.</label><label style={muted}><input type="checkbox" checked={generalConfirmed} onChange={(event) => setGeneralConfirmed(event.target.checked)} /> Public submissions are general-audience.</label></> : null}
          </div>
          {assetLoadMessage ? <div role="status" style={muted}>{assetLoadMessage}</div> : null}
          {importProgress ? <div role="status" style={{ ...panel, padding: 12 }}>{importProgress}</div> : null}
          {loading ? <p role="status" style={muted}>Loading JED discovery…</p> : !signedIn ? <p style={muted}>Sign in to load your connected Discord servers.</p> : filteredGuildAssets.length ? <div style={cardGrid}>
            {filteredGuildAssets.map((asset) => <article key={asset.sourceGuildId + ":" + asset.id} style={{ ...panel, padding: 13, background: "linear-gradient(155deg,#26091b,#10000b)" }}>
              {assetCardImage(asset.url, asset.name, 150)}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10 }}><strong style={{ overflowWrap: "anywhere" }}>{asset.name}</strong><span style={{ ...muted, whiteSpace: "nowrap" }}>{asset.assetType}{asset.animated ? " · GIF" : ""}</span></div>
              <div style={{ ...muted, fontSize: 13 }}>{asset.sourceGuildName}</div>
              <button type="button" style={{ ...smallButton, width: "100%", marginTop: 10 }} disabled={!personalRightsConfirmed || Boolean(busy)} onClick={() => void importOneAsset(asset)}>{busy === "import-one:" + asset.id ? "Saving…" : "Save to my vault"}</button>
              {publishingEnabled && guilds.find((guild) => guild.id === asset.sourceGuildId)?.manageable ? <button type="button" style={{ ...smallButton, width: "100%", marginTop: 7, background: "#241020" }} disabled={Boolean(busy) || (!asset.published && !(rightsConfirmed && generalConfirmed))} onClick={() => void publishAsset(asset)}>{asset.published ? "Withdraw public listing" : "Submit to public library"}</button> : null}
            </article>)}
          </div> : <div style={{ ...panel, textAlign: "center", padding: 32 }}><strong>No matching expressions found.</strong><p style={muted}>{assetLoadMessage || "Try another search or choose a server where JED can read the expression list."}</p></div>}
        </section> : null}

        {view === "explorer" ? <section style={{ ...panel, display: "grid", gap: 16 }}>
          <div><div style={accent}>EMOJI EXPLORER</div><h2 style={{ margin: "5px 0" }}>Every Discord server you&apos;re in</h2><p style={{ ...muted, margin: 0, maxWidth: 900 }}>Pick a server, choose the emojis and stickers you want, save them to your vault, and remove Possum Bot when you&apos;re done. Possum Bot only has to be a member to read a server&apos;s emojis, so the source invite asks for no permissions.</p></div>
          {!signedIn ? <p style={muted}>Sign in with Discord to see your servers.</p> : <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={statCard}><strong style={{ display: "block", fontSize: 21 }}>{guilds.length}</strong><span style={muted}>Your servers</span></div>
              <div style={statCard}><strong style={{ display: "block", fontSize: 21 }}>{tierCounts.full + tierCounts.member}</strong><span style={muted}>Emojis available</span></div>
              <div style={statCard}><strong style={{ display: "block", fontSize: 21 }}>{tierCounts.installable}</strong><span style={muted}>You can add the bot</span></div>
              <div style={statCard}><strong style={{ display: "block", fontSize: 21 }}>{tierCounts.restricted}</strong><span style={muted}>Need an admin</span></div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 280px", maxWidth: 440, minWidth: 0, display: "grid", gap: 9 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input aria-label="Search your servers" style={{ ...field, flex: 1 }} value={explorerSearch} onChange={(event) => setExplorerSearch(event.target.value)} placeholder="Search your servers…" />
                  <button type="button" style={{ ...smallButton, background: "#241020" }} disabled={Boolean(busy)} onClick={() => void refreshServerAccess()}>{busy === "explorer-refresh" ? "…" : "Refresh"}</button>
                </div>
                <div style={{ display: "grid", gap: 7, maxHeight: 620, overflowY: "auto", paddingRight: 2 }}>
                  {explorerGuilds.length ? explorerGuilds.map((guild) => {
                    const tier = accessTier(guild);
                    const selected = guild.id === explorerGuildId;
                    return <button key={guild.id} type="button" aria-pressed={selected} onClick={() => void openExplorerGuild(guild.id, guild.botPresent === true)}
                      style={{ display: "flex", gap: 11, alignItems: "center", textAlign: "left", padding: "10px 12px", borderRadius: 12, cursor: "pointer", color: "#ffe4ee",
                        border: `1px solid ${selected ? "#ff4c8c" : "#472039"}`, background: selected ? "#3a0b24" : "#170710" }}>
                      {guild.iconUrl ? <img src={guild.iconUrl} alt="" width={38} height={38} loading="lazy" referrerPolicy="no-referrer" style={{ borderRadius: "50%", flexShrink: 0 }} />
                        : <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "#3b1028", fontWeight: 800 }}>{guild.name.slice(0, 1).toUpperCase()}</span>}
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{guild.name}</strong>
                        <span style={{ fontSize: 12.5, color: tier.tone }}>● {tier.label}</span>
                      </span>
                    </button>;
                  }) : <p style={muted}>{guilds.length ? "No servers match that search." : "Loading your Discord servers…"}</p>}
                </div>
              </div>

              <div style={{ flex: "3 1 420px", minWidth: 0, display: "grid", gap: 12 }}>
                {!explorerGuild ? <div style={{ ...panel, textAlign: "center", padding: 32 }}><strong>Choose a server</strong><p style={muted}>Servers with Possum Bot installed open straight into their emoji list. Others show how to get the bot in.</p></div> : <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div><h3 style={{ margin: 0 }}>{explorerGuild.name}</h3><span style={{ fontSize: 13, color: accessTier(explorerGuild).tone }}>{accessTier(explorerGuild).label}</span></div>
                  </div>

                  {accessTier(explorerGuild).key === "installable" ? <div style={{ ...panel, background: "#180813" }}>
                    <p style={{ ...muted, marginTop: 0 }}>You manage this server, so you can add Possum Bot as a source with no permissions. Once it joins, click <strong>Refresh</strong> and the emojis load here.</p>
                    {sourceInviteUrl(explorerGuild.id) ? <a href={sourceInviteUrl(explorerGuild.id)} target="_blank" rel="noreferrer" style={{ ...smallButton, display: "inline-block", textDecoration: "none" }}>Add Possum Bot (no permissions)</a> : <span style={muted}>The invite link is unavailable right now.</span>}
                  </div> : null}

                  {accessTier(explorerGuild).key === "restricted" ? <div style={{ ...panel, background: "#180813" }}>
                    <p style={{ ...muted, marginTop: 0 }}>Discord only lets people with <strong>Manage Server</strong> add apps, and it only shares a server&apos;s emoji list with apps that are installed there. Send an owner or admin the request below; it asks for no permissions and they can remove the bot right after.</p>
                    <button type="button" style={smallButton} disabled={!botInviteUrl} onClick={() => void copyAdminRequest(explorerGuild)}>Copy request for an admin</button>
                    <p style={{ ...muted, fontSize: 13, marginBottom: 0 }}>Already have a specific emoji? Paste its link under <strong>Import &amp; Sources → Import a direct Discord link</strong>.</p>
                  </div> : null}

                  {explorerGuild.botPresent ? <>
                    <div style={{ ...panel, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "end", padding: 13 }}>
                      <label style={{ ...muted, display: "grid", gap: 4, flex: "1 1 180px" }}>Filter<input style={field} value={explorerAssetSearch} onChange={(event) => setExplorerAssetSearch(event.target.value)} placeholder="Emoji name" /></label>
                      <label style={{ ...muted, display: "grid", gap: 4, flex: "1 1 180px" }}>Save into collection
                        <input style={field} list="jed-explorer-collections" maxLength={40} value={explorerCollection} onChange={(event) => setExplorerCollection(event.target.value)} placeholder="Inbox" />
                        <datalist id="jed-explorer-collections">{collections.map((collection) => <option key={collection} value={collection} />)}</datalist>
                      </label>
                      <button type="button" style={{ ...smallButton, background: "#241020" }} onClick={() => setExplorerSelected(visibleExplorerAssets.map((asset) => asset.id))}>Select all</button>
                      <button type="button" style={{ ...smallButton, background: "#241020" }} onClick={() => setExplorerSelected(visibleExplorerAssets.filter((asset) => !asset.inVault).map((asset) => asset.id))}>Select new only</button>
                      <button type="button" style={{ ...smallButton, background: "#241020" }} disabled={!explorerSelected.length} onClick={() => setExplorerSelected([])}>Clear</button>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <label style={muted}><input type="checkbox" checked={personalRightsConfirmed} onChange={(event) => setPersonalRightsConfirmed(event.target.checked)} /> I have permission to save these assets privately.</label>
                      <button type="button" style={button} disabled={!explorerSelected.length || !personalRightsConfirmed || Boolean(busy)} onClick={() => void importExplorerSelection()}>{busy === "explorer-import" ? "Queuing…" : `Save ${explorerSelected.length} to my vault`}</button>
                    </div>
                    {explorerJob ? <div role="status" style={{ ...panel, padding: 12, display: "grid", gap: 6 }}>
                      <span style={muted}>Latest import · {explorerJob.status.replaceAll("_", " ")} · {explorerJob.processed}/{explorerJob.total} processed · {explorerJob.added} added · {explorerJob.skipped} skipped{explorerJob.collection && explorerJob.collection !== "Inbox" ? ` · into “${explorerJob.collection}”` : ""}</span>
                      <div style={{ height: 6, borderRadius: 6, background: "#16000b", overflow: "hidden" }}><div style={{ width: `${explorerJob.total ? Math.min(100, Math.round(explorerJob.processed / explorerJob.total * 100)) : 0}%`, height: "100%", background: "linear-gradient(90deg,#ff347d,#ff8bb6)" }} /></div>
                    </div> : null}
                    {explorerStatus ? <p role="status" style={muted}>{explorerStatus}</p> : null}
                    {visibleExplorerAssets.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 9 }}>
                      {visibleExplorerAssets.map((asset) => {
                        const checked = explorerSelected.includes(asset.id);
                        return <label key={asset.assetType + ":" + asset.id} title={asset.name} style={{ display: "grid", gap: 5, padding: 8, borderRadius: 12, cursor: "pointer",
                          border: `1px solid ${checked ? "#ff4c8c" : "#472039"}`, background: checked ? "#3a0b24" : "#170710", position: "relative" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleExplorerAsset(asset.id)} style={{ position: "absolute", top: 7, left: 7 }} aria-label={`Select ${asset.name}`} />
                          <img src={asset.url} alt={asset.name} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 64, objectFit: "contain" }} />
                          <span style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</span>
                          <span style={{ fontSize: 11, color: asset.inVault ? "#4fd18b" : "#efb4c9" }}>{asset.inVault ? "✓ In vault" : asset.assetType}{asset.animated ? " · animated" : ""}</span>
                        </label>;
                      })}
                    </div> : null}

                    {explorerGuild.manageable ? <div style={{ ...panel, background: "#180813", display: "grid", gap: 9 }}>
                      <strong>Done here? Remove Possum Bot</strong>
                      <p style={{ ...muted, margin: 0 }}>Your saved assets stay in your vault. Any Possum Bot features set up in this server stop working until it is added again.{explorerJobActive ? " Wait for the import above to finish first." : ""}</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                        <label style={{ ...muted, display: "grid", gap: 4, flex: "1 1 220px" }}>Type “{explorerGuild.name}” to confirm<input style={field} value={leaveConfirmName} onChange={(event) => setLeaveConfirmName(event.target.value)} /></label>
                        <button type="button" style={{ ...smallButton, background: "#421328" }} disabled={explorerJobActive || leaveConfirmName.trim() !== explorerGuild.name.trim() || Boolean(busy)} onClick={() => void leaveExplorerGuild()}>{busy === "explorer-leave" ? "Leaving…" : "Remove Possum Bot"}</button>
                      </div>
                    </div> : <p style={{ ...muted, fontSize: 13, margin: 0 }}>When you&apos;re finished, ask a server admin to remove Possum Bot if it was added just for you.</p>}
                  </> : null}
                </>}
              </div>
            </div>
          </>}
        </section> : null}

        {view === "vault" ? <section style={{ ...panel, display: "grid", gap: 16 }}>
          <div><div style={accent}>PRIVATE COLLECTION</div><h2 style={{ margin: "5px 0" }}>Your JED Vault</h2><p style={{ ...muted, margin: 0 }}>Organize private copies, favorites, tags, collections, source history, and review status. Existing saved assets remain intact.</p></div>
          {!signedIn ? <p style={muted}>Sign in with Discord to open your private vault.</p> : <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <label style={{ ...muted, display: "grid", gap: 5, flex: "1 1 240px" }}>Search your vault<input style={field} value={personalSearch} onChange={(event) => { setPersonalSearch(event.target.value); setPersonalPage(0); }} placeholder="Name, tag, server, or type" /></label>
              <label style={{ ...muted, display: "grid", gap: 5 }}>Collection<select style={field} value={collectionFilter} onChange={(event) => { setCollectionFilter(event.target.value); setPersonalPage(0); }}><option value="all">All collections</option>{collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></label>
              <label style={{ ...muted, display: "grid", gap: 5 }}>Type<select style={field} value={personalTypeFilter} onChange={(event) => { setPersonalTypeFilter(event.target.value); setPersonalPage(0); }}><option value="all">All types</option><option value="emoji">Emoji</option><option value="sticker">Stickers</option><option value="gif">GIFs</option></select></label>
              <label style={{ ...muted, display: "grid", gap: 5 }}>Smart view<select style={field} value={smartFilter} onChange={(event) => { setSmartFilter(event.target.value as JedFilter); setPersonalPage(0); }}><option value="all">Everything</option><option value="favorites">Favorites</option><option value="animated">Animated</option><option value="recent">Added this week</option><option value="multi-source">Found in multiple servers</option><option value="needs-review">Needs content review</option></select></label>
              <label style={{ ...muted, display: "grid", gap: 5 }}>Sort<select style={field} value={personalSort} onChange={(event) => { setPersonalSort(event.target.value as typeof personalSort); setPersonalPage(0); }}><option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option><option value="favorites">Favorites first</option></select></label>
              <button type="button" style={smallButton} onClick={() => setSelectedPersonal(filteredPersonalItems.map((item: any) => item.id))}>Select visible</button>
              {similarTo ? <button type="button" style={{ ...smallButton, background: "#241020" }} onClick={() => setSimilarTo("")}>Clear visual matches</button> : null}
            </div>
            <div style={{ ...panel, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
              <div><strong>Vault integrity</strong><div style={muted}>{vaultHealth ? `${vaultHealth.missingFiles} missing files · ${vaultHealth.integrityMismatches} hash mismatches` : "Check your private files without changing them."}</div></div>
              <button type="button" style={smallButton} disabled={Boolean(busy)} onClick={() => void inspectVault()}>{busy === "inspect-vault" ? "Inspecting…" : "Inspect vault files"}</button>
            </div>
            {selectedPersonal.length ? <div style={{ ...panel, display: "flex", gap: 9, flexWrap: "wrap", alignItems: "end", padding: 13 }}>
              <strong>{selectedPersonal.length} selected</strong>
              <label style={{ ...muted, display: "grid", gap: 4 }}>Move to collection<input style={{ ...field, width: 220 }} value={bulkCollection} onChange={(event) => setBulkCollection(event.target.value)} placeholder="Collection name" /></label>
              <button type="button" style={smallButton} disabled={!bulkCollection.trim() || Boolean(busy)} onClick={() => void updateSelected({ collection: bulkCollection.trim() })}>Move</button>
              <button type="button" style={smallButton} disabled={Boolean(busy)} onClick={() => void updateSelected({ favorite: true })}>Favorite</button>
              <button type="button" style={{ ...smallButton, background: "#241020" }} disabled={Boolean(busy)} onClick={() => void updateSelected({ favorite: false })}>Unfavorite</button>
              <button type="button" style={{ ...smallButton, background: "#241020" }} onClick={() => setSelectedPersonal([])}>Clear selection</button>
            </div> : null}
            <div style={{ ...panel, display: "grid", gap: 12, padding: 13 }}>
              <strong>Private collections</strong>
              <p style={{ ...muted, margin: 0 }}>Collections belong to your account. Deleting one moves its assets to Inbox; it never deletes asset files or records.</p>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "end" }}>
                <label style={{ ...muted, display: "grid", gap: 4 }}>New collection<input style={{ ...field, width: 220 }} maxLength={40} value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder="Collection name" /></label>
                <label style={{ ...muted, display: "grid", gap: 4, flex: "1 1 240px" }}>Description<input style={field} maxLength={280} value={newCollectionDescription} onChange={(event) => setNewCollectionDescription(event.target.value)} placeholder="Optional description" /></label>
                <button type="button" style={smallButton} disabled={!newCollectionName.trim() || Boolean(busy)} onClick={() => void manageCollection("create")}>Create private collection</button>
              </div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "end" }}>
                <label style={{ ...muted, display: "grid", gap: 4 }}>Collection<select style={field} value={manageCollectionName} onChange={(event) => {
                  const name = event.target.value; setManageCollectionName(name);
                  setCollectionDescription(personalCollections.find((entry) => entry.name === name)?.description || "");
                }}><option value="">Choose collection</option>{collections.filter((collection) => collection !== "Inbox").map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></label>
                <label style={{ ...muted, display: "grid", gap: 4 }}>Rename to<input style={{ ...field, width: 220 }} maxLength={40} value={renamedCollection} onChange={(event) => setRenamedCollection(event.target.value)} placeholder="New collection name" /></label>
                <button type="button" style={smallButton} disabled={!manageCollectionName || !renamedCollection.trim() || Boolean(busy)} onClick={() => void manageCollection("rename")}>Rename</button>
                <label style={{ ...muted, display: "grid", gap: 4, flex: "1 1 240px" }}>Description<input style={field} maxLength={280} value={collectionDescription} onChange={(event) => setCollectionDescription(event.target.value)} placeholder="Describe this collection" /></label>
                <button type="button" style={smallButton} disabled={!manageCollectionName || Boolean(busy)} onClick={() => void manageCollection("describe")}>Save description</button>
                <button type="button" style={{ ...smallButton, background: "#241020" }} disabled={!manageCollectionName || Boolean(busy)} onClick={() => void manageCollection("empty")}>Move assets to Inbox</button>
                <button type="button" style={{ ...smallButton, background: "#421328" }} disabled={!manageCollectionName || Boolean(busy)} onClick={() => void manageCollection("delete")}>Delete collection safely</button>
              </div>
              {manageCollectionName ? <span style={muted}>{personalCollections.find((entry) => entry.name === manageCollectionName)?.assetCount ?? personalItems.filter((item) => (item.collection || "Inbox") === manageCollectionName).length} assets · Private</span> : null}
            </div>
            {filteredPersonalItems.length ? <div style={cardGrid}>
              {filteredPersonalItems.map((item: any) => <article key={item.id} style={{ ...panel, padding: 13, background: "linear-gradient(155deg,#26091b,#10000b)", outline: selectedPersonal.includes(item.id) ? "2px solid #ff4c8c" : "none" }}>
                <label style={{ ...muted, display: "flex", gap: 7, alignItems: "center", marginBottom: 8 }}><input type="checkbox" checked={selectedPersonal.includes(item.id)} onChange={() => toggleSelected(item.id)} /> Select</label>
                {assetCardImage(item.url, item.name, 148)}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10 }}><strong style={{ overflowWrap: "anywhere" }}>{item.name}</strong><span style={muted}>{item.favorite ? "★" : "☆"}</span></div>
                <div style={{ ...muted, fontSize: 13 }}>{item.assetType}{item.animated ? " · Animated" : ""} · {item.collection || "Inbox"}</div>
                <div style={{ ...muted, fontSize: 13 }}>From {item.sourceGuildName || (item.uploaded ? "your upload" : "Discord asset")} · {(item.sources || []).length || 1} source{(item.sources || []).length === 1 ? "" : "s"}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  <button type="button" style={smallButton} disabled={Boolean(busy)} onClick={() => void updatePersonalItem(item.id, { favorite: !item.favorite })}>{item.favorite ? "Unfavorite" : "Favorite"}</button>
                  <button type="button" style={{ ...smallButton, background: "#241020" }} onClick={() => setDetailsId(detailsId === item.id ? "" : item.id)}>{detailsId === item.id ? "Hide details" : "Edit details"}</button>
                  <button type="button" style={{ ...smallButton, background: "#241020" }} onClick={() => setSimilarTo(item.id)}>Find similar</button>
                </div>
                {detailsId === item.id ? <div style={{ ...panel, padding: 11, marginTop: 10, display: "grid", gap: 8 }}>
                  <label style={{ ...muted, display: "grid", gap: 4 }}>Asset name<input id={"jed-name-" + item.id} style={field} defaultValue={item.name} maxLength={32} /></label>
                  <label style={{ ...muted, display: "grid", gap: 4 }}>Collection<input id={"jed-collection-" + item.id} style={field} defaultValue={item.collection || "Inbox"} maxLength={40} /></label>
                  <label style={{ ...muted, display: "grid", gap: 4 }}>Tags, separated by commas<input id={"jed-tags-" + item.id} style={field} defaultValue={(item.tags || []).join(", ")} maxLength={400} /></label>
                  <label style={{ ...muted, display: "grid", gap: 4 }}>Content review<select id={"jed-rating-" + item.id} style={field} defaultValue={item.contentRating || "unreviewed"}><option value="unreviewed">Not reviewed</option><option value="general">General</option><option value="adult">Adult / restricted</option></select></label>
                  <button type="button" style={smallButton} disabled={Boolean(busy)} onClick={() => {
                    const read = (suffix: string) => (document.getElementById("jed-" + suffix + "-" + item.id) as HTMLInputElement | null)?.value || "";
                    void updatePersonalItem(item.id, { name: read("name"), collection: read("collection"), tags: read("tags").split(",").map((tag) => tag.trim()).filter(Boolean), contentRating: read("rating") });
                  }}>Save details</button>
                  <div style={{ ...muted, fontSize: 12 }}>Visual fingerprint: {item.visualFingerprint || "Not available"} · {item.sha256 ? "Content hash saved" : "Hash unavailable"}</div>
                  <div style={{ ...muted, fontSize: 12 }}>Sources: {(item.sources || []).map((source: any) => source.guildName || "Direct import").join(" · ") || item.sourceGuildName || "Direct import"}</div>
                </div> : null}
                <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                  <a href={item.url} download={item.downloadName || item.name} style={{ ...smallButton, flex: 1, textAlign: "center", textDecoration: "none" }}>Download</a>
                  <button type="button" style={{ ...smallButton, flex: 1, background: "#241020" }} disabled={!targetGuildId || Boolean(busy)} onClick={() => void exportPersonalItem(item)}>{busy === "personal-export:" + item.id ? "Adding…" : "Send to server"}</button>
                </div>
                <button type="button" style={{ ...smallButton, width: "100%", marginTop: 7, background: "#421328" }} disabled={Boolean(busy)} onClick={() => void removePersonalItem(item)}>{busy === "personal-remove:" + item.id ? "Removing…" : "Remove from vault"}</button>
              </article>)}
            </div> : <div style={{ ...panel, padding: 28, textAlign: "center" }}><strong>{personalTotal ? "No assets match these filters." : "Your private vault is ready."}</strong><p style={muted}>{personalTotal ? "Change the search or smart view to see more." : "Import server expressions, add a Discord CDN link, or upload an image in Import & Sources."}</p></div>}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={muted}>{personalTotal} matching assets · Page {personalTotal ? personalPage + 1 : 0} of {Math.max(1, Math.ceil(personalTotal / PRIVATE_PAGE_SIZE))}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={smallButton} disabled={personalPage <= 0 || Boolean(busy)} onClick={() => setPersonalPage((page) => Math.max(0, page - 1))}>Previous</button>
                <button type="button" style={smallButton} disabled={(personalPage + 1) * PRIVATE_PAGE_SIZE >= personalTotal || Boolean(busy)} onClick={() => setPersonalPage((page) => page + 1)}>Next</button>
              </div>
            </div>
          </>}
        </section> : null}

        {view === "public" ? <section style={{ ...panel, display: "grid", gap: 15 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}><div><div style={accent}>COMMUNITY LIBRARY</div><h2 style={{ margin: "5px 0" }}>Public JED Library</h2><p style={{ ...muted, margin: 0 }}>Approved assets shared by their owners. Public listings are separate from your private vault.</p></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input aria-label="Search public assets" style={{ ...field, width: 250 }} value={search} onChange={(event) => { setSearch(event.target.value); setPublicPage(0); }} placeholder="Search names and tags" /><select aria-label="Public asset type" style={{ ...field, width: 150 }} value={publicTypeFilter} onChange={(event) => { setPublicTypeFilter(event.target.value); setPublicPage(0); }}><option value="all">All types</option><option value="emoji">Emoji</option><option value="sticker">Stickers</option><option value="gif">GIFs</option></select><select aria-label="Sort public assets" style={{ ...field, width: 150 }} value={publicSortFilter} onChange={(event) => { setPublicSortFilter(event.target.value as "recent" | "popular"); setPublicPage(0); }}><option value="recent">Recently added</option><option value="popular">Most used</option></select><select aria-label="Destination server" style={{ ...field, width: 220 }} value={targetGuildId} onChange={(event) => setTargetGuildId(event.target.value)}><option value="">Choose destination</option>{destinationGuilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select><select aria-label="Export asset as" style={{ ...field, width: 150 }} value={targetType} onChange={(event) => setTargetType(event.target.value as "emoji" | "sticker")}><option value="emoji">Emoji</option><option value="sticker">Sticker</option></select></div>
          </div>
          {loading ? <p style={muted}>Loading public assets…</p> : visibleItems.length ? <div style={cardGrid}>{visibleItems.map((item) => <article key={item.id} style={{ ...panel, padding: 13 }}>
            {assetCardImage(item.url, item.name, 144)}<strong style={{ display: "block", marginTop: 9, overflowWrap: "anywhere" }}>{item.name}</strong><div style={muted}>{item.assetType}{item.animated ? " · Animated" : ""} · {item.useCount} uses</div>
            <button type="button" style={{ ...smallButton, width: "100%", marginTop: 9 }} disabled={!signedIn || !targetGuildId || Boolean(busy)} onClick={() => void exportItem(item)}>{busy === "export:" + item.id ? "Adding…" : "Add to selected server"}</button>
          </article>)}</div> : <p style={muted}>{search ? "No assets match the search." : "The public library does not have approved assets yet."}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={muted}>{publicTotal} approved assets · Page {publicTotal ? publicPage + 1 : 0} of {Math.max(1, Math.ceil(publicTotal / PUBLIC_PAGE_SIZE))}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={smallButton} disabled={publicPage <= 0 || loading} onClick={() => setPublicPage((page) => Math.max(0, page - 1))}>Previous</button>
              <button type="button" style={smallButton} disabled={(publicPage + 1) * PUBLIC_PAGE_SIZE >= publicTotal || loading} onClick={() => setPublicPage((page) => page + 1)}>Next</button>
            </div>
          </div>
        </section> : null}

        {view === "import" ? <section style={{ ...panel, display: "grid", gap: 16 }}>
          <div><div style={accent}>SOURCE MANAGER</div><h2 style={{ margin: "5px 0" }}>Bring assets into your vault</h2><p style={{ ...muted, margin: 0 }}>Bulk imports append and deduplicate by content. They do not remove or replace existing assets. Discord requires Possum Bot to be installed to list that server&apos;s inventory.</p></div>
          {!signedIn ? <p style={muted}>Sign in with Discord to import assets.</p> : <>
            <div style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", padding: 14 }}>
              {sourceSelector}<label style={muted}><input type="checkbox" checked={personalRightsConfirmed} onChange={(event) => setPersonalRightsConfirmed(event.target.checked)} /> I have permission to save these assets in my private vault.</label>
              <button type="button" style={button} disabled={!personalRightsConfirmed || !readableGuilds.length || (sourceGuildId !== "all" && !selectedSourceGuild?.botPresent) || Boolean(busy)} onClick={() => void importAllAssets()}>{busy === "import-all" ? "Importing…" : "Import all from selected source"}</button>
            </div>
            {assetLoadMessage ? <p role="status" style={muted}>{assetLoadMessage}</p> : null}{importProgress ? <p role="status" style={muted}>{importProgress}</p> : null}
            <div style={{ display: "grid", gap: 10 }}>
              <h3 style={{ margin: 0 }}>Import activity</h3>
              {importJobs.length ? importJobs.map((job) => {
                const progress = job.total ? Math.min(100, Math.round(job.processed / job.total * 100)) : 0;
                const active = ["queued", "running", "cancel_requested"].includes(job.status);
                return <article key={job.id} style={{ ...panel, padding: 13, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{job.guildName}</strong><span style={muted}>{job.status.replaceAll("_", " ")}</span></div>
                  <div role="progressbar" aria-label={`${job.guildName} import progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 8, background: "#16000b", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#ff347d,#ff8bb6)" }} /></div>
                  <span style={muted}>{job.processed}/{job.total} processed · {job.added} added · {job.skipped} skipped{job.error ? ` · ${job.error}` : ""}</span>
                  {job.errors?.length ? <details><summary style={{ cursor: "pointer" }}>Import notes ({job.errors.length})</summary><ul style={muted}>{job.errors.map((error, index) => <li key={`${job.id}:${index}`}>{error}</li>)}</ul></details> : null}
                  <div style={{ display: "flex", gap: 8 }}>{active ? <button type="button" style={smallButton} disabled={Boolean(busy)} onClick={() => void updateImportJob(job.id, "cancel-import")}>Cancel import</button> : null}{job.retryable ? <button type="button" style={smallButton} disabled={Boolean(busy)} onClick={() => void updateImportJob(job.id, "retry-import")}>Resume import</button> : null}</div>
                </article>;
              }) : <div style={panel}>No imports have been queued yet.</div>}
            </div>
            {sourceGuildId !== "all" && selectedSourceGuild && !selectedSourceGuild.botPresent ? <div style={panel}><strong>{selectedSourceGuild.name}</strong><p style={muted}>JED can show this server in your source list, but Discord will only share its inventory after the server installs Possum Bot.</p>{sourceInviteUrl(selectedSourceGuild.id) ? <a href={sourceInviteUrl(selectedSourceGuild.id)} target="_blank" rel="noreferrer" style={{ ...smallButton, textDecoration: "none", display: "inline-block" }}>Add Possum Bot</a> : null}</div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14 }}>
              <div style={panel}><h3 style={{ marginTop: 0 }}>Import a direct Discord link</h3><p style={muted}>Add a Discord emoji, sticker, or attachment CDN link for an image or GIF. JED validates and stores a private copy.</p><div style={{ display: "grid", gap: 9 }}>
                <input style={field} maxLength={32} value={linkedAssetName} onChange={(event) => setLinkedAssetName(event.target.value)} placeholder="Name for this asset" aria-label="Linked asset name" />
                <input style={field} maxLength={2000} value={linkedAssetUrl} onChange={(event) => setLinkedAssetUrl(event.target.value)} placeholder="https://cdn.discordapp.com/emojis/…" aria-label="Discord asset URL" />
                <select style={field} value={linkedAssetType} onChange={(event) => setLinkedAssetType(event.target.value as "emoji" | "sticker" | "gif")}><option value="emoji">Emoji</option><option value="sticker">Sticker</option><option value="gif">GIF or image</option></select>
                <button type="button" style={smallButton} disabled={!personalRightsConfirmed || !linkedAssetName.trim() || !linkedAssetUrl.trim() || Boolean(busy)} onClick={() => void importLinkedAsset()}>{busy === "import-link" ? "Importing…" : "Save link to vault"}</button>
              </div></div>
              <div style={panel}><h3 style={{ marginTop: 0 }}>Upload an image or GIF</h3><p style={muted}>PNG, JPEG, WebP, or GIF under 5 MiB. JED validates the file and keeps a private original.</p><div style={{ display: "grid", gap: 9 }}>
                <input style={field} maxLength={32} value={uploadName} onChange={(event) => setUploadName(event.target.value)} placeholder="Name for this asset" aria-label="Uploaded asset name" />
                <select style={field} value={uploadAssetType} onChange={(event) => setUploadAssetType(event.target.value as "emoji" | "sticker" | "gif")}><option value="emoji">Emoji</option><option value="sticker">Sticker</option><option value="gif">GIF</option></select>
                <input ref={uploadInput} style={field} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose an image" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
                <button type="button" style={smallButton} disabled={!personalRightsConfirmed || !uploadFile || !uploadName.trim() || Boolean(busy)} onClick={() => void uploadPersonalAsset()}>{busy === "upload-personal" ? "Saving…" : "Save upload to vault"}</button>
              </div></div>
            </div>
            {publishingEnabled ? <div style={panel}><h3 style={{ marginTop: 0 }}>Submit a GIF URL to the public library</h3><p style={muted}>Public GIF submissions remain subject to ownership and general-audience confirmation and review.</p><div style={{ display: "grid", gap: 8 }}>
              <input style={field} maxLength={32} value={name} onChange={(event) => setName(event.target.value)} placeholder="GIF display name" aria-label="GIF display name" />
              <input style={field} maxLength={2000} value={gifUrl} onChange={(event) => setGifUrl(event.target.value)} placeholder="HTTPS media URL" aria-label="GIF URL" />
              <label style={muted}><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> I have permission to share this asset.</label>
              <label style={muted}><input type="checkbox" checked={generalConfirmed} onChange={(event) => setGeneralConfirmed(event.target.checked)} /> This asset is suitable for a general-audience library.</label>
              <button type="button" style={smallButton} disabled={!name.trim() || !gifUrl.trim() || !(rightsConfirmed && generalConfirmed) || sourceGuildId === "all" || !selectedSourceGuild?.botPresent || !selectedSourceGuild?.manageable || Boolean(busy)} onClick={() => void publishGif()}>{busy === "publish-gif" ? "Submitting…" : "Submit GIF for review"}</button>
            </div></div> : null}
          </>}
        </section> : null}

        {view === "review" && isCatalogReviewer ? <section style={{ ...panel, display: "grid", gap: 14 }}><div><div style={accent}>CURATION</div><h2 style={{ margin: "5px 0" }}>Public library review queue</h2><p style={{ ...muted, margin: 0 }}>Submissions stay private until a reviewer approves them. Check rights, source, and audience classification before publishing.</p></div>
          {pendingItems.length ? <div style={cardGrid}>{pendingItems.map((item) => <article key={item.id} style={{ ...panel, padding: 13 }}>{assetCardImage(item.url, item.name, 140)}<strong style={{ display: "block", marginTop: 9 }}>{item.name}</strong><div style={muted}>{item.assetType} · {item.sourceGuildName || "Discord server"}</div><div style={{ display: "flex", gap: 7, marginTop: 10 }}><button type="button" style={smallButton} disabled={Boolean(busy)} onClick={() => void reviewAsset(item, "approve")}>Approve</button><button type="button" style={{ ...smallButton, background: "#421328" }} disabled={Boolean(busy)} onClick={() => void reviewAsset(item, "reject")}>Reject</button></div></article>)}</div> : <div style={panel}>No assets are waiting for review.</div>}
        </section> : null}
      </div>
    </main>
  );
}
