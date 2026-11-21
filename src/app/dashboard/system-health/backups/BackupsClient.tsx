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

type SnapshotChecks = {
  featureBooleanTypesChecked: boolean;
  engines: { engine: string; coverage: string; checkedFields: number }[];
  issues: { engine: string; field: string; problem: string }[];
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
  const [backupsLoaded, setBackupsLoaded] = useState(false);
  const [backupName, setBackupName] = useState("");
  const [backupAction, setBackupAction] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [comparison, setComparison] = useState<{
    changedEngines: string[];
    changedFeatures: string[];
    changedEngineFields: { engine: string; fields: string[] }[] | null;
  } | null>(null);
  const [semanticChecks, setSemanticChecks] = useState<SnapshotChecks | null>(null);
  const [featurePreview, setFeaturePreview] = useState<{
    token: string;
    changedFeatures: string[];
    recovery: { kind: string; version: number; guildId: string; features: Record<string, boolean> };
    snapshot: unknown;
  } | null>(null);
  const [featureRecoveryDownloaded, setFeatureRecoveryDownloaded] = useState(false);
  const [authorizationProof, setAuthorizationProof] = useState("");
  const [msg, setMsg] = useState("");

  const loadEngineConfigBackups = useCallback(async () => {
    if (!guildId) return;
    const response = await fetch(`/api/bot/engine-config-backups?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success === false) {
      setBackupsLoaded(false);
      throw new Error(body?.error || "Failed to load saved engine backups.");
    }
    setEngineConfigBackups(Array.isArray(body.backups) ? body.backups : []);
    setBackupsLoaded(true);
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

  function downloadSnapshot(snapshot: { id: string; guildId: string; kind?: string }) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    const prefix = snapshot.kind === "guild-raw-configuration" ? "raw-guild-config" : "engine-config";
    link.download = `${prefix}-${guildId}-${snapshot.id.replace(/[^a-zA-Z0-9-]/g, "")}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function createEngineConfigBackup(raw = false) {
    if (!guildId) return;
    try {
      setBackupAction(raw ? "download-raw" : "download-new");
      const response = await fetch("/api/bot/engine-config-backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, action: raw ? "download-raw" : "download", name: backupName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true || body?.backup?.guildId !== guildId || typeof body?.backup?.id !== "string") {
        throw new Error(body?.error || "Failed to create a configuration backup.");
      }
      downloadSnapshot(body.backup);
      setBackupName("");
      setMsg(`Your browser was asked to download the backup. Store it securely; it may contain sensitive settings.${body.warning ? ` ${body.warning}` : ""}`);
    } catch (error: any) {
      setMsg(error?.message || "Failed to create a configuration backup.");
    } finally {
      setBackupAction("");
    }
  }

  async function downloadEngineConfigBackup(backup: EngineConfigBackup) {
    if (!guildId) return;
    try {
      setBackupAction(`download:${backup.id}`);
      const query = new URLSearchParams({ guildId, backupId: backup.id });
      const response = await fetch(`/api/bot/engine-config-backups?${query}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true || body?.backup?.guildId !== guildId || body?.backup?.id !== backup.id) {
        throw new Error(body?.error || "Failed to download the selected backup.");
      }
      downloadSnapshot(body.backup);
      setMsg("Your browser was asked to download the backup. Store it securely; it may contain sensitive settings.");
    } catch (error: any) {
      setMsg(error?.message || "Failed to download the selected backup.");
    } finally {
      setBackupAction("");
    }
  }

  async function validateEngineConfigBackup(compare = false) {
    if (!guildId || !importFile) return;
    setComparison(null);
    setSemanticChecks(null);
    if (importFile.size > 512 * 1024) {
      setMsg("Snapshot file exceeds the 512 KiB limit.");
      return;
    }
    try {
      setBackupAction(compare ? "compare" : "validate");
      let snapshot: unknown;
      try {
        snapshot = JSON.parse(await importFile.text());
      } catch {
        throw new Error("Snapshot file is not valid JSON.");
      }
      const response = await fetch("/api/bot/engine-config-backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, action: compare ? "compare" : "validate", snapshot }),
      });
      const body = await response.json().catch(() => ({}));
      const settingsIssues = response.status === 422 && body?.code === "SNAPSHOT_SETTINGS_ISSUES";
      if ((!response.ok || body?.success !== true) && !settingsIssues) throw new Error(body?.error || "Failed to check the snapshot.");
      if (body.semantic?.coverage !== "incomplete" || typeof body.semantic?.featureBooleanTypesChecked !== "boolean" || !Array.isArray(body.semantic?.engines) || !Array.isArray(body.semantic?.issues)) {
        throw new Error("The snapshot check response was incomplete.");
      }
      setSemanticChecks(body.semantic);
      if (compare) {
        if (!Array.isArray(body.changedEngines) || !Array.isArray(body.changedFeatures)) throw new Error("Comparison response was incomplete.");
        const fields = body.changedEngineFields;
        if (fields !== undefined && (!Array.isArray(fields) || fields.some((entry: any) =>
          typeof entry?.engine !== "string" || !Array.isArray(entry.fields) || entry.fields.some((field: unknown) => typeof field !== "string")))) {
          throw new Error("Comparison field details were invalid.");
        }
        setComparison({ changedEngines: body.changedEngines, changedFeatures: body.changedFeatures, changedEngineFields: fields ?? null });
      }
      setMsg(`${body.semantic.issues.length ? "Limited checks found settings issues." : "File structure, server ID and limited settings checked."} The file was not saved and no settings were changed. Restore remains unavailable; most settings are not verified.${body.warning ? ` ${body.warning}` : ""}`);
    } catch (error: any) {
      setMsg(error?.message || "Failed to check the snapshot.");
    } finally {
      setBackupAction("");
    }
  }

  async function previewFeatureRestore() {
    if (!guildId || !importFile) return;
    setFeaturePreview(null);
    setFeatureRecoveryDownloaded(false);
    if (importFile.size > 512 * 1024) {
      setMsg("Snapshot file exceeds the 512 KiB limit.");
      return;
    }
    try {
      setBackupAction("features-preview");
      const snapshot: unknown = JSON.parse(await importFile.text());
      const response = await fetch("/api/bot/engine-config-backups", {
        method: "POST", headers: { "Content-Type": "application/json", ...(authorizationProof.trim() ? { "x-restore-auth-proof": authorizationProof.trim() } : {}) },
        body: JSON.stringify({ guildId, action: "features-preview", snapshot }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true || typeof body.token !== "string" ||
          !Array.isArray(body.changedFeatures) || body.changedFeatures.some((item: unknown) => typeof item !== "string") ||
          body.recovery?.kind !== "guild-feature-settings" || body.recovery?.guildId !== guildId ||
          !body.recovery?.features || typeof body.recovery.features !== "object") {
        throw new Error(body?.error || "Feature preview failed.");
      }
      setFeaturePreview({ token: body.token, changedFeatures: body.changedFeatures, recovery: body.recovery, snapshot });
      setAuthorizationProof("");
      setMsg("Review the feature changes and download the feature recovery file. Feature restore remains disabled until dashboard sessions and bot access are isolated.");
    } catch (error: any) {
      setMsg(error?.message || "Feature preview failed.");
    } finally {
      setBackupAction("");
    }
  }

  function downloadFeatureRecovery() {
    if (!featurePreview) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(featurePreview.recovery)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `feature-recovery-${guildId}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeatureRecoveryDownloaded(true);
    setMsg("Your browser was asked to download the feature recovery file. Verify it was saved before restoring.");
  }

  async function restoreFeatures() {
    if (!featurePreview || !featureRecoveryDownloaded ||
        !window.confirm(`Restore ONLY feature toggles for server ${guildId}? Engine and other dashboard settings will not be restored.`)) return;
    try {
      setBackupAction("features-restore");
      const response = await fetch("/api/bot/engine-config-backups", {
        method: "POST", headers: { "Content-Type": "application/json", "x-restore-auth-proof": authorizationProof.trim() },
        body: JSON.stringify({ guildId, action: "features-restore", snapshot: featurePreview.snapshot,
          previewToken: featurePreview.token, confirm: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.success !== true) throw new Error(body?.error || "Restore outcome is unknown. Refresh and compare before retrying.");
      setMsg(body.warning || "Feature toggles restored.");
    } catch (error: any) {
      setMsg(error?.message || "Restore outcome is unknown. Refresh and compare before retrying.");
    } finally {
      setFeaturePreview(null);
      setFeatureRecoveryDownloaded(false);
      setAuthorizationProof("");
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
    setMsg(j?.success ? `Engine configuration import applied (${mode}).${j?.warning ? ` ${j.warning}` : ""}` : j?.error || "Engine restore failed.");
    if (j?.success && j?.backup) {
      setEngineBackupText(JSON.stringify(j.backup, null, 2));
    }
  }

  return (
    <div style={{ padding: 18 }}>
      <h1 style={{ marginTop: 0 }}>Backups + Restore</h1>
      <p>Selected server ID: <strong>{guildId || "None — select a server first"}</strong>. Verify this ID before creating or restoring a backup.</p>
      <div style={{ color: "#ff9c9c", marginBottom: 10 }}>{msg}</div>

      <div style={{ marginBottom: 12, padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Download Server Configuration Backup</h2>
        <p>Download this server&apos;s effective bot engine configuration and feature toggles to your computer. New copies are not stored on the bot host. This is not a full Discord server or bot data backup: separately stored settings, Discord channels and roles, member data, and databases are not included. Engine settings and feature toggles are captured separately, so concurrent changes can produce a mixed-time snapshot.</p>
        <p>Raw archive downloads the stored guild engine entry and feature database record without applying defaults. The stores are still read separately; it is not transactionally consistent or restorable. Raw files can be checked for structure and accidental corruption, but cannot be compared here.</p>
        <p>Files may contain sensitive settings; keep them secure. You can select and upload a same-server snapshot up to 512 KiB for a structural check, limited security field checks, or comparison; it is not saved. These checks do not verify most settings or establish restore safety. Comparison lists changed engine and feature names without showing their values. Current stores are read separately and may change during comparison.</p>
        <p>Full engine and dashboard settings restore is unavailable. Feature-only review and recovery-file download are available, but feature restore is also disabled. The separate live engine restore below is not protected by these safeguards.</p>
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
            {backupAction === "download-new" ? "Preparing..." : "Backup — Download JSON"}
          </button>
          <button type="button" disabled={Boolean(backupAction) || !guildId} onClick={() => void createEngineConfigBackup(true)}>
            {backupAction === "download-raw" ? "Preparing..." : "Download Raw Archive"}
          </button>
          <input type="file" accept=".json,application/json" aria-label="Snapshot JSON file" disabled={Boolean(backupAction)} onChange={(event) => { setImportFile(event.target.files?.[0] || null); setComparison(null); setSemanticChecks(null); setFeaturePreview(null); setFeatureRecoveryDownloaded(false); }} />
          <button type="button" disabled={Boolean(backupAction) || !guildId || !importFile} onClick={() => void validateEngineConfigBackup()}>
            {backupAction === "validate" ? "Checking..." : "Check Selected File"}
          </button>
          <button type="button" disabled={Boolean(backupAction) || !guildId || !importFile} onClick={() => void validateEngineConfigBackup(true)}>
            {backupAction === "compare" ? "Comparing..." : "Compare With Current Settings"}
          </button>
          <button type="button" disabled title="Safe restore is not yet available">Restore unavailable</button>
          <button type="button" disabled={Boolean(backupAction) || !guildId || !importFile} onClick={() => void previewFeatureRestore()}>
            {backupAction === "features-preview" ? "Preparing..." : "Preview Feature Toggles Only"}
          </button>
        </div>
        <label style={{ display: "block", marginTop: 10 }}>Isolated restore authorization proof (required for feature restore)
          <textarea aria-label="Isolated restore authorization proof" value={authorizationProof} onChange={(event) => setAuthorizationProof(event.target.value)} rows={3} placeholder="Paste the one-use proof from the isolated restore-authorization service" style={{ display: "block", width: "100%", marginTop: 5, background: "#0c0c0c", color: "#ffd7d7", border: "1px solid #5f0000", borderRadius: 8, padding: "8px 10px", fontFamily: "monospace", fontSize: 12 }} />
        </label>
        {featurePreview ? (
          <div aria-live="polite">
            <p>Feature toggles to change: {featurePreview.changedFeatures.length ? featurePreview.changedFeatures.join(", ") : "None"}.</p>
            <p>This does not restore engine settings or other dashboard settings. The preview expires after five minutes.</p>
            <button type="button" disabled={Boolean(backupAction)} onClick={downloadFeatureRecovery}>Download Feature Recovery File</button>
            <button type="button" disabled={Boolean(backupAction) || !authorizationProof.trim()} title="Paste a fresh proof for the exact restore request before applying" onClick={() => void restoreFeatures()}>
              Restore Feature Toggles
            </button>
          </div>
        ) : null}
        {semanticChecks ? (
          <div aria-live="polite">
            <p>{semanticChecks.featureBooleanTypesChecked ? "Feature toggle types checked." : "No feature record was present; feature types were not checked."} {semanticChecks.engines.some((engine) => engine.coverage === "partial") ? `Limited security-field checks: ${semanticChecks.issues.length} issue(s).` : "No engine settings were checked."} All engines remain incompletely validated.</p>
            {semanticChecks.issues.map((issue, index) => <div key={index}>{issue.engine} · {issue.field}: {issue.problem}</div>)}
            <details>
              <summary>Show engine check coverage</summary>
              {semanticChecks.engines.map((engine) => <div key={engine.engine}>{engine.engine}: {engine.coverage === "partial" ? `${engine.checkedFields} fields checked; other settings not verified` : "not checked"}</div>)}
            </details>
          </div>
        ) : null}
        {comparison ? (
          <div aria-live="polite">
            <p>Different engines: {comparison.changedEngines.length ? comparison.changedEngines.join(", ") : "None found"}</p>
            {comparison.changedEngineFields === null ? <p>Field details are unavailable from this bot version.</p> : comparison.changedEngineFields.map((entry) => (
              <div key={entry.engine}>{entry.engine}: {entry.fields.join(", ")}</div>
            ))}
            <p>Different feature toggles: {comparison.changedFeatures.length ? comparison.changedFeatures.join(", ") : "None found"}</p>
            <p>Field names are top-level only; unknown fields are grouped as Other settings. Values are not shown. Comparison covers only the settings in this file, not other dashboard settings.</p>
          </div>
        ) : null}
        <h3>Previously saved server-side backups</h3>
        <p>Existing copies can be downloaded or deleted. Older backups may contain default feature values if the database could not be read.</p>
        <button type="button" disabled={Boolean(backupAction)} onClick={() => void loadEngineConfigBackups().catch((error) => setMsg(error?.message || "Failed to load saved backups."))}>Refresh Backups</button>
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
                <button type="button" disabled={Boolean(backupAction)} onClick={() => void downloadEngineConfigBackup(backup)}>
                  {backupAction === `download:${backup.id}` ? "Downloading..." : "Download JSON"}
                </button>
                <button type="button" disabled title="Restore is unavailable until validation, concurrent-write protection, and recovery are in place">Restore unavailable</button>
                <button type="button" disabled={Boolean(backupAction)} onClick={() => void deleteEngineConfigBackup(backup)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {backupsLoaded && engineConfigBackups.length === 0 ? <div>No saved engine configuration backups found.</div> : null}
        </div>
      </div>

      <div style={{ marginBottom: 12, padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <div>Dashboard setup snapshots (separate from bot engine backups; not a full server backup)</div>
        <button onClick={createSnapshot}>Create Snapshot</button>
        <button style={{ marginLeft: 8 }} onClick={loadSnapshots}>Refresh Snapshot List</button>
        <div style={{ marginTop: 8, maxHeight: 180, overflow: "auto", background: "#111", padding: 8 }}>
          {snapshots.map((s, i) => <div key={i}>{typeof s === "string" ? s : JSON.stringify(s)}</div>)}
          {snapshots.length === 0 && <div>No snapshots found.</div>}
        </div>
      </div>

      <div style={{ padding: 12, border: "1px solid #5f0000", borderRadius: 10 }}>
        <div>Dashboard setup files only (separate from bot engine configuration)</div>
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
        <p>Exports engine configuration to the text box only, without feature toggles. Import can overwrite the selected server, does not verify the source server, and does not create a recovery backup.</p>
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
