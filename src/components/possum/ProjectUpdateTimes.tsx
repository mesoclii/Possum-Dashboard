"use client";

import { useEffect, useState } from "react";

type ProjectUpdates = {
  bot: string | null;
  dashboard: string | null;
  website: string | null;
};

function Timestamp({ value }: { value: string | null }) {
  if (!value) return <span>Unavailable</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>Unavailable</span>;
  return <time dateTime={date.toISOString()} data-no-translate>{date.toLocaleString()}</time>;
}

export default function ProjectUpdateTimes() {
  const [now, setNow] = useState<Date | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdates | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const controller = new AbortController();

    async function refresh() {
      try {
        const response = await fetch("/api/public-project-updates", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: ProjectUpdates = await response.json();
        setUpdates(data);
        setFailed(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Unable to load public project update times:", error);
        setFailed(true);
      }
    }

    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 300_000);
    return () => {
      controller.abort();
      window.clearInterval(clock);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const rows = [
    { label: "Bot updated", value: updates?.bot },
    { label: "Dashboard updated", value: updates?.dashboard },
    { label: "Website updated", value: updates?.website },
  ];

  return (
    <div className="site-project-times" tabIndex={0} aria-label="Project update times">
      <div><span>Local time</span> {now ? <time dateTime={now.toISOString()} data-no-translate>{now.toLocaleString()}</time> : <span>Loading...</span>}</div>
      {rows.map(({ label, value }) => (
        <div key={label}>
          <span>{label}</span>{" "}
          {updates ? <Timestamp value={value ?? null} /> : <span>{failed ? "Unavailable" : "Loading..."}</span>}
        </div>
      ))}
    </div>
  );
}
