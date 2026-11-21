"use client";

import { useRef, useState } from "react";

type Resource = { id: string; name: string; kind: string; exists: boolean; blocked: boolean; reason?: string };
type Preview = { previewToken: string; resources: Resource[]; unverifiedCount: number };

export default function EmergencyUndoPage() {
  const [guildId, setGuildId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [authorizationProof, setAuthorizationProof] = useState("");
  const inFlight = useRef(false);

  async function send(action: "undo-preview" | "undo") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/bot/infrastructure", {
        method: "POST",
        headers: { "content-type": "application/json", "x-restore-auth-proof": authorizationProof.trim() },
        body: JSON.stringify({ guildId, action, confirmed: action === "undo" && confirmed, previewToken: preview?.previewToken || "" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Undo Setup failed.");
      if (action === "undo-preview") {
        setPreview(data.undoPreview);
        setConfirmed(false);
        setAuthorizationProof("");
      } else {
        setPreview(null);
        setConfirmed(false);
        setAuthorizationProof("");
        const failures = data.result?.failed || [];
        setMessage(`Removed ${data.result?.removed?.length || 0} resource(s). ${failures.length} operation(s) need attention.${failures.map((item: { name?: string; id?: string; error?: string }) => ` ${item.name || item.id}: ${item.error || "Could not remove."}`).join("")}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Undo Setup failed.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6 text-red-100">
      <h1 className="text-2xl font-black">Emergency Undo Setup</h1>
      <p>Only the current Discord server owner or globally authorized Possum emergency staff can use this page. Server administrators and dashboard roles do not grant access. <a className="underline" href="/api/auth/discord/login?returnTo=%2Femergency-undo">Sign in with Discord</a>.</p>
      <p role="status">Undo Setup requires a single-use proof from the separately isolated restore-authorization service. Generate a proof for this exact request, paste it below, and generate a fresh proof before confirming the final deletion.</p>
      <p>Only verified setup-created resources can be removed; reused, unknown-ownership and protected resources are excluded. Channel messages are permanently lost and deleted roles are removed from members. The server itself is not deleted.</p>
      <label className="block">Discord server ID
        <input className="mt-1 block w-full rounded border border-red-500 bg-black p-2" value={guildId} onChange={(event) => { setGuildId(event.target.value.trim()); setPreview(null); setConfirmed(false); }} />
      </label>
      <label className="block">Isolated authorization proof
        <textarea className="mt-1 block w-full rounded border border-red-500 bg-black p-2 font-mono text-xs" rows={4} value={authorizationProof} onChange={(event) => setAuthorizationProof(event.target.value)} placeholder="Paste the one-use proof from the isolated authorization service" />
      </label>
      <button className="rounded border border-red-500 p-2 disabled:opacity-50" disabled={busy || !guildId || !authorizationProof.trim()} onClick={() => void send("undo-preview")}>Preview Undo</button>
      {preview ? (
        <section className="space-y-3 rounded border border-red-500 p-4">
          <h2 className="font-bold">Review the exact preview</h2>
          <p>{preview.unverifiedCount || 0} older resource(s) of unknown ownership are excluded.</p>
          <ul>{preview.resources.map((item) => <li key={item.id}>{item.name} ({item.kind}, {item.id}) — {item.blocked ? `blocked: ${item.reason || "cannot delete"}` : !item.exists ? "already missing; setup mapping will be cleared" : "will be deleted"}</li>)}</ul>
          {!preview.resources.length ? <p>No verified setup-created resources were found.</p> : null}
          <p>Undo also disables setup automation, clears mappings to deleted resources and clears setup selections. Other engine settings remain unchanged.</p>
          <label className="block"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I understand the permanent data loss and approve this preview.</label>
          <button className="rounded border border-red-500 bg-red-950 p-2 disabled:opacity-50" disabled={busy || !confirmed || !authorizationProof.trim()} onClick={() => void send("undo")}>Confirm Undo Setup</button>
        </section>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
