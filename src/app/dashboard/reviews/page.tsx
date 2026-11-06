"use client";

import type { CSSProperties } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type ReviewButtons = {
  oneLabel: string;
  twoLabel: string;
  threeLabel: string;
  fourLabel: string;
  fiveLabel: string;
  leaveLabel: string;
  oneEmoji: string;
  twoEmoji: string;
  threeEmoji: string;
  fourEmoji: string;
  fiveEmoji: string;
  leaveEmoji: string;
};

type ReviewConfig = {
  enabled: boolean;
  panelChannelId: string;
  panelMessageId: string;
  reviewChannelId: string;
  logChannelId: string;
  panelTitle: string;
  panelDescription: string;
  panelFooter: string;
  panelThumbnailUrl: string;
  panelImageUrl: string;
  accentColor: string;
  reviewCardTitle: string;
  reviewCardColor: string;
  buttons: ReviewButtons;
};

const DEFAULTS: ReviewConfig = {
  enabled: true,
  panelChannelId: "",
  panelMessageId: "",
  reviewChannelId: "",
  logChannelId: "",
  panelTitle: "Great Hall Rating Panel",
  panelDescription: "Click a star below to cast or update your rating.",
  panelFooter: "Possum Feedback Ledger",
  panelThumbnailUrl: "",
  panelImageUrl: "",
  accentColor: "#fbbf24",
  reviewCardTitle: "Great Hall Review",
  reviewCardColor: "#5865f2",
  buttons: {
    oneLabel: "1 Star",
    twoLabel: "2 Star",
    threeLabel: "3 Star",
    fourLabel: "4 Star",
    fiveLabel: "5 Star",
    leaveLabel: "Leave Review",
    oneEmoji: "",
    twoEmoji: "",
    threeEmoji: "",
    fourEmoji: "",
    fiveEmoji: "",
    leaveEmoji: "",
  },
};

const box: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.10)",
  marginBottom: 12,
};

const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 8,
  padding: "10px 12px",
};

export default function ReviewsDashboardPage() {
  const {
    guildId,
    guildName,
    config: cfg,
    setConfig: setCfg,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
  } = useGuildEngineEditor<ReviewConfig>("reviews", DEFAULTS);

  const textChannels = channels.filter((c) => Number(c?.type) === 0 || Number(c?.type) === 5 || String(c?.type || "").toLowerCase().includes("text"));

  function update(patch: Partial<ReviewConfig>) {
    setCfg((prev) => ({ ...(prev || DEFAULTS), ...patch }));
  }

  function updateButtons(patch: Partial<ReviewButtons>) {
    setCfg((prev) => ({
      ...(prev || DEFAULTS),
      buttons: {
        ...(prev?.buttons || DEFAULTS.buttons),
        ...patch,
      },
    }));
  }

  if (!guildId) {
    return <div style={{ color: "#ff8080", padding: 24 }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={{ color: "#ffd0d0", padding: 18, maxWidth: 1280 }}>
      <h1 style={{ margin: 0, color: "#ff4444", letterSpacing: "0.12em", textTransform: "uppercase" }}>Reviews</h1>
      <div style={{ color: "#ff9999", marginTop: 6, marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? <div style={box}>Loading...</div> : (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={box}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label><input type="checkbox" checked={cfg.enabled !== false} onChange={(e) => update({ enabled: e.target.checked })} /> Reviews enabled</label>
              <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving} onClick={() => void runAction("deployPanel")}>Deploy Panel</button>
              <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 800 }} disabled={saving} onClick={() => void runAction("clearReviews")}>Clear Reviews + Votes</button>
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <div>
                <div>Panel Channel</div>
                <select style={input} value={cfg.panelChannelId || ""} onChange={(e) => update({ panelChannelId: e.target.value })}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div>Review Channel</div>
                <select style={input} value={cfg.reviewChannelId || ""} onChange={(e) => update({ reviewChannelId: e.target.value })}>
                  <option value="">Use panel channel</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div>Operational Log Channel</div>
                <select style={input} value={cfg.logChannelId || ""} onChange={(e) => update({ logChannelId: e.target.value })}>
                  <option value="">None</option>
                  {textChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
              <div>
                <div>Panel Message Id</div>
                <input style={input} value={cfg.panelMessageId || ""} onChange={(e) => update({ panelMessageId: e.target.value })} placeholder="Saved after deploy" />
              </div>
            </div>
          </section>

          <section style={box}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
              <div><div>Panel Title</div><input style={input} value={cfg.panelTitle || ""} onChange={(e) => update({ panelTitle: e.target.value })} /></div>
              <div><div>Panel Footer</div><input style={input} value={cfg.panelFooter || ""} onChange={(e) => update({ panelFooter: e.target.value })} /></div>
              <div><div>Accent Color</div><input style={input} value={cfg.accentColor || ""} onChange={(e) => update({ accentColor: e.target.value })} placeholder="#fbbf24" /></div>
              <div><div>Review Card Color</div><input style={input} value={cfg.reviewCardColor || ""} onChange={(e) => update({ reviewCardColor: e.target.value })} placeholder="#5865f2" /></div>
              <div style={{ gridColumn: "1 / -1" }}><div>Panel Description</div><textarea style={{ ...input, minHeight: 90 }} value={cfg.panelDescription || ""} onChange={(e) => update({ panelDescription: e.target.value })} /></div>
              <div><div>Panel Thumbnail URL</div><input style={input} value={cfg.panelThumbnailUrl || ""} onChange={(e) => update({ panelThumbnailUrl: e.target.value })} placeholder="https://..." /></div>
              <div><div>Panel Background Image URL</div><input style={input} value={cfg.panelImageUrl || ""} onChange={(e) => update({ panelImageUrl: e.target.value })} placeholder="https://..." /></div>
              <div><div>Review Card Title</div><input style={input} value={cfg.reviewCardTitle || ""} onChange={(e) => update({ reviewCardTitle: e.target.value })} /></div>
            </div>
          </section>

          <section style={box}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Button Labels + Emojis</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <div><div>1 Star Label</div><input style={input} value={cfg.buttons?.oneLabel || ""} onChange={(e) => updateButtons({ oneLabel: e.target.value })} /></div>
              <div><div>1 Star Emoji</div><input style={input} value={cfg.buttons?.oneEmoji || ""} onChange={(e) => updateButtons({ oneEmoji: e.target.value })} /></div>
              <div><div>2 Star Label</div><input style={input} value={cfg.buttons?.twoLabel || ""} onChange={(e) => updateButtons({ twoLabel: e.target.value })} /></div>
              <div><div>2 Star Emoji</div><input style={input} value={cfg.buttons?.twoEmoji || ""} onChange={(e) => updateButtons({ twoEmoji: e.target.value })} /></div>
              <div><div>3 Star Label</div><input style={input} value={cfg.buttons?.threeLabel || ""} onChange={(e) => updateButtons({ threeLabel: e.target.value })} /></div>
              <div><div>3 Star Emoji</div><input style={input} value={cfg.buttons?.threeEmoji || ""} onChange={(e) => updateButtons({ threeEmoji: e.target.value })} /></div>
              <div><div>4 Star Label</div><input style={input} value={cfg.buttons?.fourLabel || ""} onChange={(e) => updateButtons({ fourLabel: e.target.value })} /></div>
              <div><div>4 Star Emoji</div><input style={input} value={cfg.buttons?.fourEmoji || ""} onChange={(e) => updateButtons({ fourEmoji: e.target.value })} /></div>
              <div><div>5 Star Label</div><input style={input} value={cfg.buttons?.fiveLabel || ""} onChange={(e) => updateButtons({ fiveLabel: e.target.value })} /></div>
              <div><div>5 Star Emoji</div><input style={input} value={cfg.buttons?.fiveEmoji || ""} onChange={(e) => updateButtons({ fiveEmoji: e.target.value })} /></div>
              <div><div>Review Button Label</div><input style={input} value={cfg.buttons?.leaveLabel || ""} onChange={(e) => updateButtons({ leaveLabel: e.target.value })} /></div>
              <div><div>Review Button Emoji</div><input style={input} value={cfg.buttons?.leaveEmoji || ""} onChange={(e) => updateButtons({ leaveEmoji: e.target.value })} /></div>
            </div>
          </section>

          <button type="button" style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }} disabled={saving} onClick={() => void save()}>
            {saving ? "Saving..." : "Save Reviews"}
          </button>
        </>
      )}
    </div>
  );
}
