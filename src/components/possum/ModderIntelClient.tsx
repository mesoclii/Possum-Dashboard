"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import EngineInsights from "@/components/possum/EngineInsights";
import { useGuildEngineEditor } from "@/components/possum/useGuildEngineEditor";

type ModderIntelConfig = {
  enabled: boolean;
  auditChannelId: string;
  rulesChannelId: string;
  staffRoleIds: string[];
  autoRemoveOnStaff: boolean;
  autoTrackLinkedServers: boolean;
  linkedSourceServers: {
    guildId: string;
    label: string;
    sourceKey: string;
    sourceCustomLabel: string;
    menuUser: boolean;
    notes: string;
    enabled: boolean;
  }[];
  notes: string;
};

type RuntimeRow = {
  id?: string;
  userId?: string;
  title?: string;
  name?: string;
  value?: string;
  displayName?: string;
  menuUser?: boolean;
  sourceKey?: string;
  sourceLabel?: string;
  sourceCustomLabel?: string;
  riskLevel?: string;
  restrictionSurfaces?: string[];
  sourceTags?: string[];
  menuDiscords?: string[];
  linkedServerIds?: string[];
  notes?: string;
};

const DEFAULT_CFG: ModderIntelConfig = {
  enabled: true,
  auditChannelId: "",
  rulesChannelId: "",
  staffRoleIds: [],
  autoRemoveOnStaff: true,
  autoTrackLinkedServers: true,
  linkedSourceServers: [],
  notes: "",
};

const SOURCE_OPTIONS = [
  { key: "cherax_standard", label: "Cherax Standard" },
  { key: "cherax_premium", label: "Cherax Premium" },
  { key: "cherax_prime", label: "Cherax Prime" },
  { key: "riptide", label: "Riptide" },
  { key: "infamous", label: "Infamous" },
  { key: "xforce", label: "X-Force" },
  { key: "xforce_ace_be", label: "X-Force Ace BE Enabled" },
  { key: "scooby", label: "Scooby" },
  { key: "atlas", label: "Atlas" },
  { key: "midnight", label: "Midnight" },
  { key: "ethereal_ovix", label: "Ethereal Ovix" },
  { key: "raiden", label: "Raiden" },
  { key: "oxcheats", label: "OxCheats" },
  { key: "stand", label: "Stand" },
  { key: "yim", label: "Yim" },
  { key: "nenyoo", label: "Nenyoo" },
  { key: "lexis", label: "Lexis" },
  { key: "other", label: "Other" },
];

const SURFACES = [
  { key: "vip", label: "VIP" },
  { key: "heists", label: "Heists" },
  { key: "casinopings", label: "Casino Pings" },
  { key: "giveaways", label: "Giveaways" },
  { key: "crew", label: "Crew" },
  { key: "services", label: "Service Access" },
];

const shell: CSSProperties = { color: "#ffd0d0", padding: 18, maxWidth: 1380 };
const card: CSSProperties = {
  border: "1px solid #5f0000",
  borderRadius: 14,
  padding: 16,
  background: "linear-gradient(180deg, rgba(120,0,0,0.12), rgba(0,0,0,0.72))",
  marginBottom: 14,
};
const input: CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  color: "#ffd0d0",
  border: "1px solid #7f0000",
  borderRadius: 10,
  padding: "10px 12px",
};
const label: CSSProperties = {
  color: "#ffb9b9",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

function toggle(list: string[], id: string) {
  const next = new Set(list || []);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return Array.from(next);
}

export default function ModderIntelClient() {
  const {
    guildId,
    guildName,
    config,
    setConfig,
    channels,
    roles,
    summary,
    details,
    loading,
    saving,
    message,
    save,
    runAction,
    reload,
  } = useGuildEngineEditor<ModderIntelConfig>("modderIntel", DEFAULT_CFG);

  const cfg = useMemo(() => ({ ...DEFAULT_CFG, ...(config || {}) }), [config]);
  const textChannels = useMemo(
    () => channels.filter((c) => Number(c?.type) === 0 || String(c?.type || "").toLowerCase().includes("text")),
    [channels]
  );
  const trackedEntries = useMemo(() => (Array.isArray((details as any)?.entries) ? ((details as any).entries as RuntimeRow[]) : []), [details]);
  const linkedServers = useMemo(() => (Array.isArray((details as any)?.linkedServers) ? ((details as any).linkedServers as RuntimeRow[]) : []), [details]);
  const activity = useMemo(() => (Array.isArray((details as any)?.activity) ? ((details as any).activity as RuntimeRow[]) : []), [details]);

  const [form, setForm] = useState({
    memberLookup: "",
    menuUser: true,
    sourceKey: "cherax_standard",
    sourceCustomLabel: "",
    riskLevel: "",
    notes: "",
    sourceTags: "",
    menuDiscords: "",
    linkedServerIds: "",
    restrictionSurfaces: [] as string[],
    preserveRestrictions: true,
  });
  const [removeLookup, setRemoveLookup] = useState("");

  async function addEntry() {
    const memberLookup = String(form.memberLookup || "").trim();
    if (!memberLookup) return;
    const parsedUserId = memberLookup.match(/\d{16,20}/)?.[0] || "";
    const payload: Record<string, unknown> = {
      memberLookup,
      menuUser: form.menuUser,
      sourceKey: form.sourceKey,
      sourceCustomLabel: form.sourceCustomLabel,
      notes: form.notes,
      preserveRestrictions: form.preserveRestrictions,
    };
    if (parsedUserId) payload.userId = parsedUserId;
    if (form.riskLevel) payload.riskLevel = form.riskLevel;
    if (form.sourceTags.trim()) payload.sourceTags = form.sourceTags;
    if (form.menuDiscords.trim()) payload.menuDiscords = form.menuDiscords;
    if (form.linkedServerIds.trim()) payload.linkedServerIds = form.linkedServerIds;
    if (!form.preserveRestrictions || form.restrictionSurfaces.length > 0) {
      payload.restrictionSurfaces = form.restrictionSurfaces;
    }

    const result = await runAction("upsertEntry", payload);
    if (result) {
      setForm({
        memberLookup: "",
        menuUser: true,
        sourceKey: "cherax_standard",
        sourceCustomLabel: "",
        riskLevel: "",
        notes: "",
        sourceTags: "",
        menuDiscords: "",
        linkedServerIds: "",
        restrictionSurfaces: [],
        preserveRestrictions: true,
      });
      void reload();
    }
  }

  async function removeEntry() {
    const memberLookup = String(removeLookup || "").trim();
    if (!memberLookup) return;
    const userId = memberLookup.match(/\d{16,20}/)?.[0] || "";
    const result = await runAction("removeEntry", userId ? { userId } : { memberLookup });
    if (result) {
      setRemoveLookup("");
      void reload();
    }
  }

  function updateLinkedServer(index: number, patch: Partial<ModderIntelConfig["linkedSourceServers"][number]>) {
    setConfig((prev) => {
      const nextCfg = { ...(prev || cfg) };
      const rows = Array.isArray(nextCfg.linkedSourceServers) ? [...nextCfg.linkedSourceServers] : [];
      rows[index] = { ...(rows[index] || { guildId: "", label: "", sourceKey: "cherax_standard", sourceCustomLabel: "", menuUser: true, notes: "", enabled: true }), ...patch };
      nextCfg.linkedSourceServers = rows;
      return nextCfg;
    });
  }

  function addLinkedServer() {
    setConfig((prev) => ({
      ...(prev || cfg),
      linkedSourceServers: [
        ...((prev || cfg).linkedSourceServers || []),
        { guildId: "", label: "", sourceKey: "cherax_standard", sourceCustomLabel: "", menuUser: true, notes: "", enabled: true },
      ],
    }));
  }

  function removeLinkedServer(index: number) {
    setConfig((prev) => ({
      ...(prev || cfg),
      linkedSourceServers: (((prev || cfg).linkedSourceServers) || []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  if (!guildId) {
    return <div style={{ ...shell, color: "#ff8080" }}>Missing guildId. Open from /guilds first.</div>;
  }

  return (
    <div style={shell}>
      <h1 style={{ marginTop: 0, color: "#ff4d4d", textTransform: "uppercase", letterSpacing: "0.1em" }}>Modder Intel Studio</h1>
      <div style={{ color: "#ff9c9c", marginBottom: 12 }}>Guild: {guildName || guildId}</div>
      <div style={{ color: "#ffb6b6", marginBottom: 14, lineHeight: 1.6 }}>
        Track known menu holders, reseller/network risk, restriction surfaces, and staff-safe cleanup. This is the additive operator surface for modding-community intel without forcing it into the blacklist.
      </div>
      {message ? <div style={{ marginBottom: 10, color: "#ffb3f0" }}>{message}</div> : null}

      {loading ? <div style={card}>Loading modder intel...</div> : null}

      {!loading ? (
        <>
          <EngineInsights summary={summary} details={details} />

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.enabled} onChange={(e) => setConfig((prev) => ({ ...(prev || cfg), enabled: e.target.checked }))} /> Modder intel enabled
              </label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.autoRemoveOnStaff} onChange={(e) => setConfig((prev) => ({ ...(prev || cfg), autoRemoveOnStaff: e.target.checked }))} /> Auto-remove intel if member becomes staff
              </label>
              <label style={{ color: "#ffdcdc", fontWeight: 700 }}>
                <input type="checkbox" checked={cfg.autoTrackLinkedServers} onChange={(e) => setConfig((prev) => ({ ...(prev || cfg), autoTrackLinkedServers: e.target.checked }))} /> Auto-track matches from linked Discord servers
              </label>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Audit Channel</div>
                <select style={input} value={cfg.auditChannelId} onChange={(e) => setConfig((prev) => ({ ...(prev || cfg), auditChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Rules Channel</div>
                <select style={input} value={cfg.rulesChannelId} onChange={(e) => setConfig((prev) => ({ ...(prev || cfg), rulesChannelId: e.target.value }))}>
                  <option value="">Select channel</option>
                  {textChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>#{channel.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Staff Roles</div>
                <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #500000", borderRadius: 10, padding: 10, background: "#0a0a0a" }}>
                  {roles.map((role) => (
                    <label key={role.id} style={{ display: "block", color: "#ffdcdc", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={cfg.staffRoleIds.includes(role.id)}
                        onChange={() => setConfig((prev) => ({ ...(prev || cfg), staffRoleIds: toggle((prev || cfg).staffRoleIds || [], role.id) }))}
                      />{" "}
                      @{role.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Linked Menu / Reseller Discord Servers
            </div>
            <div style={{ color: "#ffb7b7", marginBottom: 12, lineHeight: 1.6 }}>
              Add Discord server IDs the bot is also in. If a member joins one of those linked servers and this guild, the modder database can auto-add them using the selected source preset.
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {(cfg.linkedSourceServers || []).map((entry, index) => (
                <div key={`${entry.guildId || "new"}_${index}`} style={{ border: "1px solid #3b0000", borderRadius: 12, padding: 12, background: "#0a0a0a" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                    <div>
                      <div style={label}>Linked Server ID</div>
                      <input style={input} value={entry.guildId} onChange={(e) => updateLinkedServer(index, { guildId: e.target.value })} placeholder="Discord guild ID" />
                    </div>
                    <div>
                      <div style={label}>Display Label</div>
                      <input style={input} value={entry.label} onChange={(e) => updateLinkedServer(index, { label: e.target.value })} placeholder="Cherax Discord, Midnight Server, etc." />
                    </div>
                    <div>
                      <div style={label}>Source Preset</div>
                      <select style={input} value={entry.sourceKey} onChange={(e) => updateLinkedServer(index, { sourceKey: e.target.value })}>
                        {SOURCE_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={label}>Menu User</div>
                      <select style={input} value={entry.menuUser ? "yes" : "no"} onChange={(e) => updateLinkedServer(index, { menuUser: e.target.value === "yes" })}>
                        <option value="yes">YES</option>
                        <option value="no">NO</option>
                      </select>
                    </div>
                    {entry.sourceKey === "other" ? (
                      <div>
                        <div style={label}>Custom Source Label</div>
                        <input style={input} value={entry.sourceCustomLabel || ""} onChange={(e) => updateLinkedServer(index, { sourceCustomLabel: e.target.value })} placeholder="Custom source name" />
                      </div>
                    ) : null}
                    <div>
                      <div style={label}>Notes</div>
                      <input style={input} value={entry.notes || ""} onChange={(e) => updateLinkedServer(index, { notes: e.target.value })} placeholder="Optional intake note" />
                    </div>
                    <label style={{ color: "#ffdcdc", fontWeight: 700, alignSelf: "end" }}>
                      <input type="checkbox" checked={entry.enabled !== false} onChange={(e) => updateLinkedServer(index, { enabled: e.target.checked })} /> Enabled
                    </label>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button onClick={() => removeLinkedServer(index)} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                      Remove Linked Server
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button onClick={() => addLinkedServer()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                Add Linked Server
              </button>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Track Menu Holder / Reseller Intel
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              <div>
                <div style={label}>Member Lookup</div>
                <input
                  style={input}
                  value={form.memberLookup}
                  onChange={(e) => setForm((prev) => ({ ...prev, memberLookup: e.target.value }))}
                  placeholder="User ID, mention, nickname, or username"
                />
              </div>
              <div>
                <div style={label}>Menu User</div>
                <select style={input} value={form.menuUser ? "yes" : "no"} onChange={(e) => setForm((prev) => ({ ...prev, menuUser: e.target.value === "yes" }))}>
                  <option value="yes">YES</option>
                  <option value="no">NO</option>
                </select>
              </div>
              <div>
                <div style={label}>Menu Source</div>
                <select style={input} value={form.sourceKey} onChange={(e) => setForm((prev) => ({ ...prev, sourceKey: e.target.value }))}>
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={label}>Risk Level</div>
                <select style={input} value={form.riskLevel} onChange={(e) => setForm((prev) => ({ ...prev, riskLevel: e.target.value }))}>
                  <option value="">Keep current / default</option>
                  <option value="low">LOW</option>
                  <option value="medium">MEDIUM</option>
                  <option value="high">HIGH</option>
                  <option value="extreme">EXTREME</option>
                </select>
              </div>
              {form.sourceKey === "other" ? (
                <div>
                  <div style={label}>Custom Source Label</div>
                  <input style={input} value={form.sourceCustomLabel} onChange={(e) => setForm((prev) => ({ ...prev, sourceCustomLabel: e.target.value }))} placeholder="Type the custom menu/community source" />
                </div>
              ) : null}
              <div>
                <div style={label}>Source Tags (CSV)</div>
                <input
                  style={input}
                  value={form.sourceTags}
                  onChange={(e) => setForm((prev) => ({ ...prev, sourceTags: e.target.value }))}
                  placeholder="cherax, premium, trusted"
                />
              </div>
              <div>
                <div style={label}>Communities (CSV)</div>
                <input
                  style={input}
                  value={form.menuDiscords}
                  onChange={(e) => setForm((prev) => ({ ...prev, menuDiscords: e.target.value }))}
                  placeholder="Cherax Discord, Midnight reseller"
                />
              </div>
              <div>
                <div style={label}>Linked Server IDs (CSV)</div>
                <input
                  style={input}
                  value={form.linkedServerIds}
                  onChange={(e) => setForm((prev) => ({ ...prev, linkedServerIds: e.target.value }))}
                  placeholder="123..., 456..."
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={label}>Restriction Surfaces</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", border: "1px solid #500000", borderRadius: 10, padding: 10, background: "#0a0a0a" }}>
                  {SURFACES.map((surface) => (
                    <label key={surface.key} style={{ color: "#ffdcdc" }}>
                      <input
                        type="checkbox"
                        checked={form.restrictionSurfaces.includes(surface.key)}
                        onChange={() => setForm((prev) => ({ ...prev, restrictionSurfaces: toggle(prev.restrictionSurfaces, surface.key) }))}
                      />{" "}
                      {surface.label}
                    </label>
                  ))}
                </div>
                <label style={{ color: "#ffdcdc", display: "inline-block", marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.preserveRestrictions}
                    onChange={(e) => setForm((prev) => ({ ...prev, preserveRestrictions: e.target.checked }))}
                  />{" "}
                  Keep existing restrictions when none are selected above
                </label>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={label}>Notes</div>
                <textarea style={{ ...input, minHeight: 100 }} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Menu notes, reseller concerns, DM selling, cook risk, no-second-chance reminders, etc." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button onClick={() => void addEntry()} disabled={saving || !String(form.memberLookup || "").trim()} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                {saving ? "Working..." : "Save Intel Record"}
              </button>
            </div>
          </section>

          <section style={card}>
            <div style={label}>Remove Intel Record</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
              <input style={input} value={removeLookup} onChange={(e) => setRemoveLookup(e.target.value)} placeholder="User ID, mention, nickname, or username" />
              <button onClick={() => void removeEntry()} disabled={saving || !String(removeLookup || "").trim()} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
                {saving ? "Working..." : "Remove"}
              </button>
            </div>
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Tracked Members
            </div>
            {trackedEntries.length ? trackedEntries.map((entry) => (
              <div key={String(entry.id || entry.title)} style={{ padding: "8px 0", borderTop: "1px solid #330000" }}>
                <div style={{ fontWeight: 800 }}>{entry.title || entry.name}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No tracked menu holders yet.</div>}
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Linked Server Intake
            </div>
            {linkedServers.length ? linkedServers.map((entry) => (
              <div key={String(entry.id || entry.title)} style={{ padding: "8px 0", borderTop: "1px solid #330000" }}>
                <div style={{ fontWeight: 800 }}>{entry.title || entry.name}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No linked source servers configured yet.</div>}
          </section>

          <section style={card}>
            <div style={{ color: "#ffb3b3", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Recent Intel Activity
            </div>
            {activity.length ? activity.map((entry) => (
              <div key={String(entry.id || entry.title)} style={{ padding: "8px 0", borderTop: "1px solid #330000" }}>
                <div style={{ fontWeight: 800 }}>{entry.title || entry.name}</div>
                <div style={{ color: "#ffb3b3", fontSize: 12 }}>{entry.value}</div>
              </div>
            )) : <div style={{ color: "#ffb3b3" }}>No activity logged yet.</div>}
          </section>

          <section style={card}>
            <div style={label}>Modder Intel Notes</div>
            <textarea
              style={{ ...input, minHeight: 120 }}
              value={cfg.notes || ""}
              onChange={(e) => setConfig((prev) => ({ ...(prev || cfg), notes: e.target.value }))}
              placeholder="Guild policy for menu holders, service-selling enforcement, reseller watch notes, and rules reference."
            />
          </section>

          <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "#ffb8b8", lineHeight: 1.6, maxWidth: 820 }}>
              This studio is separate from the blacklist: it is for modder/watch intel, surface restrictions, and staff-safe cleanup when members cross into trusted roles.
            </div>
            <button onClick={() => void save()} disabled={saving} style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}>
              {saving ? "Saving..." : "Save Modder Intel"}
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
