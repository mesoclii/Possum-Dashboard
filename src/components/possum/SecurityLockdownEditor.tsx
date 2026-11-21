"use client";

import { useEffect, useMemo, useState } from "react";
import { PossumCard } from "@/components/possum/PossumCard";
import { possum } from "@/styles/possumTheme";

type Role = { id: string; name: string };
type Channel = { id: string; name: string };

type LockdownConfig = {
  enabled: boolean;
  joinThresholdPerMinute: number;
  mentionThresholdPerMinute: number;
  autoEscalation: boolean;
  exemptRoleIdsCsv: string;
  exemptChannelIdsCsv: string;
};

const DEFAULTS: LockdownConfig = {
  enabled: false,
  joinThresholdPerMinute: 10,
  mentionThresholdPerMinute: 20,
  autoEscalation: false,
  exemptRoleIdsCsv: "",
  exemptChannelIdsCsv: "",
};

function parseIdCsv(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^\d{16,20}$/.test(v));
}

export default function SecurityLockdownEditor({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState("");
  const [cfg, setCfg] = useState<LockdownConfig>(DEFAULTS);
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("guildId") || "";
    setGuildId(String(id).trim());
  }, []);

  const qs = useMemo(
    () => (guildId ? `?guildId=${encodeURIComponent(guildId)}` : ""),
    [guildId]
  );

  useEffect(() => {
    if (!guildId) return;

    async function load() {
      try {
        setStatus("Loading lockdown profile...");
        const [cfgRes, guildRes] = await Promise.all([
          fetch(`/api/bot/engine-config?guildId=${encodeURIComponent(guildId)}&engine=lockdown`),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`),
        ]);

        const cfgData = await cfgRes.json();
        const guildData = await guildRes.json();

        if (!cfgData?.success) throw new Error(cfgData?.error || "Failed to load lockdown config");
        if (!guildData?.success) throw new Error(guildData?.error || "Failed to load guild data");

        const raw = cfgData.config || {};
        setCfg({
          enabled: !!raw.enabled,
          joinThresholdPerMinute: Number(raw.joinThresholdPerMinute ?? 10),
          mentionThresholdPerMinute: Number(raw.mentionThresholdPerMinute ?? 20),
          autoEscalation: !!raw.autoEscalation,
          exemptRoleIdsCsv: Array.isArray(raw.exemptRoleIds) ? raw.exemptRoleIds.join(", ") : "",
          exemptChannelIdsCsv: Array.isArray(raw.exemptChannelIds) ? raw.exemptChannelIds.join(", ") : "",
        });

        setGuildName(String(guildData?.guild?.name || ""));
        setRoles(Array.isArray(guildData.roles) ? guildData.roles : []);
        setChannels(Array.isArray(guildData.channels) ? guildData.channels : []);
        setStatus("");
      } catch (err: any) {
        setStatus(String(err?.message || err));
      }
    }

    load();
  }, [guildId]);

  function applyPreset(kind: "soft" | "balanced" | "strict") {
    if (kind === "soft") {
      setCfg((v) => ({
        ...v,
        enabled: true,
        joinThresholdPerMinute: 15,
        mentionThresholdPerMinute: 30,
        autoEscalation: false,
      }));
      return;
    }
    if (kind === "balanced") {
      setCfg((v) => ({
        ...v,
        enabled: true,
        joinThresholdPerMinute: 10,
        mentionThresholdPerMinute: 20,
        autoEscalation: true,
      }));
      return;
    }
    setCfg((v) => ({
      ...v,
      enabled: true,
      joinThresholdPerMinute: 6,
      mentionThresholdPerMinute: 12,
      autoEscalation: true,
    }));
  }

  async function save() {
    if (!guildId) return;

    try {
      setSaving(true);
      setStatus("");

      const payload = {
        enabled: !!cfg.enabled,
        joinThresholdPerMinute: Math.max(1, Number(cfg.joinThresholdPerMinute || 1)),
        mentionThresholdPerMinute: Math.max(1, Number(cfg.mentionThresholdPerMinute || 1)),
        autoEscalation: !!cfg.autoEscalation,
        exemptRoleIds: parseIdCsv(cfg.exemptRoleIdsCsv),
        exemptChannelIds: parseIdCsv(cfg.exemptChannelIdsCsv),
      };

      const res = await fetch("/api/bot/engine-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, engine: "lockdown", config: payload }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Save failed");
      }

      setStatus("Saved");
    } catch (err: any) {
      setStatus(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  if (!guildId) {
    return <div style={{ color: possum.soft }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        className="possum-red possum-glow"
        style={{ fontSize: 30, fontWeight: 950, letterSpacing: "0.22em", textTransform: "uppercase" }}
      >
        {title}
      </div>

      <div style={{ color: possum.soft, letterSpacing: "0.08em" }}>
        {description}
        {guildName ? ` • ${guildName}` : ""}
      </div>

      {status ? <div style={{ color: possum.soft }}>{status}</div> : null}

      <PossumCard title="Activation + Policy">
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ color: possum.soft }}>
            <input
              type="checkbox"
              checked={!!cfg.enabled}
              onChange={(e) => setCfg((v) => ({ ...v, enabled: e.target.checked }))}
            />{" "}
            Enable lockdown profile
          </label>

          <label style={{ color: possum.soft }}>
            <input
              type="checkbox"
              checked={!!cfg.autoEscalation}
              onChange={(e) => setCfg((v) => ({ ...v, autoEscalation: e.target.checked }))}
            />{" "}
            Auto-escalation enabled
          </label>
        </div>
      </PossumCard>

      <PossumCard title="Thresholds">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ color: possum.soft, marginBottom: 4 }}>Join threshold per minute</div>
            <input
              type="number"
              min={1}
              value={cfg.joinThresholdPerMinute}
              onChange={(e) => setCfg((v) => ({ ...v, joinThresholdPerMinute: Number(e.target.value || 1) }))}
              style={{ width: 240, padding: 10, borderRadius: 10, border: `1px solid ${possum.border}`, background: "#0b0b0b", color: "#fff" }}
            />
          </div>

          <div>
            <div style={{ color: possum.soft, marginBottom: 4 }}>Mention threshold per minute</div>
            <input
              type="number"
              min={1}
              value={cfg.mentionThresholdPerMinute}
              onChange={(e) => setCfg((v) => ({ ...v, mentionThresholdPerMinute: Number(e.target.value || 1) }))}
              style={{ width: 240, padding: 10, borderRadius: 10, border: `1px solid ${possum.border}`, background: "#0b0b0b", color: "#fff" }}
            />
          </div>
        </div>
      </PossumCard>

      <PossumCard title="Quick Presets">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="possum-btn" onClick={() => applyPreset("soft")} style={{ padding: "10px 14px" }}>
            Soft
          </button>
          <button type="button" className="possum-btn" onClick={() => applyPreset("balanced")} style={{ padding: "10px 14px" }}>
            Balanced
          </button>
          <button type="button" className="possum-btn" onClick={() => applyPreset("strict")} style={{ padding: "10px 14px" }}>
            Strict
          </button>
        </div>
      </PossumCard>

      <PossumCard title="Exemptions">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ color: possum.soft, marginBottom: 4 }}>Exempt roles</div>
            <select multiple value={parseIdCsv(cfg.exemptRoleIdsCsv)} onChange={(e) => setCfg((v) => ({ ...v, exemptRoleIdsCsv: Array.from(e.target.selectedOptions, (option) => option.value).join(", ") }))} style={{ width: "100%", minHeight: 110, padding: 10, borderRadius: 10, border: `1px solid ${possum.border}`, background: "#0b0b0b", color: "#fff" }}>
              {parseIdCsv(cfg.exemptRoleIdsCsv).filter((id) => !roles.some((role) => role.id === id)).map((id) => <option key={id} value={id}>Unavailable role</option>)}
              {roles.map((role) => <option key={role.id} value={role.id}>@{role.name}</option>)}
            </select>
          </div>

          <div>
            <div style={{ color: possum.soft, marginBottom: 4 }}>Exempt channels</div>
            <select multiple value={parseIdCsv(cfg.exemptChannelIdsCsv)} onChange={(e) => setCfg((v) => ({ ...v, exemptChannelIdsCsv: Array.from(e.target.selectedOptions, (option) => option.value).join(", ") }))} style={{ width: "100%", minHeight: 110, padding: 10, borderRadius: 10, border: `1px solid ${possum.border}`, background: "#0b0b0b", color: "#fff" }}>
              {parseIdCsv(cfg.exemptChannelIdsCsv).filter((id) => !channels.some((channel) => channel.id === id)).map((id) => <option key={id} value={id}>Unavailable channel</option>)}
              {channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
            </select>
          </div>
        </div>
      </PossumCard>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="possum-btn" onClick={save} disabled={saving} style={{ padding: "12px 18px", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Lockdown Profile"}
        </button>

        <a href={`/dashboard/security${qs}`} className="possum-btn" style={{ padding: "12px 18px", textDecoration: "none" }}>
          Back To Security
        </a>
      </div>
    </div>
  );
}
