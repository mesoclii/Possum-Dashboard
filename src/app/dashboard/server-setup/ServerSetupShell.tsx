"use client";

import { useState } from "react";
import InfrastructureSetupWizard from "../infrastructure/InfrastructureSetupWizard";
import GuidedServerSetup from "./GuidedServerSetup";

// Guided setup is the default. The detailed controls (VIP visibility, custom
// roles and channels, spawn tuning, restore records) stay one click away.
export default function ServerSetupShell() {
  const [view, setView] = useState<"guided" | "advanced">("guided");

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Setup view" className="flex flex-wrap gap-2">
        {([
          ["guided", "Guided setup"],
          ["advanced", "Advanced controls"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`min-h-10 rounded-lg border px-4 text-sm font-bold ${view === id ? "border-pink-400 bg-pink-500/20 text-white" : "border-white/10 text-pink-100/70"}`}>
            {label}
          </button>
        ))}
      </div>
      {view === "guided" ? <GuidedServerSetup /> : <InfrastructureSetupWizard />}
    </div>
  );
}
