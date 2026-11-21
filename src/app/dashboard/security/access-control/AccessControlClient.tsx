"use client";

import { useEffect, useMemo, useState } from "react";
import DiscordMemberPicker from "@/components/possum/DiscordMemberPicker";

type Role = { id: string; name: string; position?: number };

type AccessControlConfig = {
  active: boolean;
  ownerBypass: boolean;
  adminRoleIds: string[];
  staffRoleIds: string[];
  allowedUserIds: string[];
  deniedUserIds: string[];
  memberGamingPortalEnabled: boolean;
  memberGamingPortalRoleIds: string[];
  memberGamingPortalUserIds: string[];
  memberGamingPortalRoutes: string[];
  notes: string;
};

type SessionUser = {
  id?: string;
  username?: string;
  globalName?: string;
};

type SessionPayload = {
  user?: SessionUser | null;
  isMasterOwner?: boolean;
  loggedIn?: boolean;
};

type AccessSnapshot = {
  access: boolean;
  reason: string;
};

const DEFAULT_CFG: AccessControlConfig = {
  active: true,
  ownerBypass: true,
  adminRoleIds: [],
  staffRoleIds: [],
  allowedUserIds: [],
  deniedUserIds: [],
  memberGamingPortalEnabled: false,
  memberGamingPortalRoleIds: [],
  memberGamingPortalUserIds: [],
  memberGamingPortalRoutes: ["/dashboard/games"],
  notes: "",
};

function getGuildId() {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("guildId") || "";
  const fromStore = localStorage.getItem("activeGuildId") || "";
  const id = (fromUrl || fromStore).trim();
  if (id) localStorage.setItem("activeGuildId", id);
  return id;
}

function csvToIds(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function idsToCsv(ids: string[]) {
  return (ids || []).join(", ");
}

function accessReasonLabel(reason: string) {
  switch (reason) {
    case "ok_global_owner":
      return "Global owner override";
    case "explicit_user_allowed":
      return "Explicit allowlist match";
    case "explicit_user_denied":
      return "Explicit denylist match";
    case "ok_dashboard_policy_role":
      return "Dashboard policy role match";
    case "ok_native_admin":
      return "Guild owner / native admin";
    case "ok_dashboard_access_role":
      return "Configured dashboard access role";
    case "ok_role_level":
      return "Minimum role level match";
    case "ok_member_gaming_portal_user":
      return "Member gaming portal user allowlist";
    case "ok_member_gaming_portal_role":
      return "Member gaming portal role policy";
    case "member_gaming_portal_disabled":
      return "Member gaming portal disabled";
    case "route_not_allowed":
      return "Route not allowed";
    case "dashboard_policy_inactive":
      return "Dashboard policy inactive";
    case "member_not_found":
      return "Member not found in guild";
    default:
      return reason || "Unknown";
  }
}

function RolePicker({ label, roles, selected, onChange }: { label: string; roles: Role[]; selected: string[]; onChange: (value: string[]) => void }) {
  const roleIds = new Set(roles.map((role) => role.id));
  const unavailable = selected.filter((id) => !roleIds.has(id));
  return (
    <div>
      <div style={{ marginBottom: 6, color: "#ffb3b3", fontSize: 12 }}>{label}</div>
      <div style={{ display: "grid", gap: 5, maxHeight: 180, overflowY: "auto", padding: 8, border: "1px solid rgba(255,0,0,.28)", borderRadius: 8 }}>
        {unavailable.map((id) => <label key={id}><input type="checkbox" checked onChange={() => onChange(selected.filter((value) => value !== id))} /> Unavailable role</label>)}
        {roles.map((role) => <label key={role.id}><input type="checkbox" checked={selected.includes(role.id)} onChange={() => onChange(selected.includes(role.id) ? selected.filter((id) => id !== role.id) : [...selected, role.id])} /> @{role.name}</label>)}
      </div>
    </div>
  );
}

function roleNameMap(roles: Role[]) {
  return new Map(roles.map((role) => [role.id, role.name]));
}

const card: React.CSSProperties = {
  border: "1px solid rgba(255,0,0,.36)",
  borderRadius: 12,
  padding: 14,
  background: "rgba(100,0,0,.10)",
  marginBottom: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0a",
  border: "1px solid rgba(255,0,0,.45)",
  color: "#ffd5d5",
  borderRadius: 8,
  padding: "10px 12px",
};

const pill: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

export default function AccessControlClient() {
  const [guildId, setGuildId] = useState("");
  const [cfg, setCfg] = useState<AccessControlConfig>(DEFAULT_CFG);
  const [roles, setRoles] = useState<Role[]>([]);
  const [session, setSession] = useState<SessionPayload>({});
  const [access, setAccess] = useState<AccessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => setGuildId(getGuildId()), []);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setMsg("");
        const [cfgRes, guildRes, sessionRes] = await Promise.all([
          fetch(`/api/bot/dashboard-access-config?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
          fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
          fetch("/api/auth/session?brief=1", { cache: "no-store" }),
        ]);

        const cfgJson = (await cfgRes.json().catch(() => ({}))) as { config?: Partial<AccessControlConfig> };
        const guildJson = (await guildRes.json().catch(() => ({}))) as {
          roles?: Array<{ id?: string; name?: string; position?: number }>;
        };
        const sessionJson = (await sessionRes.json().catch(() => ({}))) as SessionPayload;

        if (cancelled) return;

        setCfg({ ...DEFAULT_CFG, ...(cfgJson?.config || {}) });
        setRoles(
          (Array.isArray(guildJson?.roles) ? guildJson.roles : [])
            .map((role) => ({
              id: String(role.id || ""),
              name: String(role.name || "Unknown Role"),
              position: Number(role.position || 0),
            }))
            .filter((role) => role.id)
            .sort((a, b) => Number(b.position || 0) - Number(a.position || 0))
        );
        setSession(sessionJson || {});

        const sessionUserId = String(sessionJson?.user?.id || "").trim();
        if (sessionUserId) {
          const accessRes = await fetch(
            `/api/bot/guild-access?guildId=${encodeURIComponent(guildId)}&userId=${encodeURIComponent(sessionUserId)}`,
            { cache: "no-store" }
          );
          const accessJson = (await accessRes.json().catch(() => ({}))) as { access?: boolean; reason?: string };
          if (!cancelled) {
            setAccess({
              access: Boolean(accessJson?.access),
              reason: String(accessJson?.reason || ""),
            });
          }
        } else {
          setAccess(null);
        }
      } catch (error) {
        if (!cancelled) {
          setMsg(error instanceof Error ? error.message : "Failed to load access policy.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  async function save() {
    if (!guildId) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/bot/dashboard-access-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, patch: cfg }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; config?: Partial<AccessControlConfig> };
      if (!res.ok || json?.success === false) throw new Error(json?.error || "Save failed");
      setCfg({ ...DEFAULT_CFG, ...(json?.config || cfg) });
      setMsg("Saved bot masters policy.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const roleLookup = useMemo(() => roleNameMap(roles), [roles]);
  const viewerName = session?.user?.globalName || session?.user?.username || "Unknown user";
  const counts = [
    { label: "Bot Master Roles", value: cfg.adminRoleIds.length },
    { label: "Staff Roles", value: cfg.staffRoleIds.length },
    { label: "Allowed Users", value: cfg.allowedUserIds.length },
    { label: "Denied Users", value: cfg.deniedUserIds.length },
    { label: "Gaming Roles", value: cfg.memberGamingPortalRoleIds.length },
    { label: "Gaming Users", value: cfg.memberGamingPortalUserIds.length },
  ];

  if (!guildId) return <div style={{ color: "#ff8585", padding: 20 }}>Missing guildId. Open from /guilds first.</div>;

  return (
    <div style={{ maxWidth: 1220, color: "#ffd0d0" }}>
      <div style={card}>
        <h1 style={{ marginTop: 0, color: "#ff4a4a", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Bot Masters
        </h1>
        <div style={{ color: "#ff9f9f", marginBottom: 8 }}>
          Guild: {typeof window !== "undefined" ? localStorage.getItem("activeGuildName") || "Selected server" : "Selected server"}
        </div>
        <div style={{ color: "#ffb5b5", fontSize: 12, lineHeight: 1.6 }}>
          This is the live dashboard access policy. It writes directly to the bot access policy path used during guild dashboard authorization.
        </div>
        <div style={{ color: "#ffb3f0", fontSize: 12, marginTop: 8 }}>
          Control owner override is configured on the server.
        </div>
      </div>

      {loading ? <div style={{ padding: 10 }}>Loading...</div> : null}

      {!loading ? (
        <>
          <section style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <div>
              <div style={{ color: "#ffb3b3", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Viewer Access</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    ...pill,
                    border: `1px solid ${access?.access ? "#1f8a3f" : "#8a2f2f"}`,
                    background: access?.access ? "rgba(0,80,20,.24)" : "rgba(120,0,0,.18)",
                    color: access?.access ? "#98ffc0" : "#ffaaaa",
                  }}
                >
                  {access?.access ? "Allowed" : "Denied"}
                </span>
                {session?.isMasterOwner ? (
                  <span style={{ ...pill, border: "1px solid #ff2bd6", background: "rgba(255,43,214,0.18)", color: "#ffb3f0" }}>
                    Master Owner
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 8, color: "#ffdcdc", fontWeight: 700 }}>{viewerName}</div>
              <div style={{ color: "#ffbcbc", fontSize: 12, marginTop: 4 }}>{accessReasonLabel(access?.reason || "")}</div>
            </div>
            <div>
              <div style={{ color: "#ffb3b3", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Policy State</div>
              <div style={{ marginTop: 8, color: "#ffdcdc", fontWeight: 700 }}>{cfg.active ? "Active" : "Disabled"}</div>
              <div style={{ color: "#ffbcbc", fontSize: 12, marginTop: 4 }}>
                Guild owner bypass: {cfg.ownerBypass ? "Enabled" : "Disabled"}
              </div>
            </div>
            {counts.map((count) => (
              <div key={count.label}>
                <div style={{ color: "#ffb3b3", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>{count.label}</div>
                <div style={{ marginTop: 8, color: "#ffdcdc", fontWeight: 700, fontSize: 22 }}>{count.value}</div>
              </div>
            ))}
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Policy State
            </h3>
            <label style={{ marginRight: 16 }}>
              <input
                type="checkbox"
                checked={Boolean(cfg.active)}
                onChange={(event) => setCfg((prev) => ({ ...prev, active: event.target.checked }))}
              />{" "}
              Policy active
            </label>
            <label>
              <input
                type="checkbox"
                checked={Boolean(cfg.ownerBypass)}
                onChange={(event) => setCfg((prev) => ({ ...prev, ownerBypass: event.target.checked }))}
              />{" "}
              Guild owner bypass
            </label>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Role Access
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <RolePicker label="Bot master roles" roles={roles} selected={cfg.adminRoleIds} onChange={(value) => setCfg((prev) => ({ ...prev, adminRoleIds: value }))} />
              <RolePicker label="Staff dashboard roles" roles={roles} selected={cfg.staffRoleIds} onChange={(value) => setCfg((prev) => ({ ...prev, staffRoleIds: value }))} />
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Member Gaming Portal
            </h3>
            <div style={{ color: "#ffbcbc", fontSize: 12, marginBottom: 10 }}>
              Gaming Hub (`/dashboard/games`), its personal Social Alerts, and Search Anything (`/dashboard/search-anything`) are already available to every current server member. This setting controls any additional custom member-portal routes only; it does not grant server administration access.
            </div>
            <label style={{ marginRight: 16 }}>
              <input
                type="checkbox"
                checked={Boolean(cfg.memberGamingPortalEnabled)}
                onChange={(event) => setCfg((prev) => ({ ...prev, memberGamingPortalEnabled: event.target.checked }))}
              />{" "}
              Enable member gaming portal
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <RolePicker label="Member portal roles" roles={roles} selected={cfg.memberGamingPortalRoleIds} onChange={(value) => setCfg((prev) => ({ ...prev, memberGamingPortalRoleIds: value }))} />
              <DiscordMemberPicker guildId={guildId} label="Member portal members" multiple value={cfg.memberGamingPortalUserIds} onChange={(value) => setCfg((prev) => ({ ...prev, memberGamingPortalUserIds: Array.isArray(value) ? value : [] }))} />
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", marginBottom: 6 }}>Allowed member routes (csv)</label>
              <input
                style={input}
                value={idsToCsv(cfg.memberGamingPortalRoutes)}
                onChange={(event) => setCfg((prev) => ({ ...prev, memberGamingPortalRoutes: csvToIds(event.target.value) }))}
                placeholder="/dashboard/games"
              />
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Policy Coverage
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: "#ffb3b3", marginBottom: 8 }}>Configured bot master roles</div>
                <div style={{ color: "#ffbcbc", lineHeight: 1.7 }}>
                  {cfg.adminRoleIds.length
                    ? cfg.adminRoleIds.map((roleId) => roleLookup.get(roleId) || "Unavailable role").join(", ")
                    : "No admin roles configured."}
                </div>
              </div>
              <div>
                <div style={{ color: "#ffb3b3", marginBottom: 8 }}>Configured staff roles</div>
                <div style={{ color: "#ffbcbc", lineHeight: 1.7 }}>
                  {cfg.staffRoleIds.length
                    ? cfg.staffRoleIds.map((roleId) => roleLookup.get(roleId) || "Unavailable role").join(", ")
                    : "No staff roles configured."}
                </div>
              </div>
              <div>
                <div style={{ color: "#ffb3b3", marginBottom: 8 }}>Member gaming routes</div>
                <div style={{ color: "#ffbcbc", lineHeight: 1.7 }}>
                  {cfg.memberGamingPortalRoutes.length
                    ? cfg.memberGamingPortalRoutes.join(", ")
                    : "No member routes configured."}
                </div>
              </div>
              <div>
                <div style={{ color: "#ffb3b3", marginBottom: 8 }}>Member gaming access</div>
                <div style={{ color: "#ffbcbc", lineHeight: 1.7 }}>
                  {cfg.memberGamingPortalEnabled
                    ? `Enabled | ${cfg.memberGamingPortalRoleIds.length} role(s), ${cfg.memberGamingPortalUserIds.length} user(s)`
                    : "Disabled"}
                </div>
              </div>
            </div>
          </section>

          <section style={card}>
            <h3 style={{ marginTop: 0, color: "#ff6666", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              User Lists
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <DiscordMemberPicker guildId={guildId} label="Allowed members" multiple value={cfg.allowedUserIds} onChange={(value) => setCfg((prev) => ({ ...prev, allowedUserIds: Array.isArray(value) ? value : [] }))} />
              </div>
              <div>
                <DiscordMemberPicker guildId={guildId} label="Denied members" multiple value={cfg.deniedUserIds} onChange={(value) => setCfg((prev) => ({ ...prev, deniedUserIds: Array.isArray(value) ? value : [] }))} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ display: "block", marginBottom: 6 }}>Notes</label>
              <textarea
                style={{ ...input, minHeight: 80 }}
                value={cfg.notes || ""}
                onChange={(event) => setCfg((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </section>

          <section style={{ ...card, position: "sticky", bottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ color: "#ffb3b3", fontSize: 12 }}>Save to apply the live role-based dashboard access policy.</div>
              <button
                onClick={() => void save()}
                disabled={saving}
                style={{ ...input, width: "auto", cursor: "pointer", fontWeight: 900 }}
              >
                {saving ? "Saving..." : "Save Bot Masters"}
              </button>
            </div>
            {msg ? <div style={{ marginTop: 8, color: "#ffb3f0", fontSize: 12 }}>{msg}</div> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
