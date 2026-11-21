"use client";

/* eslint-disable @next/next/no-img-element -- Private previews must not pass through an image optimizer. */
import { useEffect, useMemo, useState } from "react";
import { createJedPrivateClient, type MediaItem, type ReviewItem, type ReviewPreview } from "@/lib/jedPrivateClient";

export default function JedPrivateMediaPage() {
  const api = useMemo(() => createJedPrivateClient(), []);
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState("Checking availability…");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [reviewConsent, setReviewConsent] = useState(false);
  const [statement, setStatement] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [image, setImage] = useState("");
  const [recipient, setRecipient] = useState("");
  const [shareConsent, setShareConsent] = useState(false);
  const [reviewId, setReviewId] = useState("");
  const [preview, setPreview] = useState<ReviewPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [takedownId, setTakedownId] = useState("");
  const [takedownConsent, setTakedownConsent] = useState(false);

  useEffect(() => {
    let active = true;
    void api.checkAvailable().then((ready) => {
      if (!active) return;
      setAvailable(ready);
      setMessage(ready ? "Private media is available." : "Private uploads and sharing are unavailable until security safeguards are in place.");
    });
    return () => { active = false; };
  }, [api]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);

  async function run(action: () => Promise<void>) {
    if (!available || busy) return;
    setBusy(true);
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  }
  async function loadItems(after = "") {
    const result = await api.list(after);
    setItems((previous) => after ? [...previous, ...result] : result);
  }
  async function loadQueue(after = "") {
    const result = await api.queue(after);
    setQueue((previous) => after ? [...previous, ...result] : result);
  }

  return (
    <main style={{ maxWidth: 1000, padding: 20 }}>
      <h1>Private JED media</h1>
      <p>Upload only media you have the right to store and share. A separate reviewer checks rights and SFW content before named-recipient sharing. This does not publish to the gallery.</p>
      <p role="status" aria-live="polite">{message}</p>
      <fieldset disabled={!available || busy} style={{ border: 0, padding: 0 }}>
        <section>
          <h2>Upload for private review</h2>
          <label>PNG or GIF, up to 2 MiB <input type="file" accept="image/png,image/gif" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
          <p><label>Rights statement <textarea value={statement} maxLength={512} onChange={(event) => setStatement(event.target.value)} /></label></p>
          <p><label><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} /> I have the rights and consent needed for storage and named-recipient sharing.</label></p>
          <p><label><input type="checkbox" checked={reviewConsent} onChange={(event) => setReviewConsent(event.target.checked)} /> I consent to a private human review of this media and rights statement.</label></p>
          <button type="button" onClick={() => void run(async () => {
            if (!file) throw new Error("Choose a PNG or GIF.");
            const result = await api.upload(file, rights, reviewConsent, statement);
            setMessage(`Uploaded ${result.id}; awaiting review.`);
            setFile(null); setRights(false); setReviewConsent(false); setStatement("");
            await loadItems();
          })}>Upload</button>
        </section>
        <section>
          <h2>Your media and media shared with you</h2>
          <button type="button" onClick={() => void run(() => loadItems())}>Refresh</button>{" "}
          <button type="button" disabled={items.length === 0} onClick={() => void run(() => loadItems(items[items.length - 1].id))}>More</button>
          <ul>{items.map((item) => <li key={item.id}>
            <button type="button" onClick={() => void run(async () => {
              const blob = await api.media(item.id);
              setImage(URL.createObjectURL(blob)); setSelected(item); setShareConsent(false);
            })}>{item.id}</button> — {item.role}, {item.review_status}
          </li>)}</ul>
          {selected && image ? <div>
            <p>{selected.id} <img src={image} alt="Selected private media" style={{ maxWidth: 160, maxHeight: 160 }} /></p>
            {selected.role === "owner" ? <>
              <label>Recipient Discord user ID <input value={recipient} onChange={(event) => setRecipient(event.target.value)} /></label>
              <p><label><input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)} /> I consent to sharing this item with this recipient.</label></p>
              <button type="button" disabled={selected.review_status !== "approved" || !shareConsent} onClick={() => void run(async () => { await api.share(selected.id, recipient, shareConsent); setShareConsent(false); setMessage("Recipient granted access."); })}>Share</button>{" "}
              <button type="button" onClick={() => void run(async () => { await api.revoke(selected.id, recipient); setMessage("Recipient access revoked."); })}>Revoke</button>{" "}
              <button type="button" onClick={() => void run(async () => {
                if (!window.confirm("Delete this media and revoke all recipients?")) return;
                await api.remove(selected.id); setSelected(null); setImage(""); await loadItems(); setMessage("Media deleted.");
              })}>Delete</button>
            </> : null}
          </div> : null}
        </section>
        <section>
          <h2>Reviewer queue</h2>
          <p>Only configured reviewers can open the queue. Approval attests that you reviewed the displayed media and rights claim and found the media SFW.</p>
          <button type="button" onClick={() => void run(() => loadQueue())}>Refresh queue</button>{" "}
          <button type="button" disabled={queue.length === 0} onClick={() => void run(() => loadQueue(queue[queue.length - 1].id))}>More</button>
          <ul>{queue.map((item) => <li key={item.id}><button type="button" onClick={() => void run(async () => {
            const result = await api.preview(item.id);
            setReviewId(item.id); setPreview(result); setConfirmed(false);
          })}>{item.id}</button></li>)}</ul>
          {preview ? <div>
            <p>Reviewing {reviewId}</p>
            <img src={`data:${preview.mime};base64,${preview.imageBase64}`} alt="Media awaiting review" style={{ maxWidth: 256, maxHeight: 256 }} />
            <p>Rights statement: {preview.rightsStatement}</p>
            <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I reviewed this image and rights statement; my decision is based on both.</label>
            <p>
              {(["approve", "reject"] as const).map((decision) => <button key={decision} type="button" disabled={!confirmed} onClick={() => void run(async () => {
                await api.review(reviewId, decision, preview.digest, confirmed);
                setPreview(null); setConfirmed(false); await loadQueue(); setMessage(`Review ${decision} recorded.`);
              })}>{decision === "approve" ? "Approve SFW and rights" : "Reject"}</button>)}
            </p>
          </div> : null}
          <p><label>Approved media ID for takedown <input value={takedownId} onChange={(event) => setTakedownId(event.target.value)} /></label></p>
          <p><label><input type="checkbox" checked={takedownConsent} onChange={(event) => setTakedownConsent(event.target.checked)} /> Take down this item and revoke all recipients.</label></p>
          <button type="button" onClick={() => void run(async () => {
            await api.takedown(takedownId, takedownConsent); setTakedownConsent(false); setMessage("Takedown recorded.");
          })}>Take down</button>
        </section>
      </fieldset>
    </main>
  );
}
