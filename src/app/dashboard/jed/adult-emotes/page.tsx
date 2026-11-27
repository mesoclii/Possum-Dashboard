"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import type { GuildEmoji } from "@/components/possum/GuildEmojiPicker";
import { buildDashboardHref } from "@/lib/dashboardContext";

type JedConfig = {
  enabled: boolean;
  batchLimit: number;
  defaultTarget: string;
  defaultVisibility: string;
  allowedDomains: string[];
};

type StagedEmote = {
  id: string;
  name: string;
  source: string;
  target: "emoji" | "sticker";
  category: string;
  createdAt: string;
};

const DEFAULT_CONFIG: JedConfig = {
  enabled: true,
  batchLimit: 1,
  defaultTarget: "auto",
  defaultVisibility: "public",
  allowedDomains: [],
};

const shell: CSSProperties = { maxWidth: 1480, padding: 18, color: "#ffe1e1" };
const panel: CSSProperties = {
  border: "1px solid #661313",
  borderRadius: 16,
  padding: 18,
  background: "linear-gradient(180deg, rgba(120,0,0,0.18), rgba(7,7,7,0.88))",
};
const input: CSSProperties = {
  width: "100%",
  border: "1px solid #7f2525",
  borderRadius: 10,
  background: "#0b0b0b",
  color: "#ffe1e1",
  padding: "10px 12px",
};
const button: CSSProperties = {
  border: "1px solid #b52a4a",
  borderRadius: 10,
  background: "linear-gradient(135deg, #8e1836, #3d0718)",
  color: "#fff4f4",
  cursor: "pointer",
  fontWeight: 900,
  padding: "10px 14px",
};
const muted: CSSProperties = { color: "#d89a9a", lineHeight: 1.65 };

function storageKey(guildId: string) {
  return `possum.jed.adult-emote-staging.v1.${guildId}`;
}

function ageTokenStorageKey(guildId: string) {
  return `possum.age-assurance.adult-emotes.v1.${guildId}`;
}

function emojiImage(emoji: GuildEmoji) {
  const id = String(emoji.id || "").trim();
  if (!/^\d{16,20}$/.test(id)) return "";
  return `https://cdn.discordapp.com/emojis/${id}.${emoji.animated ? "gif" : "png"}?size=96&quality=lossless`;
}

function makeId() {
  return `stage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdultEmotesPage() {
  const [staged, setStaged] = useState<StagedEmote[]>([]);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState<"emoji" | "sticker">("emoji");
  const [category, setCategory] = useState("adult");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [ageToken, setAgeToken] = useState("");
  const [ageAllowed, setAgeAllowed] = useState(false);
  const [ageBusy, setAgeBusy] = useState(false);
  const [ageMessage, setAgeMessage] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const { guildId, guildName, config, emojis, loading, message, reload } =
    useGuildEngineEditor<JedConfig>("jed", DEFAULT_CONFIG, { enabled: ageAllowed });

  useEffect(() => {
    if (!guildId || typeof window === "undefined") return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey(guildId)) || "[]");
      setStaged(Array.isArray(saved) ? saved : []);
    } catch {
      setStaged([]);
    }
  }, [guildId]);

  useEffect(() => {
    if (!guildId || typeof window === "undefined") return;
    window.sessionStorage.setItem(storageKey(guildId), JSON.stringify(staged));
  }, [guildId, staged]);

  useEffect(() => {
    if (!guildId || typeof window === "undefined") return;
    let savedToken = window.sessionStorage.getItem(ageTokenStorageKey(guildId)) || "";
    setAgeToken(savedToken);
    setAgeAllowed(false);
    setAgeMessage("");
    if (savedToken) {
      const verification = new URL("/age-assurance/verify", window.location.origin);
      verification.searchParams.set("token", savedToken);
      setVerificationUrl(verification.toString());
    } else {
      setVerificationUrl("");
    }

    const controller = new AbortController();
    async function checkAccess() {
      try {
        const postAccess = (token: string) => fetch("/api/age-assurance/access", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({ ...(token ? { token } : {}), guildId }),
        });
        let response = await postAccess(savedToken);
        if (response.status === 404 && savedToken) {
          window.sessionStorage.removeItem(ageTokenStorageKey(guildId));
          savedToken = "";
          setAgeToken("");
          setVerificationUrl("");
          response = await postAccess("");
        }
        const result = await response.json();
        if (!response.ok || result?.success !== true) {
          throw new Error(result?.error || "Could not confirm Adult Emote Studio access.");
        }
        setAgeAllowed(result.allowed === true);
        if (result.allowed === true) {
          window.sessionStorage.removeItem(ageTokenStorageKey(guildId));
          setAgeToken("");
          setVerificationUrl("");
          setAgeMessage("Your saved k-ID session has the mature-language permission and verified adult age.");
        } else {
          setAgeMessage(result.status === "needs-session"
            ? "No k-ID session is linked to this account yet. Start the feature check once; the result will be reused when you return."
            : "Your saved k-ID session is active, but mature-language and verified adult access are not both enabled yet.");
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setAgeMessage(reason instanceof Error ? reason.message : "Could not confirm Adult Emote Studio access.");
        }
      }
    }
    void checkAccess();
    return () => controller.abort();
  }, [guildId]);

  async function startAgeCheck() {
    if (!guildId) return;
    setAgeBusy(true);
    setAgeMessage("");
    try {
      const response = await fetch("/api/age-assurance/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ guildId, surface: "adultFeatures" }),
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true || typeof result.token !== "string" ||
          typeof result.verificationUrl !== "string") {
        throw new Error(result?.error || "Could not start the k-ID check.");
      }
      window.sessionStorage.setItem(ageTokenStorageKey(guildId), result.token);
      setAgeToken(result.token);
      setAgeAllowed(false);
      setVerificationUrl(result.verificationUrl);
      setAgeMessage("Open the k-ID page in a new tab. Return here after finishing and check access.");
    } catch (reason) {
      setAgeMessage(reason instanceof Error ? reason.message : "Could not start the k-ID check.");
    } finally {
      setAgeBusy(false);
    }
  }

  async function checkAgeAccess() {
    if (!guildId) return;
    setAgeBusy(true);
    setAgeMessage("");
    try {
      const postAccess = (token: string) => fetch("/api/age-assurance/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ...(token ? { token } : {}), guildId }),
      });
      let response = await postAccess(ageToken);
      if (response.status === 404 && ageToken) {
        window.sessionStorage.removeItem(ageTokenStorageKey(guildId));
        setAgeToken("");
        setVerificationUrl("");
        response = await postAccess("");
      }
      const result = await response.json();
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.error || "Could not confirm Adult Emote Studio access.");
      }
      setAgeAllowed(result.allowed === true);
      if (result.allowed === true) {
        window.sessionStorage.removeItem(ageTokenStorageKey(guildId));
        setAgeToken("");
        setVerificationUrl("");
        setAgeMessage("Your saved k-ID session has the mature-language permission and verified adult age.");
      } else {
        setAgeMessage(result.status === "needs-session"
          ? "No k-ID session is linked to this account yet. Start the feature check once; the result will be reused when you return."
          : "k-ID has not confirmed both mature-language and verified adult access for this feature.");
      }
    } catch (reason) {
      setAgeMessage(reason instanceof Error ? reason.message : "Could not confirm Adult Emote Studio access.");
    } finally {
      setAgeBusy(false);
    }
  }

  const filteredEmojis = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return emojis.filter((emoji) => !needle || `${emoji.name} ${emoji.id}`.toLowerCase().includes(needle));
  }, [emojis, search]);

  function stageEmote() {
    if (!ageAllowed) {
      setStatus("Confirm k-ID access before staging adult-only assets.");
      return;
    }
    const cleanName = name.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
    const cleanSource = source.trim();
    if (cleanName.length < 2) {
      setStatus("Give the emote a name with at least two characters.");
      return;
    }
    if (!/^https?:\/\/\S+$/i.test(cleanSource)) {
      setStatus("Use the source URL that JED should process. The source is staged locally and not uploaded by this page.");
      return;
    }
    setStaged((current) => [{ id: makeId(), name: cleanName, source: cleanSource, target, category: category.trim() || "adult", createdAt: new Date().toISOString() }, ...current]);
    setName("");
    setSource("");
    setStatus("Staged privately. Nothing was published and no bot engine settings changed.");
  }

  async function copyJedCommand(item: StagedEmote) {
    if (!ageAllowed) {
      setStatus("Confirm k-ID access before viewing or copying adult-only JED commands.");
      return;
    }
    const command = `/jed grab source:${item.source}`;
    try {
      await navigator.clipboard.writeText(command);
      setStatus(`Copied the live JED command for ${item.name}. Run it in the adult-only Discord channel after review.`);
    } catch {
      setStatus(command);
    }
  }

  if (!guildId) {
    return <section style={shell}><div style={{ ...panel, color: "#ff9b9b" }}>Choose a server first, then open Adult Emote Studio again.</div></section>;
  }


  return (
    <section style={shell}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#ff718e", fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" }}>Private build room</div>
          <h1 style={{ margin: "6px 0", color: "#ff6b86", letterSpacing: "0.08em", textTransform: "uppercase" }}>Adult Emote Studio</h1>
          <p style={{ ...muted, maxWidth: 900, margin: 0 }}>
            A private staging page for adult-only emotes that keeps the working JED Discord engine separate. This page does not publish, expose a public gallery,
            upload files, or change JED settings. Use it to organize reviewed sources before running the existing JED flow in the correct Discord channel.
          </p>
        </div>
        <div style={{ border: "1px solid #a52a47", borderRadius: 999, color: "#ffb6c4", fontWeight: 900, padding: "9px 13px", whiteSpace: "nowrap" }}>
          18+ / PRIVATE / NOT PUBLISHED
        </div>
      </div>
      <div style={{ ...panel, marginTop: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div><strong>Need the server-wide emoji and sticker collection?</strong><div style={muted}>The JED Asset Library lists assets from all your servers where Possum Bot is installed.</div></div>
        <Link href={buildDashboardHref("/emotes")} style={{ ...button, textDecoration: "none", display: "inline-block" }}>Open JED Asset Library</Link>
      </div>

      <section style={{ ...panel, marginTop: 16, borderColor: ageAllowed ? "#386c48" : "#a52a47" }} aria-label="Adult Emote Studio age access">
        <div style={{ color: ageAllowed ? "#8ee0a8" : "#ff718e", fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {ageAllowed ? "Age access confirmed" : "Feature-level age check"}
        </div>
        <p style={{ ...muted, margin: "6px 0 10px" }}>
          {ageAllowed
            ? "k-ID confirmed the mature-language permission and civil adult age for this server. Adult Emote Studio data and tools are unlocked."
            : "The complete studio stays visible. Adult asset lists, staging, and JED commands stay locked until k-ID confirms the mature-language permission and civil adult age."}
        </p>
        {ageMessage ? <p role="status" style={{ color: "#ffc1ce", margin: "0 0 10px" }}>{ageMessage}</p> : null}
        {!ageAllowed ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={button} disabled={ageBusy} onClick={() => void checkAgeAccess()}>
              {ageBusy ? "Checking…" : "Check saved k-ID access"}
            </button>
            {!ageToken ? <button type="button" style={button} disabled={ageBusy} onClick={() => void startAgeCheck()}>
              {ageBusy ? "Starting…" : "Start a k-ID feature check"}
            </button> : null}
            {verificationUrl ? <a href={verificationUrl} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none", display: "inline-block" }}>Open k-ID check</a> : null}
          </div>
        ) : null}
        <p style={{ ...muted, fontSize: 13, margin: "10px 0 0" }}>
          Pending, failed, or unknown results never unlock adult assets. Public JED galleries and ordinary dashboard pages stay available.
        </p>
      </section>

      {message || status ? <div role="status" style={{ ...panel, marginTop: 16, color: "#ffc1ce" }}>{status || message}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 16 }}>
        <div style={panel}><div style={{ color: "#ff9ab0", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>JED runtime</div><div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{!ageAllowed ? "Locked until verified" : loading ? "Checking…" : config.enabled === false ? "Disabled" : "Online"}</div><div style={muted}>The live bot engine remains the source of truth.</div></div>
        <div style={panel}><div style={{ color: "#ff9ab0", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Guild</div><div style={{ fontSize: 20, fontWeight: 900, marginTop: 8 }}>{ageAllowed ? guildName || "Selected server" : "Selected server"}</div><div style={muted}>{ageAllowed ? `${emojis.length} existing Discord emotes available to inspect.` : "Guild assets appear after k-ID confirms access."}</div></div>
        <div style={panel}><div style={{ color: "#ff9ab0", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Release lock</div><div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, color: "#ffcc86" }}>Public publishing off</div><div style={muted}>Age verification, rights review, moderation, and takedown policy are still required before release.</div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(300px,0.8fr)", gap: 16, marginTop: 16 }}>
        <section style={panel}>
          <h2 style={{ marginTop: 0, color: "#ffd0d0" }}>Stage an adult-only emote</h2>
          <p style={muted}>This creates a browser-session staging record only. It does not send a file to the bot or Discord.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <label style={muted}>Emote name<input style={{ ...input, opacity: ageAllowed ? 1 : 0.55 }} disabled={!ageAllowed} value={name} onChange={(event) => setName(event.target.value)} placeholder="afterdark_wave" maxLength={32} /></label>
            <label style={muted}>Category<input style={{ ...input, opacity: ageAllowed ? 1 : 0.55 }} disabled={!ageAllowed} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="adult" maxLength={40} /></label>
            <label style={muted}>Target<select style={{ ...input, opacity: ageAllowed ? 1 : 0.55 }} disabled={!ageAllowed} value={target} onChange={(event) => setTarget(event.target.value as "emoji" | "sticker")}><option value="emoji">Emoji / GIF</option><option value="sticker">Sticker</option></select></label>
          </div>
          <label style={{ ...muted, display: "block", marginTop: 12 }}>Source URL for the existing JED flow<input style={{ ...input, opacity: ageAllowed ? 1 : 0.55 }} disabled={!ageAllowed} value={source} onChange={(event) => setSource(event.target.value)} placeholder="https://…/emote.gif" /></label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button type="button" style={{ ...button, opacity: ageAllowed ? 1 : 0.55 }} disabled={!ageAllowed} onClick={stageEmote}>Stage privately</button>
            <Link href={buildDashboardHref("/dashboard/jed")} style={{ ...button, textDecoration: "none", display: "inline-block" }}>Open live JED controls</Link>
          </div>
          <div style={{ ...muted, marginTop: 14, fontSize: 13 }}>
            {ageAllowed ? <>Live defaults: <strong>{String(config.defaultTarget || "auto")}</strong> target, <strong>{String(config.defaultVisibility || "public")}</strong> Discord response,
            batch limit <strong>{String(config.batchLimit || 1)}</strong>. These values are shown for reference only on this page.</> : "Live settings remain hidden until k-ID confirms access."}
          </div>
        </section>

        <section style={panel}>
          <h2 style={{ marginTop: 0, color: "#ffd0d0" }}>Release checklist</h2>
          <ul style={{ ...muted, paddingLeft: 20, marginBottom: 0 }}>
            <li>Independent 18+ verification is selected and tested.</li>
            <li>Uploader confirms redistribution rights.</li>
            <li>Human moderator reviews every asset.</li>
            <li>Private adult channel and role boundaries are verified.</li>
            <li>Report, takedown, retention, and audit procedures are documented.</li>
          </ul>
          <p style={{ color: "#ffcc86", fontSize: 13, lineHeight: 1.6, marginBottom: 0 }}>Until every item is complete, the studio remains staging-only.</p>
        </section>
      </div>

      <section style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div><h2 style={{ margin: 0, color: "#ffd0d0" }}>Private staging queue</h2><p style={{ ...muted, margin: "5px 0 0" }}>Saved in this browser session for this guild. Use the live JED command after your private review.</p></div>
          <button type="button" style={{ ...button, opacity: ageAllowed ? 1 : 0.55 }} disabled={!ageAllowed || loading} onClick={() => void reload()}>Refresh JED status</button>
        </div>
        {!ageAllowed ? <div style={{ ...muted, marginTop: 14 }}>Your private staging records stay hidden until k-ID confirms adult access.</div> : staged.length ? <div style={{ display: "grid", gap: 10, marginTop: 14 }}>{staged.map((item) => <div key={item.id} style={{ ...panel, padding: 13, background: "rgba(255,0,50,0.08)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong style={{ color: "#ffd0d0" }}>{item.name}</strong><span style={{ ...muted, marginLeft: 9 }}>{item.target} · {item.category}</span><div style={{ ...muted, fontSize: 12, overflowWrap: "anywhere", marginTop: 4 }}>{item.source}</div></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" style={button} onClick={() => void copyJedCommand(item)}>Copy JED command</button><button type="button" style={{ ...button, background: "#21070d" }} onClick={() => setStaged((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button></div></div></div>)}</div> : <div style={{ ...muted, marginTop: 14 }}>No private staging entries yet.</div>}
      </section>

      <section style={{ ...panel, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><h2 style={{ margin: 0, color: "#ffd0d0" }}>Existing guild emotes</h2><p style={{ ...muted, margin: "5px 0 0" }}>Read-only inventory from the live guild snapshot. JED behavior is not modified here.</p></div><input aria-label="Search guild emotes" disabled={!ageAllowed} style={{ ...input, maxWidth: 280, opacity: ageAllowed ? 1 : 0.55 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search emotes" /></div>
        {!ageAllowed ? <div style={{ ...muted, marginTop: 14 }}>Guild emote previews and names unlock after k-ID confirms adult access.</div> : filteredEmojis.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginTop: 14 }}>{filteredEmojis.map((emoji) => <div key={emoji.id} style={{ border: "1px solid #4e1a27", borderRadius: 12, padding: 10, background: "#0b0b0b" }}>{emojiImage(emoji) ? <img src={emojiImage(emoji)} alt={emoji.name} width={72} height={72} style={{ objectFit: "contain", display: "block", marginBottom: 8 }} /> : <div style={{ height: 72, color: "#8b5962" }}>No preview</div>}<strong style={{ color: "#ffd0d0", overflowWrap: "anywhere" }}>{emoji.name}</strong><div style={{ ...muted, fontSize: 12 }}>{emoji.animated ? "Animated" : "Static"}</div></div>)}</div> : <div style={{ ...muted, marginTop: 14 }}>No matching guild emotes were returned.</div>}
      </section>
    </section>
  );
}
