"use client";

import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

const shell: React.CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1280 };

export default function AnalyticsClient() {
  const { guildId, guildName, summary, details, loading, message } = useGuildEngineEditor<{ enabled: boolean }>(
    "analytics",
    { enabled: true }
  );

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8a8a" }}>Missing guildId. Open from `/guilds` first.</div>;
  }

  return (
    <div style={shell}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Analytics</h1>
      <div style={{ color: "#ff9c9c", marginTop: 6 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb0b0", fontSize: 12, marginTop: 4 }}>
        Growth, activity, retention and moderation reports for this server. Member activity is tracked from when the bot started observing the server.
      </div>
      {message ? <div style={{ color: "#ffd27a", marginTop: 8 }}>{message}</div> : null}
      {loading ? (
        <div style={{ marginTop: 12 }}>Loading analytics...</div>
      ) : (
        <EngineInsights summary={summary} details={details} showDetails />
      )}
    </div>
  );
}
