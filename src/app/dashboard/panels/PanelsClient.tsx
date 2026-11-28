"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildDashboardHref, readDashboardGuildId, readDashboardUserId } from "@/lib/dashboardContext";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type PanelGuide = {
  id: string;
  engine?: string;
  selected?: boolean;
  label: string;
  href: string;
  page: string;
  destination: string;
  configured: boolean;
  resourceId?: string | null;
};

type InfrastructureReport = {
  guildId?: string;
  panelGuides?: PanelGuide[];
};

type ApiPayload = { success?: boolean; error?: string; report?: InfrastructureReport };
type MasterPanelConfig = { enabled: boolean; deployChannelId: string; persistentMessageId: string; title: string; description: string };
const MASTER_PANEL_DEFAULTS: MasterPanelConfig = {
  enabled: true,
  deployChannelId: "",
  persistentMessageId: "",
  title: "Possum Bot Control Panel",
  description: "Select a panel to open.",
};

function textChannel(channel: { type?: number | string }) {
  return Number(channel.type) === 0 || Number(channel.type) === 5 || String(channel.type || "").toLowerCase().includes("text");
}

async function readPayload(response: Response): Promise<ApiPayload> {
  try {
    return (await response.json()) as ApiPayload;
  } catch {
    return {};
  }
}

export default function PanelsClient() {
  const masterPanel = useGuildEngineEditor<MasterPanelConfig>("masterPanel", MASTER_PANEL_DEFAULTS);
  const [guildId, setGuildId] = useState("");
  const [guides, setGuides] = useState<PanelGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [masterDraft, setMasterDraft] = useState<{ guildId: string; value: MasterPanelConfig } | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(async (selectedGuildId = readDashboardGuildId()) => {
    const sequence = ++loadSequence.current;
    const selectedUserId = readDashboardUserId();
    setGuildId(selectedGuildId);
    setError("");
    if (!selectedGuildId) {
      setGuides([]);
      setLoaded(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const query = new URLSearchParams({ guildId: selectedGuildId });
      if (selectedUserId) query.set("userId", selectedUserId);
      const response = await fetch(`/api/bot/infrastructure?${query.toString()}`, { cache: "no-store" });
      const payload = await readPayload(response);
      if (sequence !== loadSequence.current || readDashboardGuildId() !== selectedGuildId) return;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || `Could not load panel destinations (${response.status}).`);
      }
      if (String(payload.report?.guildId || selectedGuildId) !== selectedGuildId) {
        throw new Error("The panel inventory response belonged to a different server and was discarded.");
      }
      setGuides(Array.isArray(payload.report?.panelGuides) ? payload.report.panelGuides : []);
      setLoaded(true);
    } catch (cause) {
      if (sequence !== loadSequence.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load panel destinations.");
      setGuides([]);
      setLoaded(true);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refresh = () => void load();
    const refreshForStorage = (event: StorageEvent) => {
      if (["activeGuildId", "activeGuildid", "dashboardUserId"].includes(event.key || "")) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refreshForStorage);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refreshForStorage);
    };
  }, [load]);

  const mappedCount = guides.filter((guide) => guide.configured).length;
  const missingCount = guides.length - mappedCount;
  const setupHref = buildDashboardHref("/dashboard/server-setup#setup-panels");
  const masterConfig = masterDraft?.guildId === masterPanel.guildId
    ? masterDraft.value
    : { ...MASTER_PANEL_DEFAULTS, ...(masterPanel.config || {}) };
  const textChannels = masterPanel.channels.filter(textChannel);

  async function saveMasterPanel(deploy = false) {
    const saved = await masterPanel.save(masterConfig);
    if (!saved || !deploy) return;
    const result = await masterPanel.runAction("deploy");
    if (result?.ok) {
      setMasterDraft(null);
      await masterPanel.reload();
    }
  }

  return (
    <main className="space-y-5 text-red-100">
      <section className="rounded-2xl border border-pink-700/40 bg-gradient-to-br from-[#260b16] via-[#12070d] to-black p-5 shadow-[0_18px_70px_rgba(110,12,48,0.18)] sm:p-7">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-pink-200/80">Possum · Guild operations</p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-wide text-white">Panel Control Center</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-rose-100/80">
          See where each feature panel is configured to go, whether that channel exists in the latest server scan, and its exact Discord ID. This page reads the selected server inventory; publishing panel messages remains in each feature’s own controls.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a href={setupHref} className="inline-flex min-h-10 items-center rounded-lg border border-pink-500/40 bg-pink-950/30 px-4 text-sm font-black uppercase text-pink-100">Manage setup destinations</a>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center rounded-lg border border-pink-500/30 px-4 text-sm font-bold disabled:opacity-50">{loading ? "Refreshing…" : "Refresh inventory"}</button>
          {guildId ? <span className="break-all font-mono text-xs text-pink-100/60">Server ID: {guildId}</span> : null}
        </div>
      </section>

      <section className="rounded-xl border border-pink-900/50 bg-black/45 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase text-pink-100">Master control panel</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-pink-100/70">Choose a channel and deploy Possum’s persistent control panel. Re-deploying refreshes the same Possum message when it still exists. This is a separate, explicit action; server setup never publishes panels.</p>
          </div>
          <span className="rounded-md border border-pink-900/60 px-2 py-1 text-xs text-pink-100/65">{masterConfig.persistentMessageId ? "Persistent panel deployed" : "Not deployed"}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Deploy channel
            <select className="mt-1 min-h-11 w-full rounded-lg border border-pink-900/60 bg-black/60 px-3 text-sm text-pink-50" value={masterConfig.deployChannelId || ""} onChange={(event) => setMasterDraft({ guildId: masterPanel.guildId, value: { ...masterConfig, deployChannelId: event.target.value } })}>
              <option value="">Choose a text channel</option>
              {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200">Panel title
            <input className="mt-1 min-h-11 w-full rounded-lg border border-pink-900/60 bg-black/60 px-3 text-sm text-pink-50" maxLength={256} value={masterConfig.title || ""} onChange={(event) => setMasterDraft({ guildId: masterPanel.guildId, value: { ...masterConfig, title: event.target.value } })} />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-pink-200 sm:col-span-2">Panel description
            <textarea className="mt-1 min-h-20 w-full rounded-lg border border-pink-900/60 bg-black/60 px-3 py-2 text-sm text-pink-50" maxLength={1800} value={masterConfig.description || ""} onChange={(event) => setMasterDraft({ guildId: masterPanel.guildId, value: { ...masterConfig, description: event.target.value } })} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={masterPanel.saving || masterPanel.loading || !masterPanel.guildId} onClick={() => void saveMasterPanel(false)} className="inline-flex min-h-10 items-center rounded-lg border border-pink-500/40 bg-pink-950/30 px-4 text-sm font-bold text-pink-100">Save master panel</button>
          <button type="button" disabled={masterPanel.saving || masterPanel.loading || !masterPanel.guildId || !masterConfig.deployChannelId} onClick={() => void saveMasterPanel(true)} className="inline-flex min-h-10 items-center rounded-lg border border-pink-500 bg-gradient-to-r from-pink-600 to-rose-600 px-4 text-sm font-black uppercase text-white">{masterPanel.saving ? "Working…" : masterConfig.persistentMessageId ? "Deploy / refresh panel" : "Deploy master panel"}</button>
          {masterPanel.message ? <span role="status" className="text-sm text-pink-100/70">{masterPanel.message}</span> : null}
        </div>
        {masterConfig.persistentMessageId ? <p className="mt-2 break-all font-mono text-xs text-pink-100/50">Message ID: {masterConfig.persistentMessageId}</p> : null}
      </section>

      {error ? <p role="alert" className="rounded-xl border border-red-700/60 bg-red-950/40 p-4 text-sm text-red-100">{error}</p> : null}
      {!guildId && loaded ? (
        <section className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
          <h2 className="font-black uppercase text-amber-100">Select a server first</h2>
          <p className="mt-2 text-sm text-amber-100/80">Choose a guild from the dashboard, then return here to inspect its panel destinations.</p>
          <a href={buildDashboardHref("/guilds")} className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-amber-500/40 px-3 text-sm font-bold">Choose server</a>
        </section>
      ) : null}

      {guildId ? (
        <section className="rounded-xl border border-pink-900/50 bg-black/45 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black uppercase text-pink-100">Configured destinations</h2>
              <p className="mt-1 text-sm text-pink-100/70">{loading ? "Reading the current server report…" : `${mappedCount} mapped · ${missingCount} needing a destination or review · ${guides.length} total`}</p>
            </div>
            <a href={setupHref} className="text-sm font-bold text-pink-200 underline">Open guided setup →</a>
          </div>
          {loading ? <p role="status" className="mt-5 text-sm text-pink-100/70">Loading channels and panel mappings…</p> : null}
          {!loading && guides.length === 0 && !error ? (
            <div className="mt-5 rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
              <h3 className="font-black uppercase text-amber-100">No panel destinations are configured yet</h3>
              <p className="mt-2 text-sm leading-6 text-amber-100/75">Guided setup creates the categories, channels, roles, permissions, and feature destinations first. It never posts panel messages. After setup, configure each panel from its feature page.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={setupHref} className="inline-flex min-h-10 items-center rounded-lg border border-pink-500/40 bg-pink-950/30 px-4 text-sm font-black uppercase text-pink-100">Open server setup</a>
                <a href={buildDashboardHref("/dashboard")} className="inline-flex min-h-10 items-center rounded-lg border border-pink-500/30 px-4 text-sm font-bold text-pink-100">Browse dashboard controls</a>
              </div>
            </div>
          ) : null}
          {!loading && guides.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {guides.map((guide) => {
                const status = guide.configured ? "Mapped · found in server" : guide.resourceId ? "Saved ID · missing from scan" : "No channel mapped";
                return (
                  <article key={guide.id} className="rounded-xl border border-pink-900/50 bg-black/35 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black text-white">{guide.label}</h3>
                        <p className="mt-1 text-xs uppercase tracking-wider text-pink-200/65">{guide.page}{guide.engine ? ` · ${guide.engine}` : ""}</p>
                      </div>
                      <span className={`rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${guide.configured ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-amber-700/50 bg-amber-950/25 text-amber-100"}`}>{status}</span>
                    </div>
                    <p className="mt-3 text-sm text-pink-100/80">Destination: {guide.destination}</p>
                    {guide.resourceId ? <p className="mt-1 break-all font-mono text-xs text-pink-100/60">Discord channel ID: {guide.resourceId}</p> : <p className="mt-1 text-xs text-pink-100/55">No saved Discord channel ID.</p>}
                    <p className="mt-2 text-xs text-pink-100/55">{guide.selected ? "Feature included in the current setup selection." : "Feature is not selected for infrastructure setup."}</p>
                    <a href={buildDashboardHref(guide.href)} className="mt-3 inline-flex min-h-9 items-center font-bold text-pink-200 underline">Configure {guide.page} →</a>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
