"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import EngineContractPanel from "@/components/possum/EngineContractPanel";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import { buildDashboardHref } from "@/lib/dashboardContext";

type FailsafeConfig = {
  enabled: boolean;
  active: boolean;
  mode: string;
  allowOwnerBypass: boolean;
  allowFounderBypass: boolean;
  allowOnboardingBypass: boolean;
  statusMessage: string;
  statusChannelId: string;
  notes: string;
};

const DEFAULT_CONFIG: FailsafeConfig = {
  enabled: true,
  active: false,
  mode: "pause",
  allowOwnerBypass: true,
  allowFounderBypass: true,
  allowOnboardingBypass: true,
  statusMessage: "Failsafe is active. Engines are paused.",
  statusChannelId: "",
  notes: "",
};

const shell: CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1380 };
const box: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginTop: 12,
};
const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};
const button: CSSProperties = {
  ...input,
  width: "auto",
  cursor: "pointer",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
const label: CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

export default function FailsafePage() {
  const { guildId, guildName, config, setConfig, channels, summary, details, loading, saving, message, save, runAction } =
    useGuildEngineEditor<FailsafeConfig>("failsafe", DEFAULT_CONFIG);

  const textChannels = channels.filter((channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5);

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <section style={shell}>
      <h1 style={{ margin: 0, color: "#ff4f4f", letterSpacing: "0.10em", textTransform: "uppercase" }}>Failsafe Engine</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffbcbc", lineHeight: 1.7, maxWidth: 1120 }}>
        This is the real per-guild router kill switch. When failsafe is active, normal message routing and most interactions stop at app level while
        owner/founder bypass and onboarding bypass stay configurable here.
      </div>

      <EngineContractPanel
        engineKey="failsafe"
        intro="Emergency router pause, operator messaging, and bypass rules for owner/founder and onboarding traffic."
        related={[
          { label: "Security Center", route: "/dashboard/security", reason: "top-level command center" },
          { label: "System Health", route: "/dashboard/system-health", reason: "runtime health before or after a failsafe event" },
        ]}
      />

      {message ? <div style={{ marginTop: 12, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? (
        <div style={box}>Loading failsafe runtime...</div>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={label}>Live Router Control</div>
                <div style={{ color: "#ffbcbc", lineHeight: 1.7 }}>
                  Turn the live failsafe on or off instantly. Saving stores the policy. The action buttons change the live runtime immediately.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={button} disabled={saving} onClick={() => void runAction("enable")}>
                  Enable Live Now
                </button>
                <button style={button} disabled={saving} onClick={() => void runAction("disable")}>
                  Disable Live Now
                </button>
              </div>
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))} />
                Engine Enabled
              </label>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={config.active} onChange={(e) => setConfig((prev) => ({ ...prev, active: e.target.checked }))} />
                Active
              </label>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={config.allowOwnerBypass} onChange={(e) => setConfig((prev) => ({ ...prev, allowOwnerBypass: e.target.checked }))} />
                Owner Bypass
              </label>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={config.allowFounderBypass} onChange={(e) => setConfig((prev) => ({ ...prev, allowFounderBypass: e.target.checked }))} />
                Founder Bypass
              </label>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={config.allowOnboardingBypass} onChange={(e) => setConfig((prev) => ({ ...prev, allowOnboardingBypass: e.target.checked }))} />
                Allow Onboarding Bypass
              </label>
              <div>
                <div style={label}>Mode</div>
                <select style={input} value={config.mode} onChange={(e) => setConfig((prev) => ({ ...prev, mode: e.target.value }))}>
                  <option value="pause">Pause</option>
                  <option value="readonly">Readonly</option>
                </select>
              </div>
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Status Message</div>
                <textarea
                  style={{ ...input, minHeight: 120 }}
                  value={config.statusMessage}
                  onChange={(e) => setConfig((prev) => ({ ...prev, statusMessage: e.target.value }))}
                />
              </div>
              <div>
                <div style={label}>Status Channel</div>
                <select style={input} value={config.statusChannelId || ""} onChange={(e) => setConfig((prev) => ({ ...prev, statusChannelId: e.target.value }))}>
                  <option value="">Not set</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 10, color: "#ffbcbc", lineHeight: 1.7 }}>
                  Use this to document where failsafe notices belong. The live app-level gate uses the configured status message immediately.
                </div>
              </div>
            </div>
          </section>

          <section style={box}>
            <div style={label}>Operator Notes</div>
            <textarea
              style={{ ...input, minHeight: 140 }}
              value={config.notes}
              onChange={(e) => setConfig((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </section>

          <section style={{ ...box, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffbcbc" }}>
              Shared links:
              <span style={{ marginLeft: 10 }}>
                <Link href={buildDashboardHref("/dashboard/security")} style={{ color: "#ffd0d0" }}>
                  Security Center
                </Link>
              </span>
              <span style={{ marginLeft: 10 }}>
                <Link href={buildDashboardHref("/dashboard/system-health")} style={{ color: "#ffd0d0" }}>
                  System Health
                </Link>
              </span>
            </div>
            <button style={button} disabled={saving} onClick={() => void save()}>
              {saving ? "Saving..." : "Save Failsafe"}
            </button>
          </section>
        </>
      )}
    </section>
  );
}
