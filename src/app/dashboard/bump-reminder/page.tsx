"use client";

import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type BumpConfig = {
  enabled: boolean;
  channelId: string;
  pingRoleId: string;
  disboardEnabled: boolean;
  discadiaEnabled: boolean;
  discordsEnabled: boolean;
  disboardCooldownMinutes: number;
  discadiaCooldownMinutes: number;
  discordsCooldownMinutes: number;
};

const EMPTY: BumpConfig = {
  enabled: false,
  channelId: "",
  pingRoleId: "",
  disboardEnabled: true,
  discadiaEnabled: true,
  discordsEnabled: true,
  disboardCooldownMinutes: 120,
  discadiaCooldownMinutes: 1440,
  discordsCooldownMinutes: 1440,
};

export default function BumpReminderPage() {
  const { guildId, guildName, config, setConfig, channels, roles, loading, saving, message, save, runAction } = useGuildEngineEditor<BumpConfig>("bumpReminder", EMPTY);
  const textChannels = channels.filter((channel) => String(channel.type) === "0" || String(channel.type).toLowerCase() === "guildtext");

  if (!guildId) return <div style={{ color: "#ffe9f6", padding: 18 }}>Open this page from a guild.</div>;

  return (
    <div style={{ color: "#ffe9f6", padding: 18, maxWidth: 860 }}>
      <h1 style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>Bump Reminder</h1>
      <p style={{ color: "#ffe9f6" }}>{guildName || "Selected server"}</p>
      <p style={{ color: "#ffe9f6", maxWidth: 720 }}>
        Possum reminds the pingers role in your selected channel. Disboard and Discadia are detected from their successful bump messages. Discords.com is manual: refresh your listing yourself, then record it below. Possum never bumps automatically.
      </p>
      {!config.enabled ? <p role="status" style={{ color: "#ffb7c7" }}>Reminders are off until you enable them and save.</p> : null}
      {config.enabled && !config.pingRoleId ? <p role="status" style={{ color: "#ffb7c7" }}>Choose a pingers role before reminders can be recorded or sent. The reminder will stay pending until it can ping that role.</p> : null}
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
      <section style={{ marginTop: 20, padding: 14, border: "1px solid #ef3972", borderRadius: 10 }}>
        <h2 style={{ margin: "0 0 8px" }}>Discords.com</h2>
        <p style={{ margin: "0 0 10px", maxWidth: 720 }}>
          <a href="https://discords.com/" target="_blank" rel="noreferrer">Open Discords.com</a>. After you manually refresh the listing there, use the button below to start this server&apos;s reminder timer. This page does not automate site activity.
        </p>
        <label style={{ display: "block" }}>
          <input type="checkbox" checked={config.discordsEnabled !== false} onChange={(event) => setConfig({ ...config, discordsEnabled: event.target.checked })} /> Discords.com reminders
        </label>
        <label style={{ display: "block", marginTop: 8 }}>
          Reminder delay (minutes)
          <input type="number" min={1} max={10080} style={{ display: "block", marginTop: 6, width: 140 }} value={config.discordsCooldownMinutes || 1440} onChange={(event) => setConfig({ ...config, discordsCooldownMinutes: Number(event.target.value) })} />
        </label>
        <button
          type="button"
          disabled={loading || saving || !config.enabled || config.discordsEnabled === false || !config.channelId || !config.pingRoleId}
          onClick={() => void runAction("recordDiscordsBump")}
          style={{ marginTop: 12 }}
          title={!config.channelId ? "Choose and save a reminder channel first." : "Record a completed manual listing refresh."}
        >
          I refreshed the Discords.com listing
        </button>
        {!config.channelId ? <p style={{ marginBottom: 0 }}>Choose and save a reminder channel before recording a Discords.com refresh.</p> : null}
      </section>
      <p style={{ color: "#ffe9f6" }}>Defaults: 120 minutes for Disboard and 1440 minutes for Discadia and Discords.com. Set each delay to match your listing&apos;s own cooldown.</p>
      <p style={{ color: "#ffe9f6" }}>Select the pingers role here; it is separate from VIP roles. If it is not mentionable, the bot needs permission to mention roles in the reminder channel.</p>
      <button type="button" disabled={loading || saving} onClick={() => void save()} style={{ marginTop: 12 }}>
        {saving ? "Saving" : "Save"}
      </button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
