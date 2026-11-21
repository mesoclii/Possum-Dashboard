type Fetcher = typeof fetch;
export type MediaItem = { id: string; mime: string; review_status: string; role: "owner" | "recipient"; created_at: number };
export type ReviewItem = { id: string; created_at: number };
export type ReviewPreview = { rightsStatement: string; status: string; mime: "image/png" | "image/gif"; digest: string; imageBase64: string };
const ROOT = "/api/jed-private";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function createJedPrivateClient(fetcher: Fetcher = fetch) {
  let enabled = false;
  async function send(path: string, init: RequestInit = {}) {
    if (!enabled) throw new Error("Private JED media is unavailable.");
    const response = await fetcher(ROOT + path, { ...init, credentials: "same-origin", cache: "no-store" });
    if (!response.ok) {
      if (response.status === 401) throw new Error("Sign in again.");
      if (response.status === 429) throw new Error("Too many requests. Please retry later.");
      if (response.status === 507) throw new Error("Storage is full.");
      if (response.status === 404) throw new Error("Item unavailable or access denied.");
      throw new Error("Request failed. Please retry.");
    }
    return response;
  }
  function id(value: string) {
    if (!ID.test(value)) throw new Error("Invalid media ID.");
    return value;
  }
  function query(after: string) {
    return after ? `?after=${id(after)}` : "";
  }
  async function post(path: string, data: object) {
    return (await send(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })).json();
  }
  return {
    async checkAvailable() {
      enabled = false;
      try {
        const response = await fetcher(`${ROOT}/status`, { credentials: "same-origin", cache: "no-store" });
        enabled = response.ok && (await response.json()).available === true;
      } catch { enabled = false; }
      return enabled;
    },
    async upload(file: File, rights: boolean, review: boolean, statement: string) {
      if (!file || file.size < 1 || file.size > 2 * 1024 * 1024) throw new Error("Choose a PNG or GIF under 2 MiB.");
      if (!rights || !review || statement.trim().length < 10 || statement.length > 512) throw new Error("Rights and review consent are required.");
      const response = await send("/media", { method: "POST", body: file, headers: {
        "Content-Type": "application/octet-stream", "x-jed-rights": "yes", "x-jed-review": "yes",
        "x-jed-rights-statement": encodeURIComponent(statement.trim()),
      } });
      return response.json() as Promise<{ id: string }>;
    },
    async list(after = "") { return (await (await send(`/media${query(after)}`)).json()).items as MediaItem[]; },
    async queue(after = "") { return (await (await send(`/review-queue${query(after)}`)).json()).items as ReviewItem[]; },
    async media(mediaId: string) {
      const response = await send(`/media/${id(mediaId)}`);
      const mime = response.headers.get("content-type");
      if (mime !== "image/png" && mime !== "image/gif") throw new Error("Invalid media response.");
      return response.blob();
    },
    async preview(mediaId: string) {
      const preview = await (await send(`/media/${id(mediaId)}/review`)).json() as ReviewPreview;
      if (!["image/png", "image/gif"].includes(preview.mime) || !/^[0-9a-f]{64}$/.test(preview.digest) ||
          typeof preview.imageBase64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(preview.imageBase64) ||
          preview.imageBase64.length > 2_796_204) throw new Error("Invalid review preview.");
      return preview;
    },
    async review(mediaId: string, decision: "approve" | "reject", digest: string, confirmation: boolean) {
      if (!confirmation || !/^[0-9a-f]{64}$/.test(digest)) throw new Error("Confirm the review first.");
      return post(`/media/${id(mediaId)}/review`, { decision, confirmation, digest });
    },
    async share(mediaId: string, recipient: string, consent: boolean) {
      if (!consent || !/^\d{16,20}$/.test(recipient)) throw new Error("A recipient and explicit consent are required.");
      return post(`/media/${id(mediaId)}/share`, { recipient, consent });
    },
    async revoke(mediaId: string, recipient: string) {
      if (!/^\d{16,20}$/.test(recipient)) throw new Error("Enter a Discord user ID.");
      return post(`/media/${id(mediaId)}/revoke`, { recipient });
    },
    async takedown(mediaId: string, confirmation: boolean) {
      if (!confirmation) throw new Error("Confirm the takedown first.");
      return post(`/media/${id(mediaId)}/takedown`, { confirmation });
    },
    async remove(mediaId: string) { return (await send(`/media/${id(mediaId)}`, { method: "DELETE" })).json(); },
  };
}
