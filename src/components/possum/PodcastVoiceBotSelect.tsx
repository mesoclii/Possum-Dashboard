"use client";

import type { CSSProperties } from "react";
import { podcastVoiceLanes, type PodcastVoiceLane } from "@/lib/podcastVoiceLane";

export default function PodcastVoiceBotSelect({
  value, onChange, style, disabled = false,
}: {
  value: PodcastVoiceLane | "";
  onChange: (value: PodcastVoiceLane) => void;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  return (
    <label>Voice recording bot
      <select style={style} value={value} disabled={disabled} onChange={(event) => {
        const lane = podcastVoiceLanes.find((item) => item.value === event.target.value);
        if (lane) onChange(lane.value);
      }}>
        {!value ? <option value="" disabled>Choose a valid bot</option> : null}
        {podcastVoiceLanes.map((lane) => <option key={lane.value} value={lane.value}>{lane.label}</option>)}
      </select>
    </label>
  );
}
