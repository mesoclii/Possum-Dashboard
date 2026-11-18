"use client";

import { useState } from "react";

export type GuildEmoji = { id: string; name: string; token: string; animated?: boolean; available?: boolean };

export default function GuildEmojiPicker({ emojis, onInsert, loading = false, error = "" }: {
  emojis: GuildEmoji[];
  onInsert: (token: string) => void;
  loading?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const available = emojis.filter((emoji) => emoji.available !== false && emoji.token && /^\d+$/.test(emoji.id));
  const filtered = available.filter((emoji) => emoji.name.toLowerCase().includes(search.trim().toLowerCase()));
  if (loading) return <small>Loading server emojis...</small>;
  if (error) return <small role="alert" style={{ color: "#ff939f" }}>Could not load server emojis: {error}</small>;
  if (!available.length) return <small>No available server emoji found.</small>;
  return (
    <div style={{ minWidth: 0, marginTop: 4 }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} style={{ background: "#300018", color: "#ffd7e5", border: "1px solid #ba2755", borderRadius: 8, padding: "7px 10px", cursor: "pointer" }}>
        {open ? "Close server emojis" : "Choose server emoji"}
      </button>
      {open && <div style={{ background: "#180910", border: "1px solid #a7254c", borderRadius: 10, padding: 10, marginTop: 6, maxWidth: 360 }}>
        <input aria-label="Search server emojis" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search server emojis" style={{ width: "100%", boxSizing: "border-box", background: "#0a0a0a", color: "#fff", border: "1px solid #7a2742", borderRadius: 6, padding: 8 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))", gap: 5, maxHeight: 220, overflowY: "auto", marginTop: 8 }}>
          {filtered.map((emoji) => <button key={emoji.id} type="button" title={`:${emoji.name}:${emoji.animated ? " (animated)" : ""}`} aria-label={`Insert :${emoji.name}:${emoji.animated ? " animated" : ""}`} onClick={() => { onInsert(emoji.token); setOpen(false); }} style={{ background: "#2b101c", border: "1px solid #592036", borderRadius: 7, padding: 6, cursor: "pointer" }}>
            {/* Discord hosts server emoji thumbnails by their numeric IDs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}?size=48`} alt="" width={32} height={32} loading="lazy" />
          </button>)}
        </div>
        {!filtered.length && <small>No matching server emojis.</small>}
        <small style={{ display: "block", color: "#d9aebd", marginTop: 7 }}>Choose an emoji to insert it. Discord displays it when the message is sent.</small>
      </div>}
    </div>
  );
}
