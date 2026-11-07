import type { ReactNode } from "react";
import Link from "next/link";

export type LegalSection = { title: string; body: ReactNode };

export default function LegalDocument({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "transparent",
        color: "#f5f5f5",
        padding: "48px 20px 80px",
      }}
    >
      <article style={{ maxWidth: 820, margin: "0 auto", lineHeight: 1.7 }}>
        <Link href="/" style={{ color: "#ff6b6b", textDecoration: "none", fontSize: 14 }}>
          &larr; Back to Possum Bot
        </Link>
        <h1 style={{ fontSize: 36, margin: "18px 0 6px", letterSpacing: 0.5 }}>{title}</h1>
        <p style={{ color: "#aaa", margin: "0 0 22px", fontSize: 14 }}>Last updated: {updated}</p>
        <p style={{ color: "#ddd" }}>{intro}</p>
        {sections.map((section, index) => (
          <section key={section.title} style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 20, color: "#ff8a8a", margin: "0 0 8px" }}>
              {index + 1}. {section.title}
            </h2>
            <div style={{ color: "#d6d6d6" }}>{section.body}</div>
          </section>
        ))}
        <p style={{ marginTop: 40, fontSize: 13, color: "#888" }}>
          <a href="/terms" style={{ color: "#ff6b6b" }}>Terms of Service</a>
          {" · "}
          <a href="/privacy" style={{ color: "#ff6b6b" }}>Privacy Policy</a>
        </p>
      </article>
    </main>
  );
}
