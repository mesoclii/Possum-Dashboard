"use client";

import { useEffect, useRef, useState } from "react";

type Data = {
  providers: { id: string; status: string }[];
  guilds: { id: string; name: string }[];
  guildsVerified: boolean;
  identityType: "browser" | "discord";
  accounts: { provider: string; providerId: string; revision: string | null; label: string; url: string }[];
  visibility: { provider: string; guildId: string }[];
};
type DirectoryEntry = { userId: string; provider: string; label: string; url: string };
const names: Record<string, string> = { facebook: "Facebook", x: "X", youtube: "YouTube", twitch: "Twitch", instagram: "Instagram", tiktok: "TikTok", reddit: "Reddit" };
const directoryProviders = ["twitch", "youtube", "reddit", "x", "tiktok"];

export default function PersonalSocialPage() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState<DirectoryEntry[] | null>(null);
  const [selected, setSelected] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [directoryBusy, setDirectoryBusy] = useState(false);
  const directoryRequest = useRef(0);
  const initialGuild = useRef("");
  const [returnTo, setReturnTo] = useState("/personal-social");
  const initialProvider = useRef("");
  const [directoryProvider, setDirectoryProvider] = useState("");

  async function load() {
    let response = await fetch("/api/personal-social", { cache: "no-store" });
    if (response.status === 401) {
      const identityResponse = await fetch("/api/personal-social/guest", { cache: "no-store" });
      const identity = await identityResponse.json();
      if (!identityResponse.ok) throw new Error(identity.error || "Could not create a private provider-linking session.");
      response = await fetch("/api/personal-social", { cache: "no-store" });
    }
    const body = await response.json();
    if (!response.ok) { setMessage(body.error || "Could not load accounts."); return; }
    setData(body);
    const guildId = initialGuild.current;
    initialGuild.current = "";
    if (guildId && body.guildsVerified && body.guilds.some((guild: { id: string }) => guild.id === guildId)) {
      void showDirectory(guildId, undefined, initialProvider.current);
    }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guildId = params.get("guildId") || "";
    const requestedProvider = params.get("provider") || "";
    const provider = directoryProviders.includes(requestedProvider) ? requestedProvider : "";
    initialProvider.current = provider;
    setDirectoryProvider(provider);
    const returnParams = new URLSearchParams();
    if (/^\d{1,20}$/.test(guildId)) {
      initialGuild.current = guildId;
      returnParams.set("guildId", guildId);
    }
    if (provider) returnParams.set("provider", provider);
    const query = returnParams.toString();
    if (query) setReturnTo(`/personal-social?${query}`);
    const result = params.get("result");
    if (result) {
      const messages: Record<string, string> = { connected: "Provider profile verified. It remains private unless you explicitly choose to share it.", invalid: "The connection request expired or did not match your session. Try again.", cancelled: "Connection was cancelled.", failed: "Profile verification failed. Try again." };
      setMessage(messages[result] || "Connection could not be completed.");
      window.history.replaceState(null, "", "/personal-social");
    }
    void load().catch(() => setMessage("Could not load accounts."));
  }, []);

  async function action(input: object) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/personal-social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(body.error);
      }
      directoryRequest.current++;
      setDirectory(null);
      setNextCursor(null);
      setDirectoryBusy(false);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function connect(provider: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/personal-social/${provider}/start`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign(body.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); setBusy(false); }
  }
  async function showDirectory(guildId: string, cursor?: string, provider = directoryProvider) {
    const requestId = ++directoryRequest.current;
    if (!cursor) { setSelected(guildId); setDirectory(null); setNextCursor(null); }
    setMessage("");
    if (!guildId) { setDirectoryBusy(false); return; }
    setDirectoryBusy(true);
    try {
      const params = new URLSearchParams({ guildId });
      if (provider) params.set("provider", provider);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/personal-social?${params}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (requestId !== directoryRequest.current) return;
      setDirectory((current) => cursor ? [...(current || []), ...body.accounts] : body.accounts);
      setNextCursor(body.nextCursor);
    } catch (error) {
      if (requestId === directoryRequest.current) {
        setDirectory(null);
        setNextCursor(null);
        setMessage(error instanceof Error ? error.message : "Could not load directory.");
      }
    } finally { if (requestId === directoryRequest.current) setDirectoryBusy(false); }
  }

  return <main style={{ maxWidth: 850, margin: "auto", padding: 28, color: "#ffe2e2" }}>
    <a href="/gaming">Back to Gaming Hub</a> · <a href="/guilds">Back to servers</a>
    <h1>Personal social accounts</h1>
    <p>You can connect supported providers without Discord. Linked accounts stay private until you choose to share them with a server or separately select them on your public Gaming Hub profile. Public Gaming Hub sharing is visible to everyone online and can be removed there at any time.</p>
    <p>Only accounts verified with the provider are linked. No manually entered URLs are treated as verified.</p>
    {message && <p role="alert">{message} {message.includes("Sign in") && <a href={`/api/auth/discord/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a>}</p>}
    {!data && !message && <p>Loading…</p>}
    {data?.identityType === "browser" && <p>You are using a private browser profile. Discord sign-in is optional. <a href="/gaming" style={{ color: "#ffc4d9" }}>Return to the public Gaming Hub</a> to choose which verified links, if any, to publish.</p>}
    {data?.identityType === "discord" && !data.guildsVerified && <p>Discord membership could not be checked. Existing sharing choices can still be removed below.</p>}
    {data?.providers.map((provider) => {
      const account = data.accounts.find((entry) => entry.provider === provider.id);
      return <section key={provider.id} style={{ border: "1px solid #783333", borderRadius: 12, margin: "16px 0", padding: 16 }}>
        <h2>{names[provider.id]}</h2>
        {provider.id === "x" && provider.status !== "unsupported" && <p>X requires profile and post-read permissions, including protected posts. We request your profile only; X API use may incur operator charges.</p>}
        {provider.id === "tiktok" && provider.status !== "unsupported" && <p>TikTok requires basic and profile permissions; profile access may require provider approval.</p>}
        {account ? <>
          <p>Verified when linked: <a href={account.url} target="_blank" rel="noreferrer">{account.label}</a> (not a live connection)</p>
          {provider.status === "available" && <button disabled={busy} onClick={() => void connect(provider.id)}>Reconnect with {names[provider.id]}</button>}
          <p>Reconnect to refresh this profile. Sharing is kept for the same account and removed if you connect a different account.</p>
          <button disabled={busy} onClick={() => void action({ action: "disconnect", provider: provider.id })}>Disconnect and remove all sharing</button>
          {data.identityType === "discord" && <p>Show this profile to members of:</p>}
          {data.identityType === "discord" && !account.revision && <p>Sharing is unavailable until this account is refreshed. Existing sharing can still be removed.</p>}
          {data.identityType === "discord" && data.guilds.length === 0 && <p>No servers available.</p>}
          {data.identityType === "discord" && data.guilds.map((guild) => <label key={guild.id} style={{ display: "block", margin: "8px 0" }}>
            <input type="checkbox" disabled={busy || (!account.revision && !data.visibility.some((v) => v.provider === provider.id && v.guildId === guild.id))} checked={data.visibility.some((v) => v.provider === provider.id && v.guildId === guild.id)}
              onChange={(event) => void action({ action: "visibility", provider: provider.id, expectedProviderId: account.providerId, expectedRevision: account.revision, guildId: guild.id, visible: event.target.checked })} /> {guild.name}
          </label>)}
          {data.identityType === "discord" && data.visibility.filter((entry) => entry.provider === provider.id && !data.guilds.some((guild) => guild.id === entry.guildId)).map((entry) =>
            <p key={entry.guildId}>Unlisted server (ID {entry.guildId}){" "}
              <button disabled={busy} onClick={() => void action({ action: "visibility", provider: provider.id, guildId: entry.guildId, visible: false })}>Stop sharing</button>
            </p>)}
        </> : <>
          {provider.status === "available" ? <button disabled={busy} onClick={() => void connect(provider.id)}>Connect with {names[provider.id]}</button>
            : <p>{provider.status === "unconfigured" ? "Not configured by the operator." : provider.status === "approval-required" ? "Not enabled; provider approval or operator review may be required." : "Not supported yet."}</p>}
          {provider.status !== "unsupported" && <button disabled={busy} onClick={() => void action({ action: "disconnect", provider: provider.id })}>Cancel pending connection</button>}
        </>}
      </section>;
    })}
    {data?.identityType === "discord" && <section>
      <h2>Server member directory</h2>
      <p>Only explicitly shared profiles are shown, and only while both members can be verified. A member may need to sign in again to appear. More pages may be available even when none are shown on this page.</p>
      <label>Server: <select value={selected} onChange={(event) => void showDirectory(event.target.value)}><option value="">Choose a server</option>{data.guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label>
      <label> Platform: <select value={directoryProvider} onChange={(event) => { const provider = event.target.value; setDirectoryProvider(provider); if (selected) void showDirectory(selected, undefined, provider); }}><option value="">All platforms</option>{directoryProviders.map((provider) => <option key={provider} value={provider}>{names[provider]}</option>)}</select></label>
      {directory && (directory.length ? <ul>{directory.map((entry) => <li key={`${entry.userId}-${entry.provider}`}>Discord ID {entry.userId}: {names[entry.provider]} — <a href={entry.url} target="_blank" rel="noreferrer">{entry.label}</a></li>)}</ul> : <p>No verified shared profiles are available.</p>)}
      {nextCursor && <button disabled={directoryBusy} onClick={() => void showDirectory(selected, nextCursor)}>Load more</button>}
    </section>}
  </main>;
}
