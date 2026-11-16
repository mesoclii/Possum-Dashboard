"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { fetchGuildData, fetchRuntimeEngine, peekGuildData, peekRuntimeEngine } from "@/lib/liveRuntime";
import { mergePersonalizerSave } from "@/lib/personalizerSaveMerge";

export type GuildRole = { id: string; name: string; position?: number; color?: string };
export type GuildChannel = { id: string; name: string; type?: number | string; parentId?: string | null };
export type GuildBotUser = { id?: string; username?: string; globalName?: string; avatarUrl?: string };
export type EngineSummaryItem = { label: string; value: string };
export type EngineDetailItem = { rank?: number; name?: string; title?: string; value: string };
export type EngineDetails = Record<string, EngineDetailItem[] | { title: string; value: string } | null | undefined>;

function resolveGuildId() {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const id = (q || s).trim();
  if (id) localStorage.setItem("activeGuildId", id);
  return id;
}

function resolveViewerUserId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const userId = String(params.get("userId") || params.get("uid") || localStorage.getItem("dashboardUserId") || "").trim();
  if (userId) {
    localStorage.setItem("dashboardUserId", userId);
  }
  return userId;
}

export function useGuildEngineEditor<T>(engine: string, defaults: T) {
  const initialGuildId = typeof window === "undefined" ? "" : resolveGuildId();
  const initialViewerUserId = typeof window === "undefined" ? "" : resolveViewerUserId();
  const initialRuntime = typeof window === "undefined" ? null : peekRuntimeEngine(initialGuildId, engine, initialViewerUserId);
  const initialGuild = typeof window === "undefined" ? null : peekGuildData(initialGuildId, initialViewerUserId);
  const defaultsRef = useRef(defaults);
  const contextRef = useRef({ guildId: initialGuildId, viewerUserId: initialViewerUserId });
  const [guildId, setGuildId] = useState(initialGuildId);
  const [viewerUserId, setViewerUserId] = useState(initialViewerUserId);
  const [guildName, setGuildName] = useState(String((initialGuild as any)?.guild?.name || "").trim());
  const [config, setConfig] = useState<T>({ ...(defaults as any), ...(initialRuntime?.config || {}) });
  const editRevision = useRef(0);
  const setDraftConfig: Dispatch<SetStateAction<T>> = useCallback((value) => {
    editRevision.current += 1;
    setConfig(value);
  }, []);
  const [channels, setChannels] = useState<GuildChannel[]>(Array.isArray((initialGuild as any)?.channels) ? (initialGuild as any).channels : []);
  const [roles, setRoles] = useState<GuildRole[]>(() => {
    const nextRoles: GuildRole[] = Array.isArray((initialGuild as any)?.roles) ? (initialGuild as any).roles : [];
    nextRoles.sort((a, b) => (Number(b.position || 0) - Number(a.position || 0)) || a.name.localeCompare(b.name));
    return nextRoles;
  });
  const [botUser, setBotUser] = useState<GuildBotUser | null>(((initialGuild as any)?.botUser && typeof (initialGuild as any).botUser === "object") ? (initialGuild as any).botUser : null);
  const [summary, setSummary] = useState<EngineSummaryItem[]>(Array.isArray(initialRuntime?.summary) ? initialRuntime.summary : []);
  const [details, setDetails] = useState<EngineDetails>((initialRuntime?.details && typeof initialRuntime.details === "object") ? initialRuntime.details : {});
  const [loading, setLoading] = useState(engine === "botPersonalizer" ? !initialRuntime : !(initialRuntime || initialGuild));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncContext = () => {
      const nextGuildId = resolveGuildId().trim();
      const nextUserId = resolveViewerUserId();
      if (
        nextGuildId === contextRef.current.guildId &&
        nextUserId === contextRef.current.viewerUserId
      ) {
        return;
      }
      contextRef.current = { guildId: nextGuildId, viewerUserId: nextUserId };
      if (engine === "botPersonalizer") {
        setConfig({ ...(defaultsRef.current as any) });
        setSummary([]);
        setDetails({});
        setGuildName("");
        setLoading(true);
      }
      if (nextGuildId) {
        localStorage.setItem("activeGuildId", nextGuildId);
      }
      setGuildId((current) => (current === nextGuildId ? current : nextGuildId));
      setViewerUserId((current) => (current === nextUserId ? current : nextUserId));
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
  }, [engine]);

  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  const reload = useCallback(async (targetGuildId = guildId, targetUserId = viewerUserId) => {
    if (!targetGuildId) {
      setLoading(false);
      return;
    }
    const warmRuntime = peekRuntimeEngine(targetGuildId, engine, targetUserId);
    const revisionAtLoad = editRevision.current;
    const warmGuild = peekGuildData(targetGuildId, targetUserId);
    const hasWarmPayload = Boolean(warmRuntime || warmGuild);

    if (warmRuntime) {
      setConfig({ ...(defaultsRef.current as any), ...(warmRuntime?.config || {}) });
      setSummary(Array.isArray(warmRuntime?.summary) ? warmRuntime.summary : []);
      setDetails((warmRuntime?.details && typeof warmRuntime.details === "object") ? warmRuntime.details : {});
    }

    if (warmGuild) {
      const nextChannels: GuildChannel[] = Array.isArray((warmGuild as any)?.channels) ? (warmGuild as any).channels : [];
      const nextRoles: GuildRole[] = Array.isArray((warmGuild as any)?.roles) ? (warmGuild as any).roles : [];
      nextRoles.sort((a, b) => (Number(b.position || 0) - Number(a.position || 0)) || a.name.localeCompare(b.name));
      setChannels(nextChannels);
      setRoles(nextRoles);
      setBotUser((((warmGuild as any)?.botUser) && typeof (warmGuild as any).botUser === "object") ? (warmGuild as any).botUser : null);
      const warmGuildName = String((warmGuild as any)?.guild?.name || "").trim();
      if (warmGuildName) {
        setGuildName(warmGuildName);
        localStorage.setItem("activeGuildName", warmGuildName);
      }
    }

    setLoading(engine === "botPersonalizer" ? !warmRuntime : !hasWarmPayload);
    setMessage("");
    try {
      const [runtimeResult, guildResult] = await Promise.allSettled([
        fetchRuntimeEngine(targetGuildId, engine, targetUserId),
        fetchGuildData(targetGuildId, targetUserId),
      ]);

      if (engine === "botPersonalizer" &&
          (contextRef.current.guildId !== targetGuildId || contextRef.current.viewerUserId !== targetUserId)) return;
      const loadErrors: string[] = [];

      if (runtimeResult.status === "fulfilled") {
        const runtimeJson = runtimeResult.value;
        if (engine !== "botPersonalizer" || (revisionAtLoad === editRevision.current &&
          contextRef.current.guildId === targetGuildId && contextRef.current.viewerUserId === targetUserId)) {
          setConfig({ ...(defaultsRef.current as any), ...(runtimeJson?.config || {}) });
        }
        setSummary(Array.isArray(runtimeJson?.summary) ? runtimeJson.summary : []);
        setDetails((runtimeJson?.details && typeof runtimeJson.details === "object") ? runtimeJson.details : {});
      } else {
        loadErrors.push(runtimeResult.reason?.message || "Failed to load engine runtime");
      }

      if (guildResult.status === "fulfilled") {
        const guildJson = guildResult.value as any;
        const nextChannels: GuildChannel[] = Array.isArray(guildJson?.channels) ? guildJson.channels : [];
        const nextRoles: GuildRole[] = Array.isArray(guildJson?.roles) ? guildJson.roles : [];
        setBotUser((guildJson?.botUser && typeof guildJson.botUser === "object") ? guildJson.botUser : null);
        nextRoles.sort((a, b) => (Number(b.position || 0) - Number(a.position || 0)) || a.name.localeCompare(b.name));
        setChannels(nextChannels);
        setRoles(nextRoles);

        const nextGuildName = String(guildJson?.guild?.name || "").trim();
        if (nextGuildName) {
          setGuildName(nextGuildName);
          localStorage.setItem("activeGuildName", nextGuildName);
        }
      } else {
        loadErrors.push(guildResult.reason?.message || "Failed to load live guild channels and roles");
      }

      if (loadErrors.length) {
        setMessage(loadErrors.join(" | "));
      }
    } catch (err: any) {
      if (engine === "botPersonalizer" &&
          (contextRef.current.guildId !== targetGuildId || contextRef.current.viewerUserId !== targetUserId)) return;
      setMessage(err?.message || "Failed to load engine.");
    } finally {
      if (engine !== "botPersonalizer" ||
          (contextRef.current.guildId === targetGuildId && contextRef.current.viewerUserId === targetUserId)) setLoading(false);
    }
  }, [engine, guildId, viewerUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Do not auto-reload editor pages while the user is working.
  // Forced refresh intervals were clobbering in-progress form edits and made the
  // dashboard feel like it was randomly reloading itself. Runtime reload stays
  // available through the explicit Reload buttons on each page.

  async function save(nextPatch?: Partial<T>) {
    if (!guildId) return null;
    setSaving(true);
    setMessage("");
    try {
      const submittedDraft = config;
      const patch = { ...(config as any), ...(nextPatch || {}) };
      if (engine === "botPersonalizer" && new TextEncoder().encode(JSON.stringify({ guildId, engine, patch, userId: viewerUserId })).length > 4 * 1024 * 1024) {
        throw new Error("Personalizer save exceeds the 4 MB request limit. Remove or replace saved uploads with smaller images or image URLs; no changes were saved.");
      }
      const validateRes = await fetch("/api/runtime/engine-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine, patch, userId: viewerUserId }),
      });
      const validateJson = await validateRes.json().catch(() => ({}));
      if (!validateRes.ok || validateJson?.success === false) {
        throw new Error(validateJson?.error || "Validation failed.");
      }
      const validation = validateJson?.validation || {};
      const blocked = Array.isArray(validation?.blocked) ? validation.blocked.filter(Boolean) : [];
      const warnings = Array.isArray(validation?.warnings) ? validation.warnings.filter(Boolean) : [];
      if (blocked.length) {
        throw new Error(blocked.join(" | "));
      }
      if (warnings.length && typeof window !== "undefined") {
        const confirmed = window.confirm(
          ["This change affects connected engines:", ...warnings.map((item: string) => `- ${item}`), "", "Continue with save?"].join("\n")
        );
        if (!confirmed) {
          setMessage("Save cancelled.");
          return null;
        }
      }
      const res = await fetch("/api/runtime/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine, patch, userId: viewerUserId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Save failed");
      }
      if (engine === "botPersonalizer" &&
          (contextRef.current.guildId !== guildId || contextRef.current.viewerUserId !== viewerUserId)) return null;
      const savedConfig = { ...(defaultsRef.current as any), ...(json?.config || patch) };
      if (engine === "botPersonalizer") {
        setConfig((current) => mergePersonalizerSave(submittedDraft, current, savedConfig) as T);
      } else {
        setConfig(savedConfig);
      }
      setSummary(Array.isArray(json?.summary) ? json.summary : []);
      setDetails((json?.details && typeof json.details === "object") ? json.details : {});
      const saveWarnings = Array.isArray(json?.validation?.warnings) ? json.validation.warnings.filter(Boolean) : [];
      setMessage(saveWarnings.length ? `Saved. ${saveWarnings.join(" | ")}` : "Saved.");
      return json;
    } catch (err: any) {
      if (engine !== "botPersonalizer" ||
          (contextRef.current.guildId === guildId && contextRef.current.viewerUserId === viewerUserId)) setMessage(err?.message || "Save failed.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: string, payload?: Record<string, unknown>) {
    if (!guildId) return null;
    setSaving(true);
    setMessage("");
    try {
      if (engine === "botPersonalizer" && new TextEncoder().encode(JSON.stringify({ guildId, engine, action, payload, userId: viewerUserId })).length > 4 * 1024 * 1024) {
        throw new Error("Personalizer action exceeds the 4 MB request limit. Remove or replace saved uploads with smaller images or image URLs; no changes were saved.");
      }
      const res = await fetch("/api/runtime/engine-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine, action, payload, userId: viewerUserId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || "Action failed");
      }
      if (engine === "botPersonalizer" &&
          (contextRef.current.guildId !== guildId || contextRef.current.viewerUserId !== viewerUserId)) return null;
      const result = json?.result ?? null;
      if (engine !== "botPersonalizer") {
        setConfig({ ...(defaultsRef.current as any), ...(result?.config || json?.config || config) });
      }
      setSummary(Array.isArray(json?.summary) ? json.summary : []);
      setDetails((json?.details && typeof json.details === "object") ? json.details : {});
      const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [];
      const avatarLabel = json?.result?.avatar?.scope === "guild" ? "guild avatar" : "bot avatar";
      const appliedLabels = [
        json?.result?.username?.applied ? "bot username" : "",
        json?.result?.nickname?.applied ? "guild nickname" : "",
        json?.result?.presence?.applied ? "live presence" : "",
        json?.result?.avatar?.applied ? avatarLabel : "",
        json?.result?.banner?.applied ? "bot banner" : "",
        json?.result?.webhookIdentity?.applied ? "webhook identity" : "",
      ].filter(Boolean);
      if (result?.message) {
        setMessage(String(result.message));
      } else if (warnings.length) {
        setMessage(warnings.join(" | "));
      } else if (appliedLabels.length) {
        setMessage(`${appliedLabels.join(", ")} applied.`);
      } else {
        setMessage("Action completed.");
      }
      return result;
    } catch (err: any) {
      if (engine !== "botPersonalizer" ||
          (contextRef.current.guildId === guildId && contextRef.current.viewerUserId === viewerUserId)) setMessage(err?.message || "Action failed.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  return {
    guildId,
    viewerUserId,
    guildName,
    config,
    setConfig: setDraftConfig,
    channels,
    roles,
    botUser,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    reload,
    runAction,
  };
}
