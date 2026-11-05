"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { PLAN_COMMON_FEATURES, PLAN_TIERS, type PlanTierKey } from "@/lib/premiumCatalog";

type Props = {
  // Dashboard passes a checkout handler; the public page passes buyHref instead.
  onBuy?: (key: PlanTierKey) => void;
  buyHref?: string;
  buyLabel?: string;
  disabled?: boolean;
};

const glow: CSSProperties = { color: "#fff1c7", textShadow: "0 0 12px rgba(255,214,120,.55)" };

export default function PlanTierPicker({ onBuy, buyHref, buyLabel, disabled }: Props) {
  const [selected, setSelected] = useState<PlanTierKey>("yearly");
  const tier = PLAN_TIERS.find((entry) => entry.key === selected) || PLAN_TIERS[0];

  const buyStyle: CSSProperties = {
    display: "inline-block",
    marginTop: 16,
    padding: "12px 22px",
    borderRadius: 12,
    border: "1px solid rgba(255,90,90,.8)",
    background: "rgba(150,0,0,.55)",
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    ...glow,
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
        {PLAN_TIERS.map((entry) => {
          const active = entry.key === selected;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setSelected(entry.key)}
              aria-pressed={active}
              style={{
                textAlign: "left",
                padding: 14,
                borderRadius: 14,
                cursor: "pointer",
                border: active ? "2px solid #ff5a5a" : "1px solid rgba(255,0,0,.35)",
                background: active ? "rgba(150,0,0,.4)" : "rgba(60,0,0,.25)",
                boxShadow: active ? "0 0 22px rgba(255,60,60,.35)" : "none",
                ...glow,
              }}
            >
              <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.85 }}>
                {entry.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
                ${entry.priceUsd}
                <span style={{ fontSize: 12, marginLeft: 6, opacity: 0.8 }}>{entry.cadence}</span>
              </div>
              {entry.badge ? (
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: "#ffb86b" }}>{entry.badge}</div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ ...glow, fontSize: 18, fontWeight: 900 }}>
          {tier.label} - ${tier.priceUsd} {tier.cadence}
        </div>
        <div style={{ color: "#ffd0d0", marginTop: 4 }}>{tier.tagline}</div>

        <div style={{ ...glow, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 14 }}>
          What you get with {tier.label}
        </div>
        <div style={{ ...glow, fontWeight: 700, lineHeight: 1.75, marginTop: 6 }}>
          {tier.extras.map((item) => (
            <div key={item} style={{ color: "#9dffb0" }}>+ {item}</div>
          ))}
        </div>

        <div style={{ ...glow, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 14 }}>
          Included in every plan
        </div>
        <div style={{ color: "#ffd9d9", fontSize: 14, lineHeight: 1.75, marginTop: 6 }}>
          {PLAN_COMMON_FEATURES.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </div>

        {onBuy ? (
          <button type="button" disabled={disabled} onClick={() => onBuy(tier.key)} style={buyStyle}>
            {buyLabel || `Buy ${tier.label}`}
          </button>
        ) : buyHref ? (
          <Link href={buyHref} style={buyStyle}>
            {buyLabel || `Get ${tier.label}`}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
