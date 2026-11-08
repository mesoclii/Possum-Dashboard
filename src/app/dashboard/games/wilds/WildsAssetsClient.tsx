"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveGuildContext } from "@/lib/liveRuntime";

type AssetRow = {
  slug: string;
  name: string;
  rarity: string;
  family: string;
  biome: string;
  imageUrl: string;
  licence: string;
  credit: string;
  notes: string;
  approved: boolean;
  orphaned?: boolean;
};

type AssetPayload = {
  dir: string;
  manifestPath: string;
  baseUrl: string;
  updatedAt: string | null;
  rows: AssetRow[];
};

const panel: React.CSSProperties = {
  border: "1px solid #2a2a2a",
  borderRadius: 10,
  padding: 16,
  background: "#141414",
  color: "#e6e6e6",
  marginBottom: 16,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#0f0f0f",
  color: "#e6e6e6",
  fontSize: 13,
};

const button: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #3f6f4a",
  background: "#3f6f4a",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

export default function WildsAssetsClient() {
  const [guildId, setGuildId] = useState("");
  const [payload, setPayload] = useState<AssetPayload | null>(null);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const context = resolveGuildContext();
    setGuildId(context.guildId);
    if (!context.guildId) {
      setLoading(false);
      setStatus("Pick a server first.");
      return;
    }
    void load(context.guildId);
  }, []);

  async function load(id: string) {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`/api/bot/wilds-assets?guildId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      setPayload({
        dir: String(json.dir || ""),
        manifestPath: String(json.manifestPath || ""),
        baseUrl: String(json.baseUrl || ""),
        updatedAt: json.updatedAt ? String(json.updatedAt) : null,
        rows: Array.isArray(json.rows) ? json.rows : [],
      });
      setRows(Array.isArray(json.rows) ? json.rows : []);
      setDirty(new Set());
    } catch (err: any) {
      setStatus(err?.message || "Could not load species art.");
    } finally {
      setLoading(false);
    }
  }

  function update(index: number, patch: Partial<AssetRow>) {
    setRows((current) => {
      const next = current.slice();
      const row = { ...next[index], ...patch };
      next[index] = row;
      if (row.slug) {
        const keys = new Set(dirty);
        keys.add(row.slug);
        setDirty(keys);
      }
      return next;
    });
  }

  async function save() {
    if (!guildId) return;
    const species: Record<string, unknown> = {};
    for (const row of rows) {
      const slug = String(row.slug || "").trim();
      if (!slug || !dirty.has(slug)) continue;
      species[slug] = {
        imageUrl: row.imageUrl,
        licence: row.licence,
        credit: row.credit,
        notes: row.notes,
        approved: row.approved,
      };
    }
    if (!Object.keys(species).length) {
      setStatus("Nothing changed yet.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/bot/wilds-assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, species, baseUrl: payload?.baseUrl || "" }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `Save failed (${res.status})`);
      }
      setPayload((current) =>
        current
          ? { ...current, updatedAt: json.updatedAt ? String(json.updatedAt) : current.updatedAt, rows: Array.isArray(json.rows) ? json.rows : current.rows }
          : current
      );
      if (Array.isArray(json.rows)) setRows(json.rows);
      setDirty(new Set());
      const rejected = Array.isArray(json.rejected) ? json.rejected : [];
      setStatus(rejected.length ? `Saved ${json.applied || 0}, rejected ${rejected.length}: ${rejected[0].error}` : "Saved.");
    } catch (err: any) {
      setStatus(err?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (onlyMissing && String(row.imageUrl || "").trim()) return false;
      if (!needle) return true;
      return `${row.slug} ${row.name} ${row.family} ${row.biome}`.toLowerCase().includes(needle);
    });
  }, [rows, query, onlyMissing]);

  const filled = rows.filter((row) => String(row.imageUrl || "").trim()).length;
  const approved = rows.filter((row) => row.approved && String(row.imageUrl || "").trim()).length;

  return (
    <div style={{ padding: 24, maxWidth: 1180 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Possum Wilds art</h1>
      <p style={{ color: "#9a9a9a", marginBottom: 16, fontSize: 13 }}>
        Point each species at an image, record where it came from, and approve the ones that may appear in game.
        Entries are stored in one manifest the bot reads; approving without a URL does nothing.
      </p>

      <div style={{ ...panel, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div><strong>{filled}</strong> of {rows.length} species have art</div>
        <div><strong>{approved}</strong> approved</div>
        {payload?.updatedAt ? <div style={{ color: "#9a9a9a" }}>Last saved {new Date(payload.updatedAt).toLocaleString()}</div> : null}
        <div style={{ color: "#9a9a9a", fontSize: 12, wordBreak: "break-all" }}>{payload?.manifestPath || ""}</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          style={{ ...input, maxWidth: 320 }}
          placeholder="Filter by species, family or biome"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />
          Only missing art
        </label>
        <button style={{ ...button, opacity: saving ? 0.6 : 1 }} onClick={() => void save()} disabled={saving || !guildId}>
          {saving ? "Saving..." : `Save ${dirty.size || ""}`.trim()}
        </button>
        <button
          style={{ ...button, background: "#222", borderColor: "#3a3a3a" }}
          onClick={() => guildId && void load(guildId)}
          disabled={loading}
        >
          Reload
        </button>
      </div>

      {status ? <div style={{ marginBottom: 12, fontSize: 13, color: "#d8b45a" }}>{status}</div> : null}
      {loading ? <div style={{ color: "#9a9a9a" }}>Loading species...</div> : null}

      <div style={{ display: "grid", gap: 10 }}>
        {visible.map((row) => {
          const index = rows.indexOf(row);
          return (
            <div key={row.slug} style={{ ...panel, marginBottom: 0, borderColor: dirty.has(row.slug) ? "#3f6f4a" : "#2a2a2a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>{row.name}</strong>{" "}
                  <span style={{ color: "#9a9a9a", fontSize: 12 }}>
                    {row.slug} · {row.rarity}
                    {row.biome ? ` · ${row.biome}` : ""}
                    {row.orphaned ? " · not in catalog" : ""}
                  </span>
                </div>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={row.approved}
                    onChange={(event) => update(index, { approved: event.target.checked })}
                  />
                  Approved for game
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr", gap: 8 }}>
                <label style={{ fontSize: 12, color: "#9a9a9a" }}>
                  Image URL or /path
                  <input
                    style={input}
                    value={row.imageUrl}
                    placeholder="https://... or /wilds/gray-wolf.png"
                    onChange={(event) => update(index, { imageUrl: event.target.value })}
                  />
                </label>
                <label style={{ fontSize: 12, color: "#9a9a9a" }}>
                  Licence
                  <input
                    style={input}
                    value={row.licence}
                    placeholder="CC BY 4.0"
                    onChange={(event) => update(index, { licence: event.target.value })}
                  />
                </label>
                <label style={{ fontSize: 12, color: "#9a9a9a" }}>
                  Credit
                  <input
                    style={input}
                    value={row.credit}
                    placeholder="Artist name"
                    onChange={(event) => update(index, { credit: event.target.value })}
                  />
                </label>
                <label style={{ fontSize: 12, color: "#9a9a9a" }}>
                  Notes
                  <input
                    style={input}
                    value={row.notes}
                    placeholder="Where it came from, edits made"
                    onChange={(event) => update(index, { notes: event.target.value })}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && !visible.length ? <div style={{ color: "#9a9a9a" }}>No species match that filter.</div> : null}
    </div>
  );
}
