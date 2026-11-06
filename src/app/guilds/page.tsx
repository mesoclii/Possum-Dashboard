"use client";

import { useEffect, useMemo, useState } from "react";
import { FALLBACK_GUILD_NAMES } from "@/lib/dashboardOwner";
import { buildPublicInviteUrl } from "@/lib/publicLinks";

type Guild = {
  id: string;
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
  botPresent?: boolean;
  memberCount?: number | null;
  manageable?: boolean;
  owner?: boolean;
};

type PolicyState = {
  primaryGuildId: string;
  gamesBaselineGuildId: string;
};

type DiscordUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
};

function badgeStyle(kind: "primary" | "ready" | "missing") {
  if (kind === "primary") {
    return {
      border: "1px solid #ff2bd6",
      color: "#ffd1f5",
      background: "rgba(255,43,214,0.22)",
    } as const;
  }

  if (kind === "ready") {
    return {
      border: "1px solid #ff2a4d",
      color: "#ffd1f5",
      background: "rgba(255,42,77,0.2)",
    } as const;
  }

  if (kind === "missing") {
    return {
      border: "1px solid #ff2a4d",
      color: "#ffd1f5",
      background: "rgba(255,42,77,0.2)",
    } as const;
  }

  return {
    border: "1px solid #7a0000",
    color: "#ffd6d6",
    background: "rgba(120,0,0,0.18)",
  } as const;
}

function actionButtonStyle(tone: "primary" | "secondary" | "oauth") {
  if (tone === "primary") {
    return {
      border: "1px solid #ff3b3b",
      color: "#fff4f4",
      background: "rgba(140,0,0,0.34)",
    } as const;
  }

  if (tone === "oauth") {
    return {
      border: "1px solid #ff2a4d",
      color: "#ffd1f5",
      background: "rgba(255,43,214,0.22)",
    } as const;
  }

  return {
    border: "1px solid rgba(255,0,0,0.34)",
    color: "#ffe2e2",
    background: "rgba(12,0,0,0.72)",
  } as const;
}

function buildInviteUrl(baseUrl: string, guildId: string) {
  if (!baseUrl) return "";
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("guildId", guildId);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

function resolveGuildIcon(guild: Guild) {
  if (guild.iconUrl) return guild.iconUrl;
  if (guild.icon) return guild.icon;
  return null;
}

export default function GuildsPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const baseInviteUrl = useMemo(() => buildPublicInviteUrl(), []);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [oauthLoggedIn, setOauthLoggedIn] = useState(false);
  const [oauthUser, setOauthUser] = useState<DiscordUser | null>(null);
  const [policy, setPolicy] = useState<PolicyState>({
    primaryGuildId: "1431799056211906582",
    gamesBaselineGuildId: "1336178965202599936",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const userId = String(
        params.get("userId") ||
          params.get("uid") ||
          localStorage.getItem("dashboardUserId") ||
          ""
      ).trim();
      const roleIds = String(
        params.get("roleIds") ||
          params.get("roles") ||
          localStorage.getItem("dashboardUserRoleIds") ||
          ""
      ).trim();

      if (userId) localStorage.setItem("dashboardUserId", userId);
      if (roleIds) localStorage.setItem("dashboardUserRoleIds", roleIds);
    }

    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const policyRes = await fetch("/api/bot/enforce-stock-policy?dryRun=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: true }),
        }).catch(() => null);

        if (policyRes) {
          const p = await policyRes.json().catch(() => ({}));
          if (p?.primaryGuildId) {
            setPolicy({
              primaryGuildId: String(p.primaryGuildId),
              gamesBaselineGuildId: String(p.gamesBaselineGuildId || "1336178965202599936"),
            });
          }
        }

        const [oauthRes, installedRes] = await Promise.all([
          fetch("/api/guilds", { cache: "no-store" }).catch(() => null),
          fetch("/api/guilds/installed", { cache: "no-store" }).catch(() => null),
        ]);

        const oauthJson = oauthRes ? await oauthRes.json().catch(() => ({})) : {};
        const installedJson = installedRes ? await installedRes.json().catch(() => ({})) : {};

        const oauthUserValue =
          oauthJson?.user && typeof oauthJson.user.id === "string"
            ? {
                id: String(oauthJson.user.id),
                username: String(oauthJson.user.username || "Discord User"),
                globalName: oauthJson.user.globalName ?? null,
                avatar: oauthJson.user.avatar ?? null,
              }
            : null;

        setOauthConfigured(Boolean(oauthJson?.oauthConfigured));
        setOauthLoggedIn(Boolean(oauthJson?.loggedIn));
        setOauthUser(oauthUserValue);

        if (oauthUserValue?.id && typeof window !== "undefined") {
          localStorage.setItem("dashboardUserId", oauthUserValue.id);
        }

        const merged = new Map<string, Guild>();

        const installedGuilds = Array.isArray(installedJson?.guilds) ? installedJson.guilds : [];
        for (const guild of installedGuilds) {
          const id = String(guild?.id || "").trim();
          if (!id) continue;
          merged.set(id, {
            id,
            name: String(guild?.name || id),
            icon: guild?.icon || null,
            botPresent: guild?.botPresent !== false,
            memberCount: Number(guild?.memberCount || 0),
            manageable: true,
          });
        }

        const adminGuilds = Array.isArray(oauthJson?.guilds) ? oauthJson.guilds : [];
        for (const guild of adminGuilds) {
          const id = String(guild?.id || "").trim();
          if (!id) continue;
          const existing = merged.get(id);
          merged.set(id, {
            ...existing,
            id,
            name: String(guild?.name || existing?.name || id),
            icon: guild?.icon || existing?.icon || null,
            iconUrl: guild?.iconUrl || existing?.iconUrl || null,
            botPresent: existing?.botPresent ?? false,
            memberCount: existing?.memberCount ?? null,
            manageable: true,
            owner: guild?.owner === true,
          });
        }

        // Always compute invite URLs client-side to avoid stale OAuth params.

        for (const [guildId, guildName] of Object.entries(FALLBACK_GUILD_NAMES)) {
          if (!merged.has(guildId)) {
            merged.set(guildId, {
              id: guildId,
              name: guildName,
              icon: null,
              botPresent: false,
              manageable: false,
            });
          }
        }

        const mergedGuilds = [...merged.values()];
        setGuilds(mergedGuilds);

        if (installedRes && !installedRes.ok) {
          setMsg(installedJson?.error || `Installed guild API failed (${installedRes.status})`);
        } else if (oauthRes && !oauthRes.ok && oauthJson?.error) {
          setMsg(oauthJson.error);
        }
      } catch (e: any) {
        setMsg(e?.message || "Failed to load guilds.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const orderedGuilds = useMemo(() => {
    return [...guilds].sort((a, b) => {
      const rank = (guildId: string) => {
        if (guildId === policy.primaryGuildId) return 0;
        if (guildId === policy.gamesBaselineGuildId) return 1;
        return 2;
      };
      const ap = rank(a.id);
      const bp = rank(b.id);
      if (ap !== bp) return ap - bp;
      if ((a.botPresent ? 1 : 0) !== (b.botPresent ? 1 : 0)) {
        return a.botPresent ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [guilds, policy.gamesBaselineGuildId, policy.primaryGuildId]);

  const summary = useMemo(() => {
    const installed = orderedGuilds.filter((guild) => guild.botPresent !== false).length;
    const missing = orderedGuilds.filter((guild) => guild.botPresent === false && guild.manageable).length;
    return {
      installed,
      missing,
      total: orderedGuilds.length,
    };
  }, [orderedGuilds]);

  function openGuild(guildId: string, guildName: string) {
    localStorage.setItem("activeGuildId", guildId);
    localStorage.setItem("activeGuildName", guildName || guildId);

    const userId = String(localStorage.getItem("dashboardUserId") || "").trim();
    const roleIds = String(localStorage.getItem("dashboardUserRoleIds") || "").trim();
    const next = new URLSearchParams({ guildId });
    if (userId) next.set("userId", userId);
    if (roleIds) next.set("roleIds", roleIds);

    window.location.href = `/dashboard?${next.toString()}`;
  }

  return (
    <div
      style={{
        color: "#ff5252",
        minHeight: "100vh",
        padding: 28,
        background: "transparent",
      }}
    >
      <div style={{ maxWidth: 1520, margin: "0 auto" }}>
        <h1
          style={{
            marginTop: 0,
            marginBottom: 10,
            fontSize: "clamp(3.2rem, 8vw, 5.4rem)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            lineHeight: 0.92,
          }}
        >
          Select Guild
        </h1>
        <p
          style={{
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.92,
            fontSize: 14,
            maxWidth: 1180,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Saviors keeps the full original baseline untouched. Other installed guilds come in standard-ready so owners
          can finish setup without resetting Saviors. Use this page only to choose a guild or invite the bot.
        </p>

        {loading ? <p style={{ color: "#ffd7d7" }}>Loading...</p> : null}
        {msg ? <p style={{ color: "#ff9a9a" }}>{msg}</p> : null}

        <div
          style={{
            marginBottom: 22,
            border: "1px solid #6f0000",
            borderRadius: 20,
            background: "linear-gradient(180deg, rgba(120,0,0,0.14), rgba(0,0,0,0.68))",
            padding: 20,
            color: "#ffd7d7",
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1.25 }}>
              {oauthLoggedIn
                ? `Discord connected as ${oauthUser?.globalName || oauthUser?.username || oauthUser?.id}`
                : "Login with Discord to unlock admin guild discovery"}
            </div>
            <div style={{ fontSize: 14, opacity: 0.82, marginTop: 8, lineHeight: 1.65, maxWidth: 900 }}>
              {oauthConfigured
                ? oauthLoggedIn
                  ? "Open shows guilds the bot is already in. Add Bot shows servers you manage that do not have Possum yet."
                  : "Once you log in, this page can show servers you manage even if Possum has not been invited yet."
                : "Discord OAuth is not configured in the dashboard env yet, so only bot-installed guilds can be shown right now."}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {[
                `Installed ${summary.installed}`,
                `Bot Missing ${summary.missing}`,
                `Visible ${summary.total}`,
              ].map((text) => (
                <span
                  key={text}
                  style={{
                    display: "inline-block",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    border: "1px solid rgba(255,0,0,0.28)",
                    background: "rgba(120,0,0,0.18)",
                  }}
                >
                  {text}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {oauthConfigured && !oauthLoggedIn ? (
              <a
                href="/api/auth/discord/login"
                style={{
                  borderRadius: 999,
                  padding: "10px 16px",
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  ...actionButtonStyle("oauth"),
                }}
              >
                Login With Discord
              </a>
            ) : null}

            {oauthConfigured && oauthLoggedIn ? (
              <a
                href="/api/auth/logout"
                style={{
                  borderRadius: 999,
                  padding: "10px 16px",
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  ...actionButtonStyle("secondary"),
                }}
              >
                Logout
              </a>
            ) : null}

            {baseInviteUrl ? (
              <a
                href={baseInviteUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  borderRadius: 999,
                  padding: "10px 16px",
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  ...actionButtonStyle("primary"),
                }}
              >
                Invite Bot
              </a>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))",
            gap: 18,
          }}
        >
          {orderedGuilds.map((guild) => {
            const isPrimary = guild.id === policy.primaryGuildId;
            const isPublicBaseline = guild.id === policy.gamesBaselineGuildId;
            const isInstalled = guild.botPresent !== false;
            const iconUrl = resolveGuildIcon(guild);
            const inviteHref = buildInviteUrl(baseInviteUrl, guild.id);

            const baselineLabel = isPrimary
              ? "Primary Baseline"
              : isPublicBaseline
                ? "Public Ready"
                : "Standard Ready";

            return (
              <div
                key={guild.id}
                style={{
                  textAlign: "left",
                  border: "1px solid #6f0000",
                  borderRadius: 20,
                  background: "linear-gradient(180deg, rgba(120,0,0,0.14), rgba(0,0,0,0.72))",
                  color: "#ffd7d7",
                  padding: 20,
                  minHeight: 280,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
                  <div
                    style={{
                      width: 66,
                      height: 66,
                      borderRadius: 18,
                      border: "1px solid rgba(255,0,0,0.28)",
                      background: iconUrl
                        ? `center / cover no-repeat url(${iconUrl})`
                        : "linear-gradient(135deg, rgba(100,0,0,0.6), rgba(20,20,20,0.9))",
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, marginBottom: 4, fontSize: 24, lineHeight: 1.2 }}>{guild.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>Guild {guild.id}</div>
                  </div>
                </div>

                <div style={{ fontSize: 14, opacity: 0.86, minHeight: 46, lineHeight: 1.6 }}>
                  {isInstalled
                    ? guild.memberCount
                      ? `${guild.memberCount} members`
                      : "Bot connected and ready for setup."
                    : guild.manageable
                      ? "You manage this server. Add the bot first, then finish setup from the dashboard."
                      : "This guild is not currently available for dashboard entry."}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  {isInstalled ? (
                    <span
                      style={{
                        display: "inline-block",
                        borderRadius: 999,
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        ...badgeStyle(isPrimary ? "primary" : "ready"),
                      }}
                    >
                      {baselineLabel}
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        borderRadius: 999,
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        ...badgeStyle("missing"),
                      }}
                    >
                      {guild.manageable ? "Bot Missing" : "Unavailable"}
                    </span>
                  )}
                </div>

                <div style={{ marginTop: "auto", display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 18 }}>
                  {isInstalled ? (
                    <button
                      onClick={() => openGuild(guild.id, guild.name)}
                      style={{
                        borderRadius: 999,
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        ...actionButtonStyle("secondary"),
                      }}
                    >
                      Open
                    </button>
                  ) : inviteHref ? (
                    <a
                      href={inviteHref}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        borderRadius: 999,
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 900,
                        textDecoration: "none",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        ...actionButtonStyle(guild.manageable ? "oauth" : "secondary"),
                      }}
                    >
                      Add Bot
                    </a>
                  ) : oauthConfigured && !oauthLoggedIn ? (
                    <a
                      href="/api/auth/discord/login"
                      style={{
                        borderRadius: 999,
                        padding: "10px 16px",
                        fontSize: 12,
                        fontWeight: 900,
                        textDecoration: "none",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        ...actionButtonStyle("oauth"),
                      }}
                    >
                      Login
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
