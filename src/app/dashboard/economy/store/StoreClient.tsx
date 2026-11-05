/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import ConfigJsonEditor from "@/components/possum/ConfigJsonEditor";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";
import { fetchRuntimeEngine } from "@/lib/liveRuntime";

type Role = { id: string; name: string };
type Channel = { id: string; name: string; type?: number | string };
type StoreImage = { url: string; label?: string };

type StoreItem = {
  id: string;
  name: string;
  description: string;
  type: "role" | "item" | "perk";
  roleId: string;
  priceCoins: number;
  priceCurrencyType: "coins" | "eventPoints";
  stock: number;
  oneTime: boolean;
  enabled: boolean;
  imageUrl: string;
};

type StoreConfig = {
  active: boolean;
  panel: {
    enabled: boolean;
    channelId: string;
    title: string;
    description: string;
    buttonLabel: string;
    embedColor: string;
    imageUrl: string;
    imageLibrary: StoreImage[];
  };
  policies: {
    maxItemsPerPurchase: number;
    allowRoleStacking: boolean;
    requireStaffApproval: boolean;
    logChannelId: string;
  };
  items: StoreItem[];
};

const DEFAULT_CONFIG: StoreConfig = {
  active: true,
  panel: {
    enabled: true,
    channelId: "",
    title: "Server Store",
    description: "Spend coins or event currency on roles, perks, and items.",
    buttonLabel: "Open Store",
    embedColor: "#ff3b3b",
    imageUrl: "",
    imageLibrary: [],
  },
  policies: {
    maxItemsPerPurchase: 1,
    allowRoleStacking: false,
    requireStaffApproval: false,
    logChannelId: "",
  },
  items: [
    {
      id: "vip-trial",
      name: "VIP Trial",
      description: "Temporary VIP access",
      type: "role",
      roleId: "",
      priceCoins: 5000,
      priceCurrencyType: "coins",
      stock: -1,
      oneTime: true,
      enabled: true,
      imageUrl: "",
    },
  ],
};

function createDraftItem(id = `item-${Date.now()}`): StoreItem {
  return {
    id,
    name: "",
    description: "",
    type: "item",
    roleId: "",
    priceCoins: 0,
    priceCurrencyType: "coins",
    stock: -1,
    oneTime: false,
    enabled: true,
    imageUrl: "",
  };
}

function normalizeItems(raw: unknown): StoreItem[] {
  if (!Array.isArray(raw)) return DEFAULT_CONFIG.items.map((item) => ({ ...item }));
  return raw.map((entry, index) => {
    const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const meta = item.meta && typeof item.meta === "object" ? (item.meta as Record<string, unknown>) : {};
    const rawType = String(item.type || "item");
    const type: StoreItem["type"] = rawType === "role" || rawType === "perk" ? rawType : "item";
    const rawPrice = Number(item.priceCoins ?? item.price ?? 0);
    const rawCurrencyType = String(item.priceCurrencyType ?? item.currencyType ?? meta.currencyType ?? "coins").trim().toLowerCase();
    const priceCurrencyType: StoreItem["priceCurrencyType"] = rawCurrencyType === "eventpoints" || rawCurrencyType === "event_points" || rawCurrencyType === "event" ? "eventPoints" : "coins";
    const rawStock = Number(item.stock);
    return {
      id: String(item.id || `item-${index + 1}`).trim() || `item-${index + 1}`,
      name: String(item.name || "").trim(),
      description: String(item.description || "").trim(),
      type,
      roleId: String(item.roleId || "").trim(),
      priceCoins: Number.isFinite(rawPrice) ? Math.min(1_000_000_000, Math.max(0, Math.floor(rawPrice))) : 0,
      priceCurrencyType,
      stock: Number.isFinite(rawStock) ? Math.min(1_000_000, Math.max(-1, Math.floor(rawStock))) : -1,
      oneTime: Boolean(item.oneTime ?? meta.oneTime),
      enabled: item.enabled !== false,
      imageUrl: String(item.imageUrl || meta.imageUrl || "").trim(),
    };
  });
}

function normalizeLibrary(raw: unknown): StoreImage[] {
  if (!Array.isArray(raw)) return [];
  const out: StoreImage[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const url = String((row as StoreImage | undefined)?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      label: String((row as StoreImage | undefined)?.label || "").trim().slice(0, 120),
    });
  }
  return out;
}

function mergeConfig(raw: Partial<StoreConfig> | null | undefined): StoreConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(raw || {}),
    panel: {
      ...DEFAULT_CONFIG.panel,
      ...(raw?.panel || {}),
      imageLibrary: normalizeLibrary(raw?.panel?.imageLibrary),
    },
    policies: {
      ...DEFAULT_CONFIG.policies,
      ...(raw?.policies || {}),
    },
    items: raw?.items !== undefined ? normalizeItems(raw.items) : DEFAULT_CONFIG.items.map((item) => ({ ...item })),
  };
}

const box: React.CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 12,
  padding: 14,
  background: "rgba(120,0,0,0.07)",
  marginBottom: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  background: "#0a0a0a",
  border: "1px solid #6f0000",
  color: "#ffd7d7",
  borderRadius: 8,
};

export default function StorePage() {
  const {
    guildId,
    guildName,
    config: rawCfg,
    setConfig: setCfg,
    roles,
    channels,
    summary,
    details,
    loading,
    saving,
    message,
    save,
  } = useGuildEngineEditor<StoreConfig>("store", DEFAULT_CONFIG);

  const cfg = mergeConfig(rawCfg);
  const [localMsg, setLocalMsg] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageLabel, setNewImageLabel] = useState("");
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [eventCurrencyLabel, setEventCurrencyLabel] = useState("event currency");
  const visibleMessage = localMsg || message;
  const textChannels = (channels as Channel[]).filter(
    (channel) => Number(channel?.type) === 0 || Number(channel?.type) === 5 || String(channel?.type || "").toLowerCase().includes("text")
  );
  const activeItemIndex = cfg.items.length ? Math.max(0, Math.min(selectedItemIndex, cfg.items.length - 1)) : -1;
  const activeItem = activeItemIndex >= 0 ? cfg.items[activeItemIndex] : null;

  useEffect(() => {
    if (!guildId) return;
    let ignore = false;
    void fetchRuntimeEngine(guildId, "eventPoints")
      .then((json) => {
        if (ignore) return;
        const currencyName = String(json?.config?.currencyName || "event currency").trim() || "event currency";
        const currencyEmoji = String(json?.config?.currencyEmoji || "").trim();
        setEventCurrencyLabel(`${currencyEmoji ? `${currencyEmoji} ` : ""}${currencyName}`.trim());
      })
      .catch(() => {
        if (!ignore) setEventCurrencyLabel("event currency");
      });
    return () => {
      ignore = true;
    };
  }, [guildId]);

  function formatPrice(item: StoreItem | null | undefined) {
    if (!item) return "";
    return item.priceCurrencyType === "eventPoints" ? `${item.priceCoins} ${eventCurrencyLabel}` : `${item.priceCoins} coins`;
  }

  async function saveStore(nextConfig: StoreConfig = cfg) {
    setLocalMsg("");
    const normalized = mergeConfig(nextConfig);
    const seenIds = new Set<string>();
    for (const [index, item] of normalized.items.entries()) {
      const engineId = item.id.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
      const label = item.name || item.id || `#${index + 1}`;
      if (!engineId) {
        setLocalMsg(`Item "${label}" needs an Item ID (letters, numbers, - or _).`);
        return;
      }
      if (!item.name.trim()) {
        setLocalMsg(`Item "${item.id}" needs a display name.`);
        return;
      }
      if (seenIds.has(engineId)) {
        setLocalMsg(`Item ID "${engineId}" is used more than once. IDs must be unique.`);
        return;
      }
      seenIds.add(engineId);
    }
    setCfg(normalized);
    await save(normalized);
  }

  function addPanelImage(newImageUrl: string, newImageLabel: string, reset: () => void) {
    const url = String(newImageUrl || "").trim();
    if (!url) return;
    if (cfg.panel.imageLibrary.some((item) => item.url === url)) {
      setLocalMsg("Image already in library.");
      return;
    }
    setCfg((prev) => ({
      ...prev,
      panel: {
        ...prev.panel,
        imageLibrary: [...prev.panel.imageLibrary, { url, label: String(newImageLabel || "").trim() }],
      },
    }));
    reset();
    setLocalMsg("Added image to library. Save Store to persist.");
  }

  function removePanelImage(url: string) {
    setCfg((prev) => ({
      ...prev,
      panel: {
        ...prev.panel,
        imageLibrary: prev.panel.imageLibrary.filter((item) => item.url !== url),
        imageUrl: prev.panel.imageUrl === url ? "" : prev.panel.imageUrl,
      },
    }));
    setLocalMsg("");
  }

  function setPanelBackground(url: string) {
    setCfg((prev) => ({ ...prev, panel: { ...prev.panel, imageUrl: url } }));
    setLocalMsg("");
  }

  function addItem() {
    const nextIndex = cfg.items.length;
    setCfg((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        createDraftItem(),
      ],
    }));
    setSelectedItemIndex(nextIndex);
    setLocalMsg("");
  }

  function updateItem(index: number, patch: Partial<StoreItem>) {
    setCfg((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], ...patch };
      return { ...prev, items };
    });
  }

  function removeItem(index: number) {
    setCfg((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSelectedItemIndex((prev) => Math.max(0, prev > index ? prev - 1 : prev === index ? index - 1 : prev));
    setLocalMsg("");
  }

  if (!guildId) {
    return <div style={{ color: "#ff7777", padding: 20 }}>Missing guildId.</div>;
  }

  return (
    <div style={{ color: "#ff4d4d", padding: 20, maxWidth: 1180 }}>
      <h1 style={{ marginTop: 0, letterSpacing: "0.12em", textTransform: "uppercase" }}>Economy - Store Engine</h1>
      <p>Guild: {guildName || guildId}</p>
      <div style={{ color: "#ffb7b7", lineHeight: 1.6, marginBottom: 12 }}>
        Store now writes straight into the live guild store engine. Catalog items, panel art, policy toggles, and role grants stay on the same runtime path the bot uses.
      </div>
      {visibleMessage ? <div style={{ marginBottom: 12, color: "#ffd1d1" }}>{visibleMessage}</div> : null}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <EngineInsights summary={summary} details={details} />

          <div style={{ ...box, marginTop: 14 }}>
            <label>
              <input
                type="checkbox"
                checked={cfg.active}
                onChange={(e) => setCfg((prev) => ({ ...prev, active: e.target.checked }))}
              />{" "}
              Store engine active
            </label>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Store Panel</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Panel channel (blank = channel where /showstore is used)</label>
                <select
                  style={input}
                  value={cfg.panel.channelId}
                  onChange={(e) => setCfg((prev) => ({ ...prev, panel: { ...prev.panel, channelId: e.target.value } }))}
                >
                  <option value="">Current channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Log channel</label>
                <select
                  style={input}
                  value={cfg.policies.logChannelId}
                  onChange={(e) => setCfg((prev) => ({ ...prev, policies: { ...prev.policies, logChannelId: e.target.value } }))}
                >
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Panel title</label>
              <input
                style={input}
                value={cfg.panel.title}
                onChange={(e) => setCfg((prev) => ({ ...prev, panel: { ...prev.panel, title: e.target.value } }))}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Panel description</label>
              <textarea
                style={{ ...input, minHeight: 80 }}
                value={cfg.panel.description}
                onChange={(e) => setCfg((prev) => ({ ...prev, panel: { ...prev.panel, description: e.target.value } }))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <label>Embed color</label>
                <input
                  style={input}
                  placeholder="#ff3b3b"
                  value={cfg.panel.embedColor}
                  onChange={(e) => setCfg((prev) => ({ ...prev, panel: { ...prev.panel, embedColor: e.target.value } }))}
                />
              </div>
              <div>
                <label>Selected background image URL</label>
                <input
                  style={input}
                  value={cfg.panel.imageUrl}
                  onChange={(e) => setCfg((prev) => ({ ...prev, panel: { ...prev.panel, imageUrl: e.target.value } }))}
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={cfg.panel.enabled}
                  onChange={(e) => setCfg((prev) => ({ ...prev, panel: { ...prev.panel, enabled: e.target.checked } }))}
                />{" "}
                Panel enabled
              </label>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Store Background Image Library</h3>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8 }}>
              <input
                style={input}
                placeholder="Image URL"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
              />
              <input
                style={input}
                placeholder="Label (optional)"
                value={newImageLabel}
                onChange={(e) => setNewImageLabel(e.target.value)}
              />
              <button
                onClick={() => addPanelImage(newImageUrl, newImageLabel, () => {
                  setNewImageUrl("");
                  setNewImageLabel("");
                })}
                style={{ ...input, width: "auto", cursor: "pointer" }}
                type="button"
              >
                Add
              </button>
            </div>

            {cfg.panel.imageLibrary.length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {cfg.panel.imageLibrary.map((img) => (
                  <div key={img.url} style={{ border: "1px solid #5f0000", borderRadius: 8, padding: 8, display: "grid", gridTemplateColumns: "88px 1fr auto auto", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 88, height: 56, borderRadius: 8, overflow: "hidden", border: "1px solid #3a0000", background: "#0a0a0a" }}>
                      <img src={img.url} alt={img.label || "Store library image"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div>
                      <div style={{ color: "#ffd6d6", fontWeight: 700 }}>{img.label || "Store background"}</div>
                      <div style={{ color: "#ff9f9f", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{img.url}</div>
                    </div>
                    <button type="button" onClick={() => setPanelBackground(img.url)} style={{ ...input, width: "auto", cursor: "pointer" }}>
                      {cfg.panel.imageUrl === img.url ? "Selected" : "Select"}
                    </button>
                    <button type="button" onClick={() => removePanelImage(img.url)} style={{ ...input, width: "auto", cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 10, color: "#ff9f9f", fontSize: 12 }}>No images in library yet.</div>
            )}

            {cfg.panel.imageUrl ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#ffb3b3", marginBottom: 4, fontSize: 12 }}>Current background preview</div>
                <img src={cfg.panel.imageUrl} alt="Store background preview" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #5f0000" }} />
              </div>
            ) : null}
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Policies</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <div>
                <label>Require staff approval</label>
                <br />
                <input
                  type="checkbox"
                  checked={cfg.policies.requireStaffApproval}
                  onChange={(e) => setCfg((prev) => ({ ...prev, policies: { ...prev.policies, requireStaffApproval: e.target.checked } }))}
                />
                <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 4 }}>
                  Role purchases are charged and logged to the log channel; staff then grant the role manually.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label>
                <input
                  type="checkbox"
                  checked={cfg.policies.allowRoleStacking}
                  onChange={(e) => setCfg((prev) => ({ ...prev, policies: { ...prev.policies, allowRoleStacking: e.target.checked } }))}
                />{" "}
                Allow role stacking
              </label>
            </div>
          </div>

          <div style={box}>
            <h3 style={{ marginTop: 0, color: "#ff4444" }}>Store Items</h3>
            <div style={{ color: "#ffb7b7", marginBottom: 10, lineHeight: 1.5 }}>
              Build each catalog entry like a visual shop card first, then tune the behavior underneath. The image library above doubles as a quick asset picker for each item.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button type="button" onClick={addItem} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 700 }}>
                + Add Item
              </button>
              <button
                type="button"
                onClick={() => activeItemIndex >= 0 && removeItem(activeItemIndex)}
                disabled={activeItemIndex < 0}
                style={{ ...input, width: "auto", cursor: activeItemIndex >= 0 ? "pointer" : "not-allowed", opacity: activeItemIndex >= 0 ? 1 : 0.6 }}
              >
                Remove Selected
              </button>
            </div>

            {cfg.items.length ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
                  {cfg.items.map((item, index) => {
                    const selected = index === activeItemIndex;
                    return (
                      <button
                        key={item.id || index}
                        type="button"
                        onClick={() => setSelectedItemIndex(index)}
                        style={{
                          border: selected ? "1px solid #ff6b6b" : "1px solid #5f0000",
                          borderRadius: 12,
                          padding: 8,
                          background: selected ? "rgba(255,70,70,0.12)" : "rgba(120,0,0,0.05)",
                          color: "#ffd7d7",
                          textAlign: "left",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ height: 110, borderRadius: 8, border: "1px solid #3a0000", overflow: "hidden", background: "linear-gradient(180deg, #1b1b1b, #090909)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={`${item.name || "Store item"} card`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ff8e8e" }}>No Image</div>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, color: "#fff0f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.name || "Untitled Item"}
                        </div>
                        <div style={{ marginTop: 4, color: "#ffb3b3", fontSize: 12 }}>
                          {formatPrice(item)} | {item.type}
                        </div>
                        <div style={{ marginTop: 4, color: item.enabled ? "#9cffb0" : "#ff9d9d", fontSize: 12 }}>
                          {item.enabled ? "Live" : "Disabled"}{item.oneTime ? " | one-time" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {activeItem ? (
                  <div style={{ border: "1px solid #5f0000", borderRadius: 12, padding: 12, background: "rgba(120,0,0,0.05)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                      <div>
                        <div style={{ border: "1px solid #5f0000", borderRadius: 12, overflow: "hidden", background: "#090909" }}>
                          <div style={{ height: 180, background: "linear-gradient(180deg, #171717, #090909)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {activeItem.imageUrl ? (
                              <img src={activeItem.imageUrl} alt={`${activeItem.name || "Store item"} preview`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ff8e8e" }}>No Item Art</div>
                            )}
                          </div>
                          <div style={{ padding: 10 }}>
                            <div style={{ fontWeight: 900, color: "#fff2f2" }}>{activeItem.name || "Untitled Item"}</div>
                            <div style={{ color: "#ffb3b3", fontSize: 12, marginTop: 4 }}>{formatPrice(activeItem)}</div>
                            <div style={{ color: "#ff9f9f", fontSize: 12, marginTop: 6 }}>{activeItem.description || "Add a short description for this item."}</div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                          <div>
                            <label>Item ID</label>
                            <input
                              style={input}
                              placeholder="vip-pass"
                              value={activeItem.id}
                              onChange={(e) => updateItem(activeItemIndex, { id: e.target.value })}
                            />
                          </div>
                          <div>
                            <label>Type</label>
                            <select
                              style={input}
                              value={activeItem.type}
                              onChange={(e) => updateItem(activeItemIndex, { type: e.target.value as StoreItem["type"] })}
                            >
                              <option value="item">Item</option>
                              <option value="role">Role</option>
                              <option value="perk">Perk</option>
                            </select>
                          </div>
                          <div>
                            <label>Stock (-1 infinite)</label>
                            <input
                              style={input}
                              type="number"
                              value={activeItem.stock}
                              onChange={(e) => updateItem(activeItemIndex, { stock: Number(e.target.value || -1) })}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 8 }}>
                          <div>
                            <label>Display name</label>
                            <input
                              style={input}
                              placeholder="VIP Pass"
                              value={activeItem.name}
                              onChange={(e) => updateItem(activeItemIndex, { name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label>Price amount</label>
                            <input
                              style={input}
                              type="number"
                              value={activeItem.priceCoins}
                              onChange={(e) => updateItem(activeItemIndex, { priceCoins: Number(e.target.value || 0) })}
                            />
                          </div>
                          <div>
                            <label>Price currency</label>
                            <select
                              style={input}
                              value={activeItem.priceCurrencyType}
                              onChange={(e) => updateItem(activeItemIndex, { priceCurrencyType: e.target.value as StoreItem["priceCurrencyType"] })}
                            >
                              <option value="coins">Server coins</option>
                              <option value="eventPoints">{eventCurrencyLabel}</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <label>Description</label>
                          <textarea
                            style={{ ...input, minHeight: 84 }}
                            placeholder="Describe the role, perk, or item benefit."
                            value={activeItem.description}
                            onChange={(e) => updateItem(activeItemIndex, { description: e.target.value })}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginTop: 8 }}>
                          <div>
                            <label>Role grant</label>
                            <select
                              style={input}
                              value={activeItem.roleId}
                              onChange={(e) => updateItem(activeItemIndex, { roleId: e.target.value })}
                              disabled={activeItem.type !== "role"}
                            >
                              <option value="">{activeItem.type === "role" ? "Select role" : "Role not needed"}</option>
                              {(roles as Role[]).map((role) => (
                                <option key={role.id} value={role.id}>
                                  @{role.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Image source</label>
                            <div style={{ ...input, display: "flex", alignItems: "center", minHeight: 42 }}>
                              {cfg.panel.imageLibrary.some((img) => img.url === activeItem.imageUrl) ? "Using saved library image" : activeItem.imageUrl ? "Using custom URL" : "No image selected"}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <label>Item image URL</label>
                          <input
                            style={input}
                            placeholder="https://cdn.example.com/store/vip-pass.png"
                            value={activeItem.imageUrl}
                            onChange={(e) => updateItem(activeItemIndex, { imageUrl: e.target.value })}
                          />
                        </div>

                        {cfg.panel.imageLibrary.length ? (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ color: "#ffb3b3", marginBottom: 6, fontSize: 12 }}>Choose from saved images</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
                              {cfg.panel.imageLibrary.map((img) => {
                                const selected = activeItem.imageUrl === img.url;
                                return (
                                  <button
                                    key={`${activeItem.id}-tile-${img.url}`}
                                    type="button"
                                    onClick={() => updateItem(activeItemIndex, { imageUrl: selected ? "" : img.url })}
                                    style={{
                                      border: selected ? "1px solid #ff6b6b" : "1px solid #5f0000",
                                      borderRadius: 10,
                                      padding: 6,
                                      background: selected ? "rgba(255,70,70,0.14)" : "rgba(120,0,0,0.05)",
                                      color: "#ffd7d7",
                                      textAlign: "left",
                                      cursor: "pointer"
                                    }}
                                  >
                                    <div style={{ height: 72, borderRadius: 8, overflow: "hidden", border: "1px solid #3a0000", background: "#0a0a0a" }}>
                                      <img src={img.url} alt={img.label || "Saved store item art"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#fff0f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {img.label || "Saved image"}
                                    </div>
                                    <div style={{ marginTop: 2, fontSize: 11, color: selected ? "#ffc9c9" : "#ff9f9f" }}>
                                      {selected ? "Selected" : "Use image"}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
                          <label>
                            <input
                              type="checkbox"
                              checked={activeItem.oneTime}
                              onChange={(e) => updateItem(activeItemIndex, { oneTime: e.target.checked })}
                            />{" "}
                            One-time purchase
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={activeItem.enabled}
                              onChange={(e) => updateItem(activeItemIndex, { enabled: e.target.checked })}
                            />{" "}
                            Enabled
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ border: "1px dashed #5f0000", borderRadius: 12, padding: 18, color: "#ffb3b3" }}>
                No items yet. Add your first item to start building the catalog cards.
              </div>
            )}
          </div>

          <ConfigJsonEditor
            title="Advanced Store Config"
            value={cfg}
            disabled={saving}
            onApply={async (next) => {
              const normalized = mergeConfig(next as StoreConfig);
              setCfg(normalized);
              await saveStore(normalized);
            }}
          />

          <button onClick={() => void saveStore()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 700 }}>
            {saving ? "Saving..." : "Save Store"}
          </button>
        </>
      )}
    </div>
  );
}
