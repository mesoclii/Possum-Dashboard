"use client";

import { useState } from "react";

export type GuildEmoji = { id: string; name: string; token: string; animated?: boolean; available?: boolean };

export default function GuildEmojiPicker({ emojis, onInsert }: { emojis: GuildEmoji[]; onInsert: (token: string) => void }) {
  const [selected, setSelected] = useState("");
  const available = emojis.filter((emoji) => emoji.available !== false && emoji.token);
  if (!available.length) return <small>No available server emoji found.</small>;
  const selectedIsAvailable = available.some((emoji) => emoji.token === selected);
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
      <select aria-label="Select server emoji" value={selectedIsAvailable ? selected : ""} onChange={(event) => setSelected(event.target.value)} style={{ minWidth: 0, flex: 1, background: "#0a0a0a", color: "#ffd7d7", border: "1px solid #6f0000", borderRadius: 6, padding: 6 }}>
        <option value="">Select server emoji</option>
        {available.map((emoji) => <option key={emoji.id} value={emoji.token}>:{emoji.name}:{emoji.animated ? " (animated)" : ""}</option>)}
      </select>
      <button type="button" disabled={!selectedIsAvailable} onClick={() => onInsert(selected)} style={{ background: "#220000", color: "#ffd7d7", border: "1px solid #7a0000", borderRadius: 6, padding: 6 }}>Insert</button>
    </div>
  );
}
