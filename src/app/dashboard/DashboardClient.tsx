"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildDashboardHref, readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";
import { SAVIORS_GUILD_ID } from "@/lib/dashboard/engineRegistry";
import { useDashboardSessionState } from "@/components/possum/useDashboardSessionState";
import { isPremiumEnforcementEnabled } from "@/lib/premiumMode";
import { getDashboardNavSections, getSectionSlug } from "@/lib/dashboard/navigation";

type ToggleController = {
  read: (guildId: string, userId?: string) => Promise<boolean>;
  write: (guildId: string, next: boolean, userId?: string) => Promise<void>;
  readLocal?: (dashboardConfig: any, engineConfigs: Record<string, any>) => boolean;
};

type Card = {
  href: string;
  title: string;
  description: string;
  toggle?: ToggleController;
  goOnly?: boolean;
  goLabel?: string;
  premiumRequired?: boolean;
  creatorOnly?: boolean;
  routeKey?: string;
  state?: ToggleState;
};

type ToggleState = {
  value: boolean | null;
  saving: boolean;
  error?: string;
};

type DashboardSection =
  | "Guild Control"
  | "Automation"
  | "Utilities"
  | "Social Alerts"
  | "Security"
  | "Economy"
  | "Fun + Games"
  | "Premium";

const SECTION_ORDER: DashboardSection[] = [
  "Guild Control",
  "Automation",
  "Utilities",
  "Social Alerts",
  "Security",
  "Economy",
  "Fun + Games",
  "Premium",
];

function readBoolPath(input: unknown, path: string[], fallback = false): boolean {
  let current: any = input;
  for (const key of path) {
    if (!current || typeof current !== "object") return fallback;
    current = current[key];
  }
  return typeof current === "boolean" ? current : fallback;
}

function buildPatch(path: string[], value: boolean) {
  const root: Record<string, any> = {};
  let current: Record<string, any> = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    current[path[index]] = {};
    current = current[path[index]];
  }
  current[path[path.length - 1]] = value;
  return root;
}

async function readJsonOrThrow(res: Response) {
  let text = "";
  try {
    text = await res.text();
  } catch (error: any) {
    if (error?.name === "AbortError" || /aborted|timed out/i.test(String(error?.message || ""))) {
      throw new Error("Dashboard response stream was interrupted before it finished.");
    }
    throw error;
  }
  const json = text ? JSON.parse(text) : {};
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json;
}

async function fetchJsonOrThrow(url: string, init: RequestInit = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      cache: init.cache ?? "no-store",
      signal: controller.signal,
    });
    return await readJsonOrThrow(res);
  } catch (error: any) {
    if (error?.name === "AbortError" || /aborted|timed out/i.test(String(error?.message || ""))) {
      throw new Error(`Dashboard request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const DASHBOARD_CONFIG_TTL_MS = 60_000;
const ENGINE_CONFIG_TTL_MS = 30_000;
const SUBSCRIPTION_STATUS_TTL_MS = 60_000;

const dashboardConfigCache = new Map<string, { value: any; expiresAt: number }>();
const engineConfigCache = new Map<string, { value: any; expiresAt: number }>();
const allEngineConfigCache = new Map<string, { value: Record<string, any>; expiresAt: number }>();
const subscriptionStatusCache = new Map<string, { value: { active: boolean; plan: string; developerBypass?: boolean }; expiresAt: number }>();
const dashboardConfigInflight = new Map<string, Promise<any>>();
const engineConfigInflight = new Map<string, Promise<any>>();
const allEngineConfigInflight = new Map<string, Promise<Record<string, any>>>();
const subscriptionStatusInflight = new Map<string, Promise<{ active: boolean; plan: string; developerBypass?: boolean }>>();

async function getDashboardConfig(guildId: string, userId = "") {
  const actorUserId = String(userId || "").trim();
  const cacheKey = `${String(guildId || "").trim()}:${actorUserId}`;
  const cached = dashboardConfigCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (dashboardConfigInflight.has(cacheKey)) {
    return dashboardConfigInflight.get(cacheKey);
  }
  const request = (async () => {
    const json = await fetchJsonOrThrow(`/api/bot/dashboard-config?guildId=${encodeURIComponent(guildId)}${actorUserId ? `&userId=${encodeURIComponent(actorUserId)}` : ""}`);
    const value = json?.config || {};
    dashboardConfigCache.set(cacheKey, { value, expiresAt: Date.now() + DASHBOARD_CONFIG_TTL_MS });
    dashboardConfigInflight.delete(cacheKey);
    return value;
  })().catch((error) => {
    dashboardConfigInflight.delete(cacheKey);
    throw error;
  });
  dashboardConfigInflight.set(cacheKey, request);
  return request;
}

async function saveDashboardFeature(guildId: string, key: string, value: boolean, userId = "") {
  await fetchJsonOrThrow("/api/bot/dashboard-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, patch: { features: { [key]: value } }, userId }),
  });
  for (const cacheKey of dashboardConfigCache.keys()) {
    if (cacheKey.startsWith(`${String(guildId || "").trim()}:`)) {
      dashboardConfigCache.delete(cacheKey);
    }
  }
}

async function getEngineConfig(guildId: string, engine: string, userId = "") {
  const actorUserId = String(userId || "").trim();
  const cacheKey = `${String(guildId || "").trim()}:${String(engine || "").trim()}:${actorUserId}`;
  const cached = engineConfigCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (engineConfigInflight.has(cacheKey)) {
    return engineConfigInflight.get(cacheKey);
  }
  const request = (async () => {
    const json = await fetchJsonOrThrow(
      `/api/runtime/engine?guildId=${encodeURIComponent(guildId)}&engine=${encodeURIComponent(engine)}${actorUserId ? `&userId=${encodeURIComponent(actorUserId)}` : ""}`
    );
    const value = json?.config || {};
    engineConfigCache.set(cacheKey, { value, expiresAt: Date.now() + ENGINE_CONFIG_TTL_MS });
    engineConfigInflight.delete(cacheKey);
    return value;
  })().catch((error) => {
    engineConfigInflight.delete(cacheKey);
    throw error;
  });
  engineConfigInflight.set(cacheKey, request);
  return request;
}

async function getAllEngineConfigs(guildId: string, userId = "") {
  const actorUserId = String(userId || "").trim();
  const cacheKey = `${String(guildId || "").trim()}:${actorUserId}`;
  const cached = allEngineConfigCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (allEngineConfigInflight.has(cacheKey)) {
    return allEngineConfigInflight.get(cacheKey);
  }
  const request = (async () => {
    const json = await fetchJsonOrThrow(
      `/api/bot/engine-config?guildId=${encodeURIComponent(guildId)}${actorUserId ? `&userId=${encodeURIComponent(actorUserId)}` : ""}`
    );
    const value = (json?.config && typeof json.config === "object") ? json.config : {};
    allEngineConfigCache.set(cacheKey, { value, expiresAt: Date.now() + ENGINE_CONFIG_TTL_MS });
    allEngineConfigInflight.delete(cacheKey);
    return value;
  })().catch((error) => {
    allEngineConfigInflight.delete(cacheKey);
    throw error;
  });
  allEngineConfigInflight.set(cacheKey, request);
  return request;
}

async function saveEngineConfig(guildId: string, engine: string, patch: Record<string, unknown>, userId = "") {
  await fetchJsonOrThrow("/api/runtime/engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, engine, patch, userId }),
  });
  const prefix = `${String(guildId || "").trim()}:${String(engine || "").trim()}:`;
  for (const cacheKey of engineConfigCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      engineConfigCache.delete(cacheKey);
    }
  }
  for (const cacheKey of allEngineConfigCache.keys()) {
    if (cacheKey.startsWith(`${String(guildId || "").trim()}:`)) {
      allEngineConfigCache.delete(cacheKey);
    }
  }
}

async function getSubscriptionStatus(guildId: string) {
  const cacheKey = String(guildId || "").trim();
  const cached = subscriptionStatusCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inflight = subscriptionStatusInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const res = await fetch(`/api/subscriptions/status?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    const value =
      !res || !res.ok || json?.success === false
        ? { active: false, plan: "FREE", developerBypass: false }
        : {
            active: Boolean(json?.status?.active),
            plan: String(json?.status?.plan || "FREE"),
            developerBypass: Boolean(json?.status?.developerBypass),
          };
    subscriptionStatusCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + SUBSCRIPTION_STATUS_TTL_MS,
    });
    subscriptionStatusInflight.delete(cacheKey);
    return value;
  })().catch((error) => {
    subscriptionStatusInflight.delete(cacheKey);
    throw error;
  });

  subscriptionStatusInflight.set(cacheKey, request);
  return request;
}

function featureController(key: string): ToggleController {
  return {
    async read(guildId, userId) {
      const config = await getDashboardConfig(guildId, userId);
      return readBoolPath(config, ["features", key], false);
    },
    async write(guildId, next, userId) {
      await saveDashboardFeature(guildId, key, next, userId);
    },
    readLocal(dashboardConfig) {
      return readBoolPath(dashboardConfig, ["features", key], false);
    },
  };
}

function engineController(engine: string, fieldPath: string[] = ["enabled"]): ToggleController {
  return {
    async read(guildId, userId) {
      const config = await getEngineConfig(guildId, engine, userId);
      return readBoolPath(config, fieldPath, false);
    },
    async write(guildId, next, userId) {
      const current = await getEngineConfig(guildId, engine, userId);
      const patch = buildPatch(fieldPath, next);
      if (
        fieldPath.length === 1 &&
        (fieldPath[0] === "active" || fieldPath[0] === "enabled") &&
        typeof current?.active === "boolean" &&
        typeof current?.enabled === "boolean"
      ) {
        patch.active = next;
        patch.enabled = next;
      }
      await saveEngineConfig(guildId, engine, patch, userId);
    },
    readLocal(_dashboardConfig, engineConfigs) {
      return readBoolPath(engineConfigs?.[engine] || {}, fieldPath, false);
    },
  };
}

function getCardSection(card: Card): DashboardSection {
  const href = card.href.split("?")[0].split("#")[0];
  if (
    href === "/dashboard/bot-personalizer" ||
    href === "/dashboard/bot-masters" ||
    href === "/dashboard/channels" ||
    href === "/dashboard/ai/learning" ||
    href === "/dashboard/giveaways" ||
    href === "/dashboard/jed" ||
    href === "/dashboard/music" ||
    href === "/dashboard/vip" ||
    href === "/dashboard/tickets" ||
    href === "/dashboard/selfroles"
  ) {
    return "Guild Control";
  }
  if (
    href === "/dashboard/automations/studio" ||
    href === "/dashboard/commands" ||
    href === "/dashboard/slash-commands" ||
    href === "/dashboard/event-reactor" ||
    href === "/dashboard/runtime-router"
  ) {
    return "Automation";
  }
  if (
    href === "/dashboard/utilities" ||
    href === "/dashboard/reviews" ||
    href === "/dashboard/community-studio" ||
    href === "/dashboard/channel-flow"
  ) {
    return "Utilities";
  }
  if (
    href === "/dashboard/social-alerts" ||
    href === "/dashboard/signal-relay"
  ) {
    return "Social Alerts";
  }
  if (
    href === "/dashboard/security" ||
    href === "/dashboard/governance" ||
    href === "/dashboard/security-enforcer" ||
    href === "/dashboard/moderator" ||
    href === "/dashboard/blacklist" ||
    href === "/dashboard/modder-intel" ||
    href === "/dashboard/failsafe"
  ) {
    return "Security";
  }
  if (
    href === "/dashboard/premium-features" ||
    href === "/dashboard/heist" ||
    href === "/dashboard/tts" ||
    href === "/dashboard/ai/persona" ||
    href === "/dashboard/ai/openai-platform"
  ) {
    return "Premium";
  }
  if (
    href === "/dashboard/economy" ||
    href.startsWith("/dashboard/economy/") ||
    href === "/dashboard/prestige" ||
    href === "/dashboard/profile" ||
    href === "/dashboard/halloffame" ||
    href === "/dashboard/achievements" ||
    href === "/dashboard/loyalty"
  ) {
    return "Economy";
  }
  if (
    href === "/dashboard/games" ||
    href === "/dashboard/crew" ||
    href === "/dashboard/dominion" ||
    href === "/dashboard/contracts" ||
    href === "/dashboard/catdrop" ||
    href === "/dashboard/rarespawn" ||
    href === "/dashboard/range" ||
    href === "/dashboard/truthdare" ||
    href.startsWith("/dashboard/pokemon-")
  ) {
    return "Fun + Games";
  }
  return "Guild Control";
}

const birthdayController: ToggleController = {
  async read(guildId, userId) {
    const [dashboardConfig, engineConfig] = await Promise.all([
      getDashboardConfig(guildId, userId),
      getEngineConfig(guildId, "radio", userId),
    ]);
    return readBoolPath(dashboardConfig, ["features", "birthdayEnabled"], false) && readBoolPath(engineConfig, ["birthday", "enabled"], false);
  },
  async write(guildId, next, userId) {
    await saveDashboardFeature(guildId, "birthdayEnabled", next, userId);
    await saveEngineConfig(guildId, "radio", { birthday: { enabled: next } }, userId);
  },
  readLocal(dashboardConfig, engineConfigs) {
    return readBoolPath(dashboardConfig, ["features", "birthdayEnabled"], false) && readBoolPath(engineConfigs?.radio || {}, ["birthday", "enabled"], false);
  },
};

const rareSpawnController: ToggleController = {
  async read(guildId, userId) {
    const [dashboardConfig, engineConfig] = await Promise.all([
      getDashboardConfig(guildId, userId),
      getEngineConfig(guildId, "rareSpawn", userId),
    ]);
    return readBoolPath(dashboardConfig, ["features", "rareDropEnabled"], false) && readBoolPath(engineConfig, ["enabled"], false);
  },
  async write(guildId, next, userId) {
    await Promise.all([
      saveDashboardFeature(guildId, "rareDropEnabled", next, userId),
      saveEngineConfig(guildId, "rareSpawn", { enabled: next }, userId),
    ]);
  },
  readLocal(dashboardConfig, engineConfigs) {
    return readBoolPath(dashboardConfig, ["features", "rareDropEnabled"], false) && readBoolPath(engineConfigs?.rareSpawn || {}, ["enabled"], false);
  },
};

const musicController: ToggleController = {
  async read(guildId, userId) {
    const [dashboardConfig, engineConfig] = await Promise.all([
      getDashboardConfig(guildId, userId),
      getEngineConfig(guildId, "music", userId),
    ]);
    return readBoolPath(dashboardConfig, ["features", "musicEnabled"], false) && readBoolPath(engineConfig, ["enabled"], false);
  },
  async write(guildId, next, userId) {
    await Promise.all([
      saveDashboardFeature(guildId, "musicEnabled", next, userId),
      saveEngineConfig(guildId, "music", { enabled: next }, userId),
    ]);
  },
  readLocal(dashboardConfig, engineConfigs) {
    return readBoolPath(dashboardConfig, ["features", "musicEnabled"], false) && readBoolPath(engineConfigs?.music || {}, ["enabled"], false);
  },
};

const pokemonCatchingController: ToggleController = {
  async read(guildId, userId) {
    const [dashboardConfig, engineConfig] = await Promise.all([
      getDashboardConfig(guildId, userId),
      getEngineConfig(guildId, "pokemon", userId),
    ]);
    return readBoolPath(dashboardConfig, ["features", "pokemonEnabled"], false) && readBoolPath(engineConfig, ["enabled"], false);
  },
  async write(guildId, next, userId) {
    await Promise.all([
      saveDashboardFeature(guildId, "pokemonEnabled", next, userId),
      saveEngineConfig(guildId, "pokemon", { enabled: next }, userId),
    ]);
  },
  readLocal(dashboardConfig, engineConfigs) {
    return readBoolPath(dashboardConfig, ["features", "pokemonEnabled"], false) && readBoolPath(engineConfigs?.pokemon || {}, ["enabled"], false);
  },
};

const pokemonBattleController: ToggleController = {
  async read(guildId, userId) {
    const [dashboardConfig, engineConfig] = await Promise.all([
      getDashboardConfig(guildId, userId),
      getEngineConfig(guildId, "pokemon", userId),
    ]);
    return readBoolPath(dashboardConfig, ["features", "pokemonEnabled"], false) && readBoolPath(engineConfig, ["battleEnabled"], false);
  },
  async write(guildId, next, userId) {
    if (next) {
      await saveDashboardFeature(guildId, "pokemonEnabled", true, userId);
    }
    await saveEngineConfig(guildId, "pokemon", { battleEnabled: next }, userId);
  },
  readLocal(dashboardConfig, engineConfigs) {
    return readBoolPath(dashboardConfig, ["features", "pokemonEnabled"], false) && readBoolPath(engineConfigs?.pokemon || {}, ["battleEnabled"], false);
  },
};

const pokemonTradeController: ToggleController = {
  async read(guildId, userId) {
    const [dashboardConfig, engineConfig] = await Promise.all([
      getDashboardConfig(guildId, userId),
      getEngineConfig(guildId, "pokemon", userId),
    ]);
    return readBoolPath(dashboardConfig, ["features", "pokemonEnabled"], false) && readBoolPath(engineConfig, ["tradingEnabled"], false);
  },
  async write(guildId, next, userId) {
    if (next) {
      await saveDashboardFeature(guildId, "pokemonEnabled", true, userId);
    }
    await saveEngineConfig(guildId, "pokemon", { tradingEnabled: next }, userId);
  },
  readLocal(dashboardConfig, engineConfigs) {
    return readBoolPath(dashboardConfig, ["features", "pokemonEnabled"], false) && readBoolPath(engineConfigs?.pokemon || {}, ["tradingEnabled"], false);
  },
};

const CARDS: Card[] = [
  { href: "/dashboard/bot-personalizer", title: "Bot Personalizer", description: "Per-guild Possum AI naming, avatar, activity, and webhook identity.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/bot-masters", title: "Bot Masters", description: "Set which guild roles and users can manage the dashboard.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/channels", title: "Channels", description: "Centralized channel routing for engines that rely on per-guild channel setup.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/ai/learning", title: "Possum AI", description: "Homemade adaptive AI, bot knowledge base, learning writes, and synthesis runtime.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/giveaways", title: "Giveaways", description: "Giveaway lifecycle, entrants, rerolls, and controls.", toggle: engineController("giveaways", ["active"]) },
  { href: "/dashboard/jed", title: "Jed", description: "Sticker/emote/gif steal and deploy engine.", toggle: engineController("jed") },
  { href: "/dashboard/music", title: "Music", description: "Always-free multi-route music playback, route binding, and live queue control.", toggle: musicController },
  { href: "/dashboard/vip", title: "VIP", description: "VIP tiers, grants, and expiry sync.", toggle: engineController("vip", ["active"]) },
  { href: "/dashboard/tickets", title: "Tickets", description: "Support ticket engine controls.", toggle: engineController("tickets", ["active"]) },
  { href: "/dashboard/selfroles", title: "Self Roles", description: "Self-role panel configuration and role mapping.", toggle: engineController("selfroles", ["active"]) },
  { href: "/dashboard/automations/studio", title: "Automation Studio", description: "Visual trigger/condition/action flow builder.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/commands", title: "!Command Studio", description: "Custom bang-command engine and editor.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/slash-commands", title: "Slash Commands", description: "Native built-in slash command master per guild.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/event-reactor", title: "Event Alerts", description: "Choose what Discord activity to watch, where failed jobs go, and any extra alert posts.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/runtime-router", title: "AI Talking Rules", description: "Simple split between free Possum AI replies and optional Persona AI channels.", toggle: engineController("runtimeRouter", ["adaptiveAiEnabled"]) },
  { href: "/dashboard/utilities", title: "Utilities", description: "Card-based utility overview for Jed, help, polls, reminders, embeds, counters, and temp channels.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/reviews", title: "Reviews", description: "Review panel deploy, star voting, and written feedback cards.", toggle: engineController("reviews", ["enabled"]) },
  { href: "/dashboard/community-studio", title: "Community Studio", description: "Bulletin drops, pulse polls, reminder loops, and lookup shelf answers.", toggle: engineController("communityStudio", ["active"]) },
  { href: "/dashboard/channel-flow", title: "Channel Flow", description: "Live counter channels and room-flow temporary voice spaces.", toggle: engineController("channelFlow", ["active"]) },
  { href: "/dashboard/search-anything", title: "Search Anything", description: "Guild-level search routes for web, video, wiki, meme, anime, and creator lookups.", toggle: engineController("searchAnything", ["enabled"]) },
  { href: "/dashboard/social-alerts", title: "Social Alerts", description: "Provider cards for RSS, podcast, YouTube, Twitch, TikTok, X, Bluesky, Reddit, Instagram, and Kick.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/signal-relay", title: "Signal Relay", description: "Provider-aware creator and community dispatches with bridge routes, direct feeds, and live checks.", toggle: engineController("signalRelay", ["active"]) },
  { href: "/dashboard/moderator", title: "Moderator", description: "Separate automod, audit logging, and moderation controls.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/security/pre-onboarding", title: "Pre-Onboarding", description: "Blacklist rejoin, refusal-role, and pre-entry enforcement before onboarding begins.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/security/onboarding", title: "Onboarding", description: "Join flow, welcome routing, and onboarding channel behavior.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/security/verification", title: "Verification", description: "Verification decisions, timeout behavior, and follow-up staff controls.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/economy/leaderboard", title: "Invite Tracker", description: "Invite tracking tiers, recruiter thresholds, and leaderboard behavior.", toggle: engineController("inviteTracker") },
  { href: "/dashboard/economy", title: "Economy", description: "Economy baseline and related systems.", toggle: featureController("economyEnabled") },
  { href: "/dashboard/economy/events", title: "Event Points", description: "Separate event-only currency, house boards, and custom event scoring that can optionally mirror into economy.", toggle: engineController("eventPoints", ["enabled"]) },
  { href: "/dashboard/economy/store", title: "Store", description: "Catalog, prices, stock, and role grants.", toggle: engineController("store", ["active"]) },
  { href: "/dashboard/economy/progression", title: "Progression", description: "XP intake, level formulas, reward ladders, and progression multipliers.", toggle: engineController("progression", ["active"]) },
  { href: "/dashboard/prestige", title: "Prestige", description: "Capstone reset loop, role rewards, and long-tail prestige elevation.", toggle: engineController("prestige") },
  { href: "/dashboard/economy/radio-birthday", title: "Radio", description: "Radio birthday profiles, broadcasts, and reward settings.", toggle: birthdayController },
  { href: "/dashboard/profile", title: "Profile", description: "Profile display, rank surfaces, and stat aggregation controls.", toggle: engineController("profile") },
  { href: "/dashboard/halloffame", title: "Hall of Fame", description: "Recognition layer for top achievers and prestige-ready members.", toggle: engineController("hallOfFame") },
  { href: "/dashboard/achievements", title: "Achievements", description: "Milestone grant rules, badge sync, and achievement reward logic.", toggle: engineController("achievements", ["active"]) },
  { href: "/dashboard/loyalty", title: "Loyalty", description: "Retention timing, tenure rewards, and VIP-adjacent loyalty benefits.", toggle: engineController("loyalty", ["active"]) },
  { href: "/dashboard/games", title: "Gaming Hub", description: "Link Steam, Epic, Xbox, Battle.net, PlayStation, Rockstar, and other launcher accounts for live gamer profiles and squads.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/wow", title: "WoW Groups", description: "World of Warcraft 5-man, 10-man, and 25-man signup lanes with MOTD control.", toggle: engineController("wowGuild", ["enabled"]) },
  { href: "/dashboard/crew", title: "Crew", description: "Crew create/join/leave/vault controls.", toggle: engineController("crew") },
  { href: "/dashboard/dominion", title: "Dominion", description: "Dominion raid/alliance/war settings.", toggle: engineController("dominion") },
  { href: "/dashboard/contracts", title: "Contracts", description: "Objective progression, task tracking, and contract reward flow.", toggle: engineController("contracts") },
  { href: "/dashboard/catdrop", title: "Cat Drop", description: "Cat spawn/catch and drop tuning.", toggle: engineController("catDrop") },
  { href: "/dashboard/rarespawn", title: "Rare Spawn", description: "Rare event spawn/claim settings.", toggle: rareSpawnController },
  { href: "/dashboard/range", title: "Range", description: "Range game interactions and limits.", toggle: engineController("range") },
  { href: "/dashboard/truthdare", title: "Truth Or Dare", description: "Truth/Dare prompts, channel locks, and bet controls.", toggle: engineController("truthDare") },
  { href: "/dashboard/pokemon-catching", title: "Pokemon Catching", description: "Wild spawn lanes, catch rates, reward tuning, and catch logs.", toggle: pokemonCatchingController },
  { href: "/dashboard/pokemon-battle", title: "Pokemon Battle", description: "Battle lane, battle logging, and duel availability.", toggle: pokemonBattleController },
  { href: "/dashboard/pokemon-trade", title: "Pokemon Trade", description: "Trade gate and trade log routing.", toggle: pokemonTradeController },
  { href: "/dashboard/governance", title: "Governance", description: "Governance state and enforcement controls.", toggle: engineController("security.governance", ["active"]) },
  { href: "/dashboard/security", title: "Security", description: "Security stack, moderation, and policies.", toggle: engineController("security.governance", ["active"]) },
  { href: "/dashboard/blacklist", title: "Blacklist", description: "Blacklist add/remove/show control.", toggle: engineController("blacklist") },
  { href: "/dashboard/modder-intel", title: "Modder Intel", description: "Track menu holders, reseller risk, and restriction surfaces without forcing them into the blacklist.", toggle: engineController("modderIntel", ["enabled"]) },
  { href: "/dashboard/failsafe", title: "Failsafe", description: "Emergency pause and safety switches.", toggle: engineController("failsafe") },
  { href: "/dashboard/system-health", title: "System Health", description: "Runtime monitor, drift and health checks.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/master", title: "Master Control", description: "Creator-only global view for guild coverage, route counts, and what is set where.", goOnly: true, goLabel: "Open", creatorOnly: true },
  { href: "/dashboard/premium-features", title: "Premium Features", description: "Plan state, paid add-ons, and owner trial controls.", goOnly: true, goLabel: "Go" },
  { href: "/dashboard/heist", title: "Heist", description: "Heist signup engine controls.", toggle: engineController("heist", ["active"]), premiumRequired: true },
  { href: "/dashboard/tts", title: "TTS", description: "Voice route and TTS runtime control.", toggle: engineController("tts", ["enabled"]), premiumRequired: true },
  { href: "/dashboard/ai/persona", title: "Persona AI", description: "Hosted persona runtime, photos, triggers, and roster controls.", goOnly: true, goLabel: "Go", premiumRequired: true },
  { href: "/dashboard/premium-features#advanced-security", title: "Advanced Security Suite", description: "Threat intel, drift, trust weighting, escalation, and containment premium layer.", goOnly: true, goLabel: "Go", premiumRequired: true },
  { href: "/dashboard/premium-features#automation-suite", title: "Automation + Commands Suite", description: "Advanced automation depth and elevated custom-command scale for premium guilds.", goOnly: true, goLabel: "Go", premiumRequired: true },
  { href: "/dashboard/ai/openai-platform", title: "Creator AI Platform", description: "Internal provider/model controls reserved for bot creators.", goOnly: true, goLabel: "Go", premiumRequired: true, creatorOnly: true },
];

function pillClass(on: boolean | null) {
  if (on === null) {
    return "rounded-full border border-red-600/40 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-200/70";
  }
  return on
    ? "rounded-full border border-pink-500/50 bg-pink-950/40 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-pink-200"
    : "rounded-full border border-red-600/50 bg-red-950/40 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-300";
}

export default function DashboardClient({ groupSlug }: { groupSlug?: string } = {}) {
  const premiumEnforced = isPremiumEnforcementEnabled();
  const [guildId, setGuildId] = useState("");
  const [viewerUserId, setViewerUserId] = useState("");
  const [states, setStates] = useState<Record<string, ToggleState>>({});
  const [loadingStates, setLoadingStates] = useState(false);
  const [subscription, setSubscription] = useState<{ active: boolean; plan: string; developerBypass?: boolean } | null>(null);
  const { isMasterOwner } = useDashboardSessionState();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastGuildId = "";
    let lastUserId = "";
    const syncContext = () => {
      const nextGuildId = readDashboardGuildId();
      const nextUserId = readDashboardUserId();
      if (nextGuildId === lastGuildId && nextUserId === lastUserId) return;
      lastGuildId = nextGuildId;
      lastUserId = nextUserId;
      setGuildId(nextGuildId);
      setViewerUserId(nextUserId);
    };
    syncContext();
    window.addEventListener("popstate", syncContext);
    window.addEventListener("storage", syncContext);
    window.addEventListener("focus", syncContext);
    document.addEventListener("visibilitychange", syncContext);
    return () => {
      window.removeEventListener("popstate", syncContext);
      window.removeEventListener("storage", syncContext);
      window.removeEventListener("focus", syncContext);
      document.removeEventListener("visibilitychange", syncContext);
    };
  }, []);

  const loadStates = useCallback(async (targetGuildId: string) => {
    if (!targetGuildId) return;
    setLoadingStates(true);
    try {
      const [dashboardConfig, engineConfigs] = await Promise.all([
        getDashboardConfig(targetGuildId, viewerUserId),
        getAllEngineConfigs(targetGuildId, viewerUserId),
      ]);

      const nextStates: Record<string, ToggleState> = {};
      for (const card of CARDS) {
        if (!card.toggle) continue;
        if (typeof card.toggle.readLocal === "function") {
          nextStates[card.href] = {
            value: card.toggle.readLocal(dashboardConfig, engineConfigs),
            saving: false,
          };
          continue;
        }
        nextStates[card.href] = { value: await card.toggle.read(targetGuildId, viewerUserId), saving: false };
      }
      setStates(nextStates);
    } catch {
      const nextStates: Record<string, ToggleState> = {};
      await Promise.all(
        CARDS.map(async (card) => {
          if (!card.toggle) return;
          try {
            const value = await card.toggle.read(targetGuildId, viewerUserId);
            nextStates[card.href] = { value, saving: false };
          } catch (err: any) {
            nextStates[card.href] = {
              value: null,
              saving: false,
              error: err?.message || "Failed to load toggle.",
            };
          }
        })
      );
      setStates(nextStates);
    } finally {
      setLoadingStates(false);
    }
  }, [viewerUserId]);

  useEffect(() => {
    loadStates(guildId).catch(() => {});
  }, [guildId, loadStates, viewerUserId]);

  useEffect(() => {
    if (!premiumEnforced) {
      setSubscription({ active: true, plan: "UNLOCKED", developerBypass: true });
      return;
    }
    if (!guildId) {
      setSubscription(null);
      return;
    }
    (async () => {
      const next = await getSubscriptionStatus(guildId).catch(() => ({
        active: false,
        plan: "FREE",
        developerBypass: false,
      }));
      setSubscription(next);
    })();
  }, [guildId, premiumEnforced]);

  async function toggleCard(card: Card) {
    if (!guildId || !card.toggle || !card.routeKey) return;
    const premiumUnlocked = !premiumEnforced || Boolean(subscription?.active || subscription?.developerBypass);
    if (card.premiumRequired && !premiumUnlocked) return;
    const current = states[card.routeKey]?.value ?? false;
    const next = !current;
    setStates((prev) => ({
      ...prev,
      [card.routeKey as string]: { ...(prev[card.routeKey as string] || { value: current }), value: next, saving: true, error: "" },
    }));

    try {
      await card.toggle.write(guildId, next, viewerUserId);
      await loadStates(guildId);
    } catch (err: any) {
      setStates((prev) => ({
        ...prev,
        [card.routeKey as string]: {
          ...(prev[card.routeKey as string] || { value: current }),
          value: current,
          saving: false,
          error: err?.message || "Toggle failed.",
        },
      }));
    }
  }

  const cards = useMemo(
    () =>
      CARDS.map((card) => ({
        ...card,
        routeKey: card.href,
        href: buildDashboardHref(card.href),
        state: states[card.href] || { value: null, saving: false },
      })).filter((card) => !card.creatorOnly || isMasterOwner),
    [isMasterOwner, states]
  );

  const quickAccessCards = useMemo(
    () => cards.filter((card) => card.routeKey === "/dashboard/system-health"),
    [cards]
  );

  const premiumUnlocked = !premiumEnforced || Boolean(subscription?.active || subscription?.developerBypass);
  const navGroup = useMemo(
    () => (groupSlug ? getDashboardNavSections(isMasterOwner).find((s) => getSectionSlug(s.label) === groupSlug) || null : null),
    [groupSlug, isMasterOwner]
  );
  const baseHref = (href: string) => href.split("?")[0].split("#")[0];
  const groupedCards = useMemo(() => {
    if (groupSlug) {
      if (!navGroup) return [];
      const wanted = new Set(navGroup.items.map((item) => baseHref(item.href)));
      const matched = cards.filter((card) => card.routeKey && wanted.has(baseHref(card.routeKey)));
      return matched.length ? [{ section: navGroup.label as DashboardSection, cards: matched }] : [];
    }
    return SECTION_ORDER.map((section) => ({
      section,
      cards: cards.filter((card) => card.routeKey !== "/dashboard/system-health" && getCardSection(card) === section),
    })).filter((group) => group.cards.length > 0);
  }, [cards, groupSlug, navGroup]);
  const extraGroupLinks = useMemo(() => {
    if (!navGroup) return [];
    const withCards = new Set(cards.map((card) => baseHref(card.routeKey || "")));
    const seen = new Set<string>();
    return navGroup.items.filter((item) => {
      const key = baseHref(item.href);
      if (withCards.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cards, navGroup]);

  return (
    <section className="space-y-5">
      <header className="rounded-xl border possum-divider bg-black/50 p-5 possum-border">
        <p className="text-xs uppercase tracking-[0.22em] possum-soft">{navGroup ? "Group Overview" : "Possum Control"}</p>
        <h2 className="mt-1 text-2xl font-black uppercase tracking-[0.08em] possum-red possum-glow">{navGroup ? navGroup.label : "Guild Dashboard"}</h2>
        {navGroup ? (
          <p className="mt-2 text-sm text-red-200/80">
            Live status for everything in {navGroup.label}. Use the toggles to switch features on or off, or click a card to open its settings.
          </p>
        ) : null}
        {groupSlug && !navGroup ? <p className="mt-2 text-sm text-red-200/80">That group does not exist.</p> : null}
        <p className="mt-2 text-sm text-red-200/80" hidden={Boolean(groupSlug)}>
          {guildId === SAVIORS_GUILD_ID
            ? "Saviors baseline stays intact until you explicitly toggle something."
            : "Cards are grouped by live engine category. Use toggles here to turn engines on or off for the active guild without leaving the dashboard. Studio/editor pages open directly with Go."}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-red-300/70">
          Premium access: {!premiumEnforced ? "Disabled - all guilds currently run unlocked" : subscription?.developerBypass ? "Developer Override" : subscription?.plan || "Free"}
        </p>
      </header>

      {!groupSlug && quickAccessCards.length ? (
        <section className="space-y-3">
          <header className="rounded-xl border possum-divider bg-black/45 p-4 possum-border">
            <p className="text-xs uppercase tracking-[0.22em] possum-soft">Quick Access</p>
            <h3 className="mt-1 text-xl font-black uppercase tracking-[0.08em] possum-red">System Health</h3>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickAccessCards.map((card) => (
              <div
                key={card.href}
                className="rounded-xl border possum-divider bg-black/45 p-4 transition hover:bg-black/65 possum-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={card.href} prefetch={false} className="min-w-0 flex-1">
                    <h3 className="text-base font-extrabold uppercase tracking-[0.06em] possum-red">{card.title}</h3>
                    <p className="mt-1 text-sm text-red-200/75">{card.description}</p>
                  </Link>
                  <Link
                    href={card.href}
                    prefetch={false}
                    className="rounded-lg border border-red-600/60 bg-black/50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-red-200"
                  >
                    {card.goLabel || "Go"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {extraGroupLinks.length ? (
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] possum-soft">Pages in this group</p>
          <div className="flex flex-wrap gap-2">
            {extraGroupLinks.map((item) => (
              <Link
                key={item.href}
                href={buildDashboardHref(item.href)}
                prefetch={false}
                className="rounded-lg border border-pink-400/50 bg-black/50 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-pink-100 hover:bg-pink-500/10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-4">
        {groupedCards.map((group) => (
          <section key={group.section} className="space-y-3">
            <header className="rounded-xl border possum-divider bg-black/45 p-4 possum-border">
              <p className="text-xs uppercase tracking-[0.22em] possum-soft">{group.section}</p>
              <h3 className="mt-1 text-xl font-black uppercase tracking-[0.08em] possum-red">{group.section}</h3>
            </header>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.cards.map((card) => {
                const state = card.state;
                const toggleSaving = state.saving;
                const toggleLoading = loadingStates && state.value === null;
                const statusLabel = state.value === null ? "..." : state.value ? "ON" : "OFF";
                const lockedPremium = Boolean(premiumEnforced && card.premiumRequired && !premiumUnlocked);

                return (
                  <div
                    key={card.href}
                    className="rounded-xl border possum-divider bg-black/45 p-4 transition hover:bg-black/65 possum-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link href={card.href} prefetch={false} className="min-w-0 flex-1">
                        <h3 className="text-base font-extrabold uppercase tracking-[0.06em] possum-red">{card.title}</h3>
                        <p className="mt-1 text-sm text-red-200/75">{card.description}</p>
                      </Link>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {card.goOnly ? (
                          <>
                            <span className={lockedPremium ? "rounded-full border border-amber-500/40 bg-amber-950/30 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-amber-300" : "rounded-full border border-red-600/40 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-red-200/75"}>
                              {lockedPremium ? "Premium" : "Editor"}
                            </span>
                            <Link
                              href={card.href}
                              prefetch={false}
                              className="rounded-lg border border-red-600/60 bg-black/50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-red-200"
                            >
                              {card.goLabel || "Go"}
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className={pillClass(state.value)}>{statusLabel}</span>
                            <button
                              type="button"
                              onClick={() => toggleCard(card)}
                              disabled={!guildId || !card.toggle || toggleSaving || toggleLoading || lockedPremium}
                              className="rounded-lg border border-red-600/60 bg-black/50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {toggleSaving ? "Saving" : toggleLoading ? "Loading" : lockedPremium ? "Premium" : state.value ? "Turn Off" : "Turn On"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {card.premiumRequired ? (
                      <p className="mt-2 text-xs text-amber-300/85">
                        {!premiumEnforced ? "Premium enforcement is currently off, so this stays unlocked for all guilds." : premiumUnlocked ? "Premium-unlocked for this guild." : "Premium feature. Unlock required for live toggles."}
                      </p>
                    ) : null}
                    {state.error ? <p className="mt-2 text-xs text-red-300/90">{state.error}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
