"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { GuildMember } from "@/lib/liveRuntime";

type Props = {
  guildId: string;
  label: string;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
};

const field: CSSProperties = {
  width: "100%",
  minHeight: 42,
  color: "#ffd3d3",
  background: "#080808",
  border: "1px solid rgba(255,0,0,.4)",
  borderRadius: 9,
  padding: "9px 11px",
};

export default function DiscordMemberPicker({ guildId, label, value, onChange, multiple = false, style, disabled = false }: Props) {
  const [members, setMembers] = useState<GuildMember[]>([]);
  const selectedIds = useMemo(() => multiple ? (Array.isArray(value) ? value : []) : [String(value || "")].filter(Boolean), [multiple, value]);

  useEffect(() => {
    if (!guildId) { setMembers([]); return; }
    let active = true;
    void fetch(`/api/bot/guild-data?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const rows = Array.isArray(payload?.members) ? payload.members : [];
        setMembers(rows.filter((entry: any) => entry?.id && entry?.name));
      }).catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [guildId]);

  const memberIds = new Set(members.map((member) => member.id));
  const nameFor = (member: GuildMember) => member.username && member.username !== member.name
    ? `${member.name} (@${member.username})`
    : member.name;
  const missingSelections = selectedIds.filter((id) => id && !memberIds.has(id));

  return (
    <label style={{ display: "grid", gap: 6, color: "#ffbcbc" }}>
      <span>{label}</span>
      <select
        multiple={multiple}
        style={{ ...field, ...(multiple ? { minHeight: 120 } : {}), ...style }}
        disabled={disabled || !guildId}
        value={multiple ? selectedIds : selectedIds[0] || ""}
        onChange={(event) => onChange(multiple
          ? Array.from(event.target.selectedOptions, (option) => option.value)
          : event.target.value)}
      >
        {!multiple ? <option value="">Choose a member</option> : null}
        {missingSelections.map((id) => <option key={id} value={id}>Member unavailable</option>)}
        {members.map((member) => <option key={member.id} value={member.id}>{nameFor(member)}</option>)}
      </select>
      {!members.length ? <span style={{ fontSize: 11, color: "#ffb0b0" }}>No server members are available right now. Reload to refresh the list.</span> : null}
    </label>
  );
}
