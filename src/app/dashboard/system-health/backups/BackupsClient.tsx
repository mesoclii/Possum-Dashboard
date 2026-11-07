"use client";

import { useCallback, useEffect, useState } from "react";

type EngineConfigBackup = {
  id: string;
  guildId: string;
  name: string;
  createdAt: string;
  actorUserId: string;
  engineCount: number;
  featureCount: number;
};

function getGuildId() {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search).get("guildId") || "";
  const s = localStorage.getItem("activeGuildId") || "";
  const g = (q || s).trim();
  if (g) localStorage.setItem("activeGuildId", g);
  return g;
}

export default function BackupsPage() {
  const [guildId] = useState(() => getGuildId());
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [backupText, setBackupText] = useState("");
  const [engineBackupText, setEngineBackupText] = useState("");
  const [engineFilter, setEngineFilter] = useState("");
  const [engineKeys, setEngineKeys] = useState<string[]>([]);
  const [engineConfigBackups, setEngineConfigBackups] = useState<EngineConfigBackup[]>([]);
  const [backupName, setBackupName] = useState("");
  const [backupAction, setBackupAction] = useState("");
  const [msg, setMsg] = useState("");

  const loadEngineConfigBackups = useCallback(async () => {
    if (!guildId) return;
    const response = await fetch(`/api/bot/engine-config-backups?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success === false) {
      throw new Error(body?.error || "Failed to load saved engine backups.");
    }
    setEngineConfigBackups(Array.isArray(body.backups) ? body.backups : []);
  }, [guildId]);

  const loadSnapshots = useCallback(async () => {
    const r = await fetch("/api/system/snapshots");
    const j = await r.json();
    setSnapshots(Array.isArray(j?.snapshots) ? j.snapshots : []);
  }, []);

  const loadEngineCatalog = useCallback(async () => {
    if (!guildId) return;
    const r = await fetch(`/api/bot/engine-catalog?guildId=${guildId}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setEngineKeys(Array.isArray(j?.engineKeys) ? j.engineKeys : []);
  }, [guildId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadSnapshots().catch(() => {});
      loadEngineCatalog().catch(() => {});
      loadEngineConfigBackups().catch((error) => setMsg(error?.message || "Failed to load saved engine backups."));
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadEngineCatalog, loadEngineConfigBackups, loadSnapshots]);

  async function createEngineConfigBackup() {
    if (!guildId) return;
    try {
      setBackupAction("create");
      const response = await fetch("/api/bot/engine-config-backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, action: "create", name: backupName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Failed to create a configuration backup.");
      }
      setBackupName("");
      setMsg(`Saved backup "${body.backup?.name || "Configuration backup"}".`);
      await loadEngineConfigBackups();
    } catch (error: any) {
      setMsg(error?.message || "Failed to create a configuration backup.");
    } finally {
      setBackupAction("");
    }
  }

  async function restoreEngineConfigBackup(backup: EngineConfigBackup) {
    if (!guildId || !window.confirm(`Restore "${backup.name}" to this server? The current configuration will first be saved as a recovery backup.`)) return;
    try {
      setBackupAction(backup.id);
      const response = await fetch("/api/bot/engine-config-backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, action: "restore", backupId: backup.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Failed to restore the configuration backup.");
      }
      setMsg(`Restored "${backup.name}". A recovery backup of the previous configuration was also saved.`);
      await loadEngineConfigBackups();
    } catch (error: any) {
      setMsg(error?.message || "Failed to restore the configuration backup.");
    } finally {
      setBackupAction("");
    }
  }

  async function deleteEngineConfigBackup(backup: EngineConfigBackup) {
    if (!guildId || !window.confirm(`Delete the saved backup "${backup.name}"?`)) return;
    try {
      setBackupAction(backup.id);
      const response = await fetch("/api/bot/engine-config-backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, action: "delete", backupId: backup.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success === false) {
        throw new Error(body?.error || "Failed to delete the configuration backup.");
      }
      setMsg(`Deleted backup "${backup.name}".`);
      await loadEngineConfigBackups();
    } catch (error: any) {
      setMsg(error?.message || "Failed to delete the configuration backup.");
    } finally {
      setBackupAction("");
    }
  }

  async function createSnapshot() {
    const r = await fetch("/api/system/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, note: "manual-ui-snapshot" })
    });
    const j = await r.json();
    setMsg(j?.success ? "Snapshot created." : j?.error || "Snapshot failed.");
    await loadSnapshots();
  }

  async function exportConfig() {
    const r = await fetch(`/api/system/config-backup?guildId=${guildId}`);
    const j = await r.json();
    if (!j?.success) {
      setMsg(j?.error || "Export failed.");
      return;
    }
    setBackupText(JSON.stringify(j.backup, null, 2));
    setMsg("Config exported.");
  }

  async function importConfig(mode: "merge" | "replace") {
    let payload: any;
    try {
      payload = JSON.parse(backupText || "{}");
    } catch {
      setMsg("Backup JSON is invalid.");
      return;
    }
    const r = await fetch("/api/system/config-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, mode, payload })
    });
    const j = await r.json();
    setMsg(j?.success ? `Import complete (${mode}).` : j?.error || "Import failed.");
  }

  async function exportEngineConfig() {
    if (!guildId) return;
    const query = new URLSearchParams({ guildId });
    if (engineFilter) query.set("engine", engineFilter);
    const r = await fetch(`/api/bot/engine-backup?${query.toString()}`, { cache: "no-store" });
    const j = await r.json();
    if (!j?.success) {
      setMsg(j?.error || "Engine export failed.");
      return;
    }
    setEngineBackupText(JSON.stringify(j.backup, null, 2));
    if (Array.isArray(j?.backup?.engines)) {
      setEngineKeys(j.backup.engines);
    }
    setMsg(engineFilter ? `Exported ${engineFilter} engine config.` : "Exported live bot engine config.");
  }

  async function importEngineConfig(mode: "merge" | "replace") {
    let payload: any;
    try {
      payload = JSON.parse(engineBackupText || "{}");
    } catch {
      setMsg("Engine backup JSON is invalid.");
      return;
    }
    const r = await fetch("/api/bot/engine-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId, mode, payload }),
    });
    const j = await r.json();
    setMsg(j?.success ? `Engine restore complete (${mode}).` : j?.error || "Engine restore failed.");
    if (j?.success && j?.backup) {
      setEngineBackupText(JSON.stringify(j.backup, null, 2));
    }
  }

  return (
    <div style={{ padding: 18 }}>
      <h1 style={{ marginTop: 0 }}>Backups + Restore</h1>
      <div style={{ color: "#ff9c9c", marginBottom: 10 }}>{msg}</div>

      <div style={{ marginBottom: 12, padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Saved Server Configuration Backups</h2>
        <p>Save a named copy of this server&apos;s bot engine configuration and feature toggles before changing your setup. Restoring automatically creates a recovery backup of the current settings first.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            aria-label="Backup name"
            value={backupName}
            onChange={(event) => setBackupName(event.target.value)}
            maxLength={100}
            placeholder="Backup name (optional)"
            style={{ minWidth: 240, background: "#0c0c0c", color: "#ffd7d7", border: "1px solid #5f0000", borderRadius: 8, padding: "8px 10px" }}
          />
          <button type="button" disabled={Boolean(backupAction) || !guildId} onClick={() => void createEngineConfigBackup()}>
            {backupAction === "create" ? "Saving..." : "Create Server Backup"}
          </button>
          <button type="button" disabled={Boolean(backupAction)} onClick={() => void loadEngineConfigBackups().catch((error) => setMsg(error?.message || "Failed to load saved backups."))}>
            Refresh Backups
          </button>
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {engineConfigBackups.map((backup) => (
            <div key={backup.id} style={{ border: "1px solid #3b2020", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <strong>{backup.name}</strong>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {new Date(backup.createdAt).toLocaleString()} · {backup.engineCount} engines · {backup.featureCount} feature settings
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" disabled={Boolean(backupAction)} onClick={() => void restoreEngineConfigBackup(backup)}>
                  {backupAction === backup.id ? "Working..." : "Restore"}
                </button>
                <button type="button" disabled={Boolean(backupAction)} onClick={() => void deleteEngineConfigBackup(backup)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {engineConfigBackups.length === 0 ? <div>No saved full server backups yet.</div> : null}
        </div>
      </div>

      <div style={{ marginBottom: 12, padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <button onClick={createSnapshot}>Create Snapshot</button>
        <button style={{ marginLeft: 8 }} onClick={loadSnapshots}>Refresh Snapshot List</button>
        <div style={{ marginTop: 8, maxHeight: 180, overflow: "auto", background: "#111", padding: 8 }}>
          {snapshots.map((s, i) => <div key={i}>{typeof s === "string" ? s : JSON.stringify(s)}</div>)}
          {snapshots.length === 0 && <div>No snapshots found.</div>}
        </div>
      </div>

      <div style={{ padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <button onClick={exportConfig}>Export Guild Config</button>
        <button style={{ marginLeft: 8 }} onClick={() => importConfig("merge")}>Import (Merge)</button>
        <button style={{ marginLeft: 8 }} onClick={() => importConfig("replace")}>Import (Replace)</button>
        <textarea
          value={backupText}
          onChange={(e) => setBackupText(e.target.value)}
          placeholder="Backup JSON shows here (or paste to import)"
          style={{ width: "100%", minHeight: 320, marginTop: 8, background: "#0c0c0c", color: "#ffd7d7" }}
        />
      </div>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <div style={{ marginBottom: 8, color: "#ffd7d7", fontWeight: 700 }}>Live Bot Engine Config</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={engineFilter}
            onChange={(e) => setEngineFilter(e.target.value)}
            style={{ minWidth: 220, background: "#0c0c0c", color: "#ffd7d7", border: "1px solid #5f0000", borderRadius: 8, padding: "8px 10px" }}
          >
            <option value="">All engines</option>
            {engineKeys.map((engineKey) => (
              <option key={engineKey} value={engineKey}>{engineKey}</option>
            ))}
          </select>
          <button onClick={exportEngineConfig}>Export Bot Engine Config</button>
          <button onClick={() => importEngineConfig("merge")}>Restore (Merge)</button>
          <button onClick={() => importEngineConfig("replace")}>Restore (Replace)</button>
        </div>
        <textarea
          value={engineBackupText}
          onChange={(e) => setEngineBackupText(e.target.value)}
          placeholder="Live bot engine config backup shows here (or paste exported JSON to restore)"
          style={{ width: "100%", minHeight: 320, marginTop: 8, background: "#0c0c0c", color: "#ffd7d7" }}
        />
      </div>
    </div>
  );
}
