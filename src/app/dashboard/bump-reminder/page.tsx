"use client";

import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type BumpConfig = {
  enabled: boolean;
  channelId: string;
  pingRoleId: string;
  disboardEnabled: boolean;
  discadiaEnabled: boolean;
  disboardCooldownMinutes: number;
  discadiaCooldownMinutes: number;
};

const EMPTY: BumpConfig = {
  enabled: false,
  channelId: "",
  pingRoleId: "",
  disboardEnabled: true,
  discadiaEnabled: true,
  disboardCooldownMinutes: 120,
  discadiaCooldownMinutes: 1440,
};

export default function BumpReminderPage() {
  const { guildId, guildName, config, setConfig, channels, roles, loading, saving, message, save } = useGuildEngineEditor<BumpConfig>("bumpReminder", EMPTY);
  const textChannels = channels.filter((channel) => String(channel.type) === "0" || String(channel.type).toLowerCase() === "guildtext");

  if (!guildId) return <div style={{ color: "#ffe9f6", padding: 18 }}>Open this page from a guild.</div>;

  return (
    <div style={{ color: "#ffe9f6", padding: 18, maxWidth: 860 }}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Bump Reminder</h1>
      <p style={{ color: "#ffe9f6" }}>{guildName || guildId}</p>
      <p style={{ color: "#ffe9f6", maxWidth: 720 }}>
        Possum watches Disboard and Discadia for a successful bump, then tags the pingers role in this channel when that listing can be bumped again. Someone still runs /bump. Possum does not bump for you.
      </p>
      <label style={{ display: "block", marginTop: 12 }}>
        <input type="checkbox" checked={config.enabled === true} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} /> Enable reminder
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        Reminder channel
        <select style={{ display: "block", marginTop: 6, minWidth: 280 }} value={config.channelId || ""} onChange={(event) => setConfig({ ...config, channelId: event.target.value })}>
          <option value="">Same channel as the bump</option>
          {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
        </select>
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        Pingers role
        <select style={{ display: "block", marginTop: 6, minWidth: 280 }} value={config.pingRoleId || ""} onChange={(event) => setConfig({ ...config, pingRoleId: event.target.value })}>
          <option value="">No role ping</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        <input type="checkbox" checked={config.disboardEnabled !== false} onChange={(event) => setConfig({ ...config, disboardEnabled: event.target.checked })} /> Disboard
      </label>
      <label style={{ display: "block", marginTop: 8 }}>
        Disboard cooldown minutes
        <input type="number" min={1} max={10080} style={{ display: "block", marginTop: 6, width: 140 }} value={config.disboardCooldownMinutes || 120} onChange={(event) => setConfig({ ...config, disboardCooldownMinutes: Number(event.target.value) })} />
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        <input type="checkbox" checked={config.discadiaEnabled !== false} onChange={(event) => setConfig({ ...config, discadiaEnabled: event.target.checked })} /> Discadia
      </label>
      <label style={{ display: "block", marginTop: 8 }}>
        Discadia cooldown minutes
        <input type="number" min={1} max={10080} style={{ display: "block", marginTop: 6, width: 140 }} value={config.discadiaCooldownMinutes || 1440} onChange={(event) => setConfig({ ...config, discadiaCooldownMinutes: Number(event.target.value) })} />
      </label>
      <p style={{ color: "#ffe9f6" }}>Free defaults are 120 minutes for Disboard and 1440 for Discadia. Use 720 for Discadia Lite or 360 for King.</p>
      <button type="button" disabled={loading || saving} onClick={() => void save()} style={{ marginTop: 12 }}>
        {saving ? "Saving" : "Save"}
      </button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
