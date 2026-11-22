"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import CreatorOnlyGate from "@/components/possum/CreatorOnlyGate";
import OperatorLogPanel from "@/components/possum/OperatorLogPanel";
import { buildDashboardHref, readDashboardGuildId } from "@/lib/dashboardContext";

type InstalledGuild = {
  id: string;
  name: string;
  memberCount?: number;
  accessReason?: string | null;
  botPresent?: boolean;
};

type GuildSummary = {
  guild: InstalledGuild;
  enabledFeatures: string[];
  musicRoutes: number;
  ttsRoutes: number;
  ticketsActive: boolean;
  jedEnabled: boolean;
  rareSpawnEnabled: boolean;
  pokemonEnabled: boolean;
  channels: number;
  roles: number;
  error?: string;
};

const shell: CSSProperties = {
  padding: 18,
  color: "#ffd7d7",
};

const panel: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
  marginBottom: 12,
};

const pill: CSSProperties = {
  border: "1px solid rgba(255,90,90,0.35)",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "rgba(40,0,0,0.85)",
  color: "#ffd3d3",
};

const action: CSSProperties = {
  border: "1px solid #7a0000",
  borderRadius: 10,
  background: "#140707",
  color: "#ffd7d7",
  padding: "10px 12px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  textDecoration: "none",
  display: "inline-block",
};

async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json;
}

async function loadGuildSummary(guild: InstalledGuild): Promise<GuildSummary> {
  try {
    const [dashboardConfig, music, tts, tickets, jed, rareSpawn, pokemon, guildData] = await Promise.all([
      fetch(`/api/bot/dashboard-config?guildId=${encodeURIComponent(guild.id)}`, { cache: "no-store" }).then(readJson),
      fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(guild.id)}&engine=music`, { cache: "no-store" }).then(readJson),
      fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(guild.id)}&engine=tts`, { cache: "no-store" }).then(readJson),
      fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(guild.id)}&engine=tickets`, { cache: "no-store" }).then(readJson),
      fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(guild.id)}&engine=jed`, { cache: "no-store" }).then(readJson),
      fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(guild.id)}&engine=rareSpawn`, { cache: "no-store" }).then(readJson),
      fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(guild.id)}&engine=pokemon`, { cache: "no-store" }).then(readJson),
      fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guild.id)}`, { cache: "no-store" }).then(readJson),
    ]);

    const featureMap = dashboardConfig?.config?.features || {};
    const enabledFeatures = Object.entries(featureMap)
      .filter(([, value]) => value === true)
      .map(([key]) => key)
      .sort();

    return {
      guild,
      enabledFeatures,
      musicRoutes: Array.isArray(music?.config?.routes) ? music.config.routes.length : 0,
      ttsRoutes: Array.isArray(tts?.config?.routes) ? tts.config.routes.length : 0,
      ticketsActive: tickets?.config?.active !== false,
      jedEnabled: jed?.config?.enabled !== false,
      rareSpawnEnabled: rareSpawn?.config?.enabled !== false,
      pokemonEnabled: pokemon?.config?.enabled !== false,
      channels: Array.isArray(guildData?.channels) ? guildData.channels.length : 0,
      roles: Array.isArray(guildData?.roles) ? guildData.roles.length : 0,
    };
  } catch (error: any) {
    return {
      guild,
      enabledFeatures: [],
      musicRoutes: 0,
      ttsRoutes: 0,
      ticketsActive: false,
      jedEnabled: false,
      rareSpawnEnabled: false,
      pokemonEnabled: false,
      channels: 0,
      roles: 0,
      error: error?.message || "Failed to load guild summary.",
    };
  }
}

function buildGuildHref(href: string, guildId: string) {
  const base = buildDashboardHref(href, { includeGuild: false });
  const url = new URL(base, "http://dashboard.local");
  if (guildId) url.searchParams.set("guildId", guildId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function CreatorMasterClient() {
  const [activeGuildId, setActiveGuildId] = useState("");
  const [guilds, setGuilds] = useState<InstalledGuild[]>([]);
  const [summaries, setSummaries] = useState<GuildSummary[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setActiveGuildId(readDashboardGuildId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [guildPayload, healthPayload] = await Promise.all([
          fetch("/api/guilds/installed", { cache: "no-store" }).then(readJson),
          fetch("/api/bot/engine-health", { cache: "no-store" }).then(readJson).catch(() => null),
        ]);
        if (cancelled) return;
        const nextGuilds = Array.isArray(guildPayload?.guilds) ? guildPayload.guilds : [];
        setGuilds(nextGuilds);
        setHealth(healthPayload);
        const nextSummaries = await Promise.all(nextGuilds.map((guild: InstalledGuild) => loadGuildSummary(guild)));
        if (cancelled) return;
        setSummaries(nextSummaries);
      } catch (error: any) {
        if (!cancelled) {
          setMessage(error?.message || "Failed to load creator control data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, item) => {
        if (!item.error) {
          acc.musicRoutes += item.musicRoutes;
          acc.ttsRoutes += item.ttsRoutes;
          acc.ticketGuilds += item.ticketsActive ? 1 : 0;
          acc.jedGuilds += item.jedEnabled ? 1 : 0;
        }
        return acc;
      },
      { musicRoutes: 0, ttsRoutes: 0, ticketGuilds: 0, jedGuilds: 0 }
    );
  }, [summaries]);

  return (
    <CreatorOnlyGate title="Master Control">
      <section style={shell}>
        <h1 style={{ marginTop: 0, color: "#ff4d4d", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Creator Master Control
        </h1>
        <p style={{ opacity: 0.9, maxWidth: 980, lineHeight: 1.6 }}>
          One place to see what is enabled where, how many routes are live, and which guild needs attention before you bounce between pages.
        </p>
        {message ? <div style={{ ...panel, color: "#ff9c9c" }}>{message}</div> : null}

        <div style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff8c8c" }}>Installed Guilds</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{guilds.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff8c8c" }}>Music Routes</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.musicRoutes}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff8c8c" }}>TTS Routes</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.ttsRoutes}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff8c8c" }}>Ticket Guilds</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.ticketGuilds}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff8c8c" }}>JED Guilds</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.jedGuilds}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff8c8c" }}>Bot Uptime</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{health?.uptimeSec ? `${Math.round(Number(health.uptimeSec) / 60)}m` : "n/a"}</div>
          </div>
        </div>

        {loading ? <div style={panel}>Loading creator view...</div> : null}

        {summaries.map((item) => (
          <section key={item.guild.id} style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#ff8c8c" }}>
                  {item.guild.id === activeGuildId ? "Active Guild" : "Guild"}
                </div>
                <h2 style={{ margin: "6px 0 4px", color: "#ffdede" }}>{item.guild.name}</h2>
                <div style={{ color: "#ffb9b9", fontSize: 13 }}>
                  {item.guild.id} {item.guild.memberCount ? `- ${item.guild.memberCount} members` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={buildGuildHref("/dashboard", item.guild.id)} style={action}>Open Guild</Link>
                <Link href={buildGuildHref("/dashboard/system-health", item.guild.id)} style={action}>Health</Link>
                <Link href={buildGuildHref("/dashboard/channels", item.guild.id)} style={action}>Channels</Link>
              </div>
            </div>

            {item.error ? (
              <div style={{ marginTop: 12, color: "#ff9898" }}>{item.error}</div>
            ) : (
              <>
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={pill}>music routes {item.musicRoutes}</span>
                  <span style={pill}>tts routes {item.ttsRoutes}</span>
                  <span style={pill}>tickets {item.ticketsActive ? "on" : "off"}</span>
                  <span style={pill}>jed {item.jedEnabled ? "on" : "off"}</span>
                  <span style={pill}>rare spawns {item.rareSpawnEnabled ? "on" : "off"}</span>
                  <span style={pill}>pokemon {item.pokemonEnabled ? "on" : "off"}</span>
                  <span style={pill}>channels {item.channels}</span>
                  <span style={pill}>roles {item.roles}</span>
                </div>
                <div style={{ marginTop: 14, color: "#ffb7b7", fontSize: 13, lineHeight: 1.6 }}>
                  Enabled feature flags: {item.enabledFeatures.length ? item.enabledFeatures.join(", ") : "none reported"}
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href={buildGuildHref("/dashboard/music", item.guild.id)} style={action}>Music</Link>
                  <Link href={buildGuildHref("/dashboard/tts", item.guild.id)} style={action}>TTS</Link>
                  <Link href={buildGuildHref("/dashboard/jed", item.guild.id)} style={action}>JED</Link>
                  <Link href={buildGuildHref("/dashboard/rarespawn", item.guild.id)} style={action}>Rare Spawns</Link>
                </div>
              </>
            )}
          </section>
        ))}

        {activeGuildId ? (
          <OperatorLogPanel guildId={activeGuildId} title="Active Guild Operator Logs" limit={60} />
        ) : null}
      </section>
    </CreatorOnlyGate>
  );
}
