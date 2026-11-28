"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { GuildChannel, GuildRole } from "@/components/possum/useGuildEngineEditor";
import { buildDashboardHref } from "@/lib/dashboardContext";

export type BankAudience = "everyone" | "members" | "staff" | "trusted" | "watchlist";

export type CustomBank = {
  id: string;
  enabled: boolean;
  name: string;
  triggers: string[];
  responses: string[];
  audience: BankAudience;
  directOnly: boolean;
  channelIds: string[];
};

export type StaffLearning = {
  enabled: boolean;
  staffRoleIds: string[];
  maxLinesPerStaff: number;
  mirrorStaffVoice: boolean;
};

export type SecurityAwareness = {
  enabled: boolean;
  quietDuringAlert: boolean;
  watchThreatScore: number;
  watchDriftScore: number;
};

export const DEFAULT_STAFF_LEARNING: StaffLearning = { enabled: false, staffRoleIds: [], maxLinesPerStaff: 40, mirrorStaffVoice: true };
export const DEFAULT_SECURITY_AWARENESS: SecurityAwareness = { enabled: true, quietDuringAlert: true, watchThreatScore: 50, watchDriftScore: 60 };

const AUDIENCES: Array<{ value: BankAudience; label: string }> = [
  { value: "everyone", label: "Everyone" },
  { value: "members", label: "Members not on the watchlist" },
  { value: "staff", label: "Staff only" },
  { value: "trusted", label: "Trusted members + staff" },
  { value: "watchlist", label: "Watchlist only (flagged by security)" },
];

const STARTER_BANKS: Array<Omit<CustomBank, "id">> = [
  {
    enabled: true,
    name: "Welcome back",
    triggers: ["good morning", "i'm back", "im back", "hello everyone"],
    responses: ["Welcome back, {user}. {server} missed you.", "Look who showed up. Good to see you, {user}."],
    audience: "members",
    directOnly: false,
    channelIds: [],
  },
  {
    enabled: true,
    name: "Rules reminder",
    triggers: ["rules", "can i post", "is this allowed"],
    responses: ["Respect is earned, but basic respect is expected. Rules exist for a reason.", "Rules exist for a reason, {user}. Ignoring them doesn't make you special."],
    audience: "everyone",
    directOnly: true,
    channelIds: [],
  },
  {
    enabled: true,
    name: "Staff check-in",
    triggers: ["on shift", "clocking in", "mod check"],
    responses: ["Copy that, {user}. I'll keep an eye on the channels with you.", "Good to have you on, {user}. Quiet so far."],
    audience: "staff",
    directOnly: false,
    channelIds: [],
  },
  {
    enabled: true,
    name: "Flagged member",
    triggers: ["why", "unfair", "ban", "mute"],
    responses: ["Keep it civil and staff will sort it out.", "Take it to a ticket, {user}. Arguing here won't help."],
    audience: "watchlist",
    directOnly: false,
    channelIds: [],
  },
];

const card: CSSProperties = { border: "1px solid rgba(255,0,0,.36)", borderRadius: 12, padding: 14, background: "rgba(100,0,0,.10)", marginBottom: 12 };
const action: CSSProperties = {
  border: "1px solid #7a0000",
  borderRadius: 10,
  background: "#130707",
  color: "#ffd7d7",
  padding: "10px 12px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  textDecoration: "none",
};
const input: CSSProperties = { width: "100%", background: "#0a0a0a", border: "1px solid rgba(255,0,0,.45)", color: "#ffd5d5", borderRadius: 8, padding: "10px 12px" };
const heading: CSSProperties = { color: "#ff9c9c", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 };
const hint: CSSProperties = { color: "#ffbdbd", fontSize: 12, lineHeight: 1.6 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 };

async function runtimeRouterAction(guildId: string, actionName: string, payload?: Record<string, unknown>) {
  const res = await fetch("/api/runtime/engine-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, engine: "runtimeRouter", action: actionName, payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) throw new Error(json?.error || `Request failed (${res.status})`);
  return json?.result ?? json;
}

export function normalizeCustomBanks(value: unknown): CustomBank[] {
  if (!Array.isArray(value)) return [];
  return value.map((row: any, index) => ({
    id: String(row?.id || `bank-${index + 1}`),
    enabled: row?.enabled !== false,
    name: String(row?.name || ""),
    triggers: Array.isArray(row?.triggers) ? row.triggers.map(String) : String(row?.triggers || "").split(/[,\n]/),
    responses: Array.isArray(row?.responses) ? row.responses.map(String) : String(row?.responses || "").split("\n"),
    audience: AUDIENCES.some((option) => option.value === row?.audience) ? row.audience : "everyone",
    directOnly: row?.directOnly === true,
    channelIds: Array.isArray(row?.channelIds) ? row.channelIds.map(String) : [],
  }));
}

export function cleanCustomBanks(banks: CustomBank[]): CustomBank[] {
  return banks.map((bank) => ({
    ...bank,
    name: bank.name.trim(),
    triggers: bank.triggers.map((line) => line.trim().toLowerCase()).filter(Boolean),
    responses: bank.responses.map((line) => line.trim()).filter(Boolean),
  }));
}

export function PossumHowItWorks() {
  return (
    <section style={card}>
      <div style={heading}>How Possum AI answers</div>
      <div style={hint}>
        Possum AI runs on your server&apos;s own knowledge and never uses AI credits. Persona AI is the paid AI. For each message Possum checks, in order:
      </div>
      <ol style={{ ...hint, fontSize: 13, marginBottom: 0 }}>
        <li><strong>Your response banks.</strong> If a trigger word matches and the bank is for this kind of member, Possum answers with one of your lines, word for word.</li>
        <li><strong>Community Studio lookup cards.</strong> When someone talks to Possum directly and mentions a lookup key or alias, it answers with that card.</li>
        <li><strong>The adaptive voice.</strong> Otherwise it builds a reply from your backstory, the knowledge banks, the tone bank, what it has learned about the member and channel, and (if on) lines learned from your staff.</li>
        <li><strong>Voice sliders and security.</strong> The sliders shape that generated reply. Members flagged by your security engines get firm, short answers. During a risk escalation Possum only answers people who talk to it directly.</li>
      </ol>
    </section>
  );
}

export function ReplyTester({ guildId }: { guildId: string }) {
  const [text, setText] = useState("hey possum, what are the rules?");
  const [stance, setStance] = useState("");
  const [direct, setDirect] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ line: string; message: string } | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const next = await runtimeRouterAction(guildId, "previewReply", { text, stance: stance || undefined, direct });
      setResult({ line: String(next?.line || ""), message: String(next?.message || "") });
    } catch (err: any) {
      setError(err?.message || "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={heading}>Test a reply</div>
      <div style={hint}>Type something a member might say and see what Possum would answer. Nothing is posted. Save first so it uses your latest settings.</div>
      <div style={{ ...grid, marginTop: 10, alignItems: "end" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Message</label>
          <input style={input} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void run(); }} />
        </div>
        <div>
          <label>Treat me as</label>
          <select style={input} value={stance} onChange={(e) => setStance(e.target.value)}>
            <option value="">Myself (real security data)</option>
            <option value="member">A regular member</option>
            <option value="staff">Staff</option>
            <option value="trusted">A trusted member</option>
            <option value="watchlist">A member on the watchlist</option>
            <option value="alert">Anyone, during a risk escalation</option>
          </select>
        </div>
        <label><input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} /> Talking to Possum directly (@mention or &quot;possum&quot;)</label>
        <button type="button" style={action} disabled={busy || !text.trim()} onClick={() => void run()}>{busy ? "Thinking..." : "Preview reply"}</button>
      </div>
      {result ? (
        <div style={{ marginTop: 12, border: "1px solid #5f0000", borderRadius: 10, padding: 12, background: "#0a0000" }}>
          <div style={{ color: "#fff1f1", fontSize: 15 }}>{result.line}</div>
          <div style={{ ...hint, marginTop: 6 }}>{result.message.replace(/^Possum would say: ".*" \(/, "Came from ").replace(/\)\.$/, ".")}</div>
        </div>
      ) : null}
      {error ? <div style={{ color: "#ff8080", marginTop: 8 }}>{error}</div> : null}
    </section>
  );
}

export function CustomBanksEditor({ banks, channels, onChange }: { banks: CustomBank[]; channels: GuildChannel[]; onChange: (next: CustomBank[]) => void }) {
  const update = (index: number, patch: Partial<CustomBank>) => onChange(banks.map((bank, i) => (i === index ? { ...bank, ...patch } : bank)));
  const nextId = () => {
    let n = banks.length + 1;
    while (banks.some((bank) => bank.id === `bank-${n}`)) n += 1;
    return `bank-${n}`;
  };

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={heading}>Response banks ({banks.length}/40)</div>
          <div style={{ ...hint, maxWidth: 900 }}>
            Your own &quot;when someone says this, answer with that&quot; lists. Possum checks them first and uses your lines word for word.
            Use <code>{"{user}"}</code>, <code>{"{server}"}</code>, <code>{"{bot}"}</code> and <code>{"{channel}"}</code> in responses. Banks are checked top to bottom; a bank for a specific group (staff, trusted, watchlist) wins over an &quot;everyone&quot; bank.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={action}
            disabled={banks.length >= 40}
            onClick={() => onChange([...banks, { id: nextId(), enabled: true, name: "", triggers: [], responses: [], audience: "everyone", directOnly: false, channelIds: [] }])}
          >
            Add bank
          </button>
          {!banks.length ? (
            <button type="button" style={action} onClick={() => onChange(STARTER_BANKS.map((bank, i) => ({ ...bank, id: `starter-${i + 1}` })))}>
              Add examples
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {banks.map((bank, index) => (
          <div key={`${bank.id}-${index}`} style={{ border: "1px solid #4d0000", borderRadius: 12, padding: 12, background: "#0d0000" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <input style={{ ...input, flex: 1, minWidth: 200 }} placeholder="Bank name" maxLength={60} value={bank.name} onChange={(e) => update(index, { name: e.target.value })} />
              <label><input type="checkbox" checked={bank.enabled} onChange={(e) => update(index, { enabled: e.target.checked })} /> On</label>
              <button type="button" style={action} disabled={index === 0} onClick={() => { const next = [...banks]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>Up</button>
              <button type="button" style={action} onClick={() => onChange(banks.filter((_, i) => i !== index))}>Remove</button>
            </div>
            <div style={grid}>
              <div>
                <label>Trigger words or phrases (one per line)</label>
                <textarea style={{ ...input, minHeight: 110 }} value={bank.triggers.join("\n")} placeholder={"rules\nis this allowed"} onChange={(e) => update(index, { triggers: e.target.value.split("\n") })} />
                <div style={{ ...hint, fontSize: 11 }}>Whole words only: &quot;rule&quot; won&apos;t match &quot;rules&quot;.</div>
              </div>
              <div>
                <label>Responses (one per line, picked at random)</label>
                <textarea style={{ ...input, minHeight: 110 }} value={bank.responses.join("\n")} placeholder="Rules exist for a reason, {user}." onChange={(e) => update(index, { responses: e.target.value.split("\n") })} />
              </div>
              <div>
                <label>Who it answers</label>
                <select style={input} value={bank.audience} onChange={(e) => update(index, { audience: e.target.value as BankAudience })}>
                  {AUDIENCES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <label style={{ display: "block", marginTop: 10 }}>
                  <input type="checkbox" checked={bank.directOnly} onChange={(e) => update(index, { directOnly: e.target.checked })} /> Only when someone talks to Possum directly
                </label>
                <div style={{ ...hint, fontSize: 11 }}>Off: Possum answers the trigger anywhere it&apos;s said (still with a short channel cooldown).</div>
              </div>
              <div>
                <label>Only in these channels (empty = everywhere)</label>
                <select
                  multiple
                  style={{ ...input, minHeight: 110 }}
                  value={bank.channelIds}
                  onChange={(e) => update(index, { channelIds: Array.from(e.target.selectedOptions).map((option) => option.value) })}
                >
                  {channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const SECURITY_LINKS = [
  { href: "/dashboard/security/trust-weight", label: "Trust Weight", what: "Members it rates ELEVATED are treated as trusted: warmer replies and trusted-only banks." },
  { href: "/dashboard/security/threat-intel", label: "Threat Intel", what: "A threat score at or above your limit puts the member on Possum's watchlist." },
  { href: "/dashboard/security/behavioral-drift", label: "Behavioral Drift", what: "A drift score at or above your limit also puts them on the watchlist." },
  { href: "/dashboard/security/account-integrity", label: "Account Integrity", what: "Feeds Trust Weight, so suspicious alts don't become trusted." },
  { href: "/dashboard/security/risk-escalation", label: "Risk Escalation", what: "At level 2 or higher the whole server is on alert: Possum stays serious and stops ambient chatter." },
];

export function SecurityAwarenessPanel({ value, onChange }: { value: SecurityAwareness; onChange: (next: SecurityAwareness) => void }) {
  return (
    <section style={card}>
      <div style={heading}>Security link</div>
      <div style={{ ...hint, maxWidth: 900 }}>
        Possum reads what your security engines already know and changes how it talks. It never changes security data or punishes anyone. A low trust score on its own doesn&apos;t count, so new members aren&apos;t treated as suspects.
      </div>
      <div style={{ ...grid, marginTop: 10 }}>
        <label><input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} /> Use security signals</label>
        <label><input type="checkbox" checked={value.quietDuringAlert} disabled={!value.enabled} onChange={(e) => onChange({ ...value, quietDuringAlert: e.target.checked })} /> Stop ambient replies during a risk escalation</label>
        <div>
          <label>Watchlist at threat score</label>
          <input style={input} type="number" min={1} max={100} disabled={!value.enabled} value={value.watchThreatScore} onChange={(e) => onChange({ ...value, watchThreatScore: Math.max(1, Math.min(100, Number(e.target.value) || 50)) })} />
        </div>
        <div>
          <label>Watchlist at drift score</label>
          <input style={input} type="number" min={1} max={100} disabled={!value.enabled} value={value.watchDriftScore} onChange={(e) => onChange({ ...value, watchDriftScore: Math.max(1, Math.min(100, Number(e.target.value) || 60)) })} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
        {SECURITY_LINKS.map((link) => (
          <div key={link.href} style={{ ...hint, borderTop: "1px solid #330000", paddingTop: 6 }}>
            <Link href={buildDashboardHref(link.href)} style={{ color: "#ff8a8a", fontWeight: 800 }}>{link.label}</Link> - {link.what}
          </div>
        ))}
        <div style={{ ...hint, borderTop: "1px solid #330000", paddingTop: 6 }}>Staff setting a manual trust override below 40 on Trust Weight also puts the member on the watchlist.</div>
      </div>
    </section>
  );
}

type StaffSummary = { userId: string; name: string; messageCount: number; lineCount: number; topTopics: string[]; sampleLines: string[]; lastSeen: string };

export function StaffLearningPanel({ guildId, value, roles, onChange }: { guildId: string; value: StaffLearning; roles: GuildRole[]; onChange: (next: StaffLearning) => void }) {
  const [staff, setStaff] = useState<StaffSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function call(actionName: string, payload?: Record<string, unknown>) {
    setBusy(true);
    setNote("");
    try {
      const result = await runtimeRouterAction(guildId, actionName, payload);
      setStaff(Array.isArray(result?.staff) ? result.staff : []);
      setNote(String(result?.message || ""));
    } catch (err: any) {
      setNote(err?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={heading}>Learn from your staff</div>
      <div style={{ ...hint, maxWidth: 900 }}>
        When this is on, Possum keeps short lines your staff say (no links, mentions, commands or long numbers) and notes what topics they handle, so its replies start to sound like your team.
        Only staff messages are kept. Let your staff know it&apos;s on. You can forget anyone at any time.
      </div>
      <div style={{ ...grid, marginTop: 10 }}>
        <label><input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} /> Learn from staff messages</label>
        <label><input type="checkbox" checked={value.mirrorStaffVoice} disabled={!value.enabled} onChange={(e) => onChange({ ...value, mirrorStaffVoice: e.target.checked })} /> Use learned lines in replies</label>
        <div>
          <label>Lines kept per staff member</label>
          <input style={input} type="number" min={5} max={200} value={value.maxLinesPerStaff} onChange={(e) => onChange({ ...value, maxLinesPerStaff: Math.max(5, Math.min(200, Number(e.target.value) || 40)) })} />
        </div>
        <div>
          <label>Staff roles (empty = anyone who can manage messages or time out members)</label>
          <select
            multiple
            style={{ ...input, minHeight: 100 }}
            value={value.staffRoleIds}
            onChange={(e) => onChange({ ...value, staffRoleIds: Array.from(e.target.selectedOptions).map((option) => option.value) })}
          >
            {roles.filter((role) => role.name !== "@everyone").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" style={action} disabled={busy} onClick={() => void call("staffVoiceSummary")}>Show what it learned</button>
        <button
          type="button"
          style={action}
          disabled={busy}
          onClick={() => { if (window.confirm("Wipe everything Possum learned from your staff?")) void call("wipeStaffVoice"); }}
        >
          Wipe staff learning
        </button>
      </div>
      {note ? <div style={{ color: "#ffb3f0", marginTop: 8 }}>{note}</div> : null}
      {staff ? (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {staff.length ? staff.map((row) => (
            <div key={row.userId} style={{ border: "1px solid #4d0000", borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ color: "#ffdcdc" }}>{row.name}</strong>
                <button type="button" style={{ ...action, padding: "4px 8px" }} disabled={busy} onClick={() => void call("forgetStaff", { userId: row.userId })}>Forget</button>
              </div>
              <div style={hint}>
                {row.messageCount} messages seen | {row.lineCount} lines kept{row.topTopics.length ? ` | Topics: ${row.topTopics.join(", ")}` : ""}
              </div>
              {row.sampleLines.length ? <ul style={{ ...hint, margin: "6px 0 0" }}>{row.sampleLines.map((line) => <li key={line}>{line}</li>)}</ul> : null}
            </div>
          )) : <div style={hint}>Nothing learned yet.</div>}
        </div>
      ) : null}
    </section>
  );
}
