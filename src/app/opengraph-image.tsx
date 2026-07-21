import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Ninja Labs — Build. Complete. Own your track record.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse (Satori) cannot resolve CSS custom properties, so the brand
// tokens from globals.css are inlined verbatim here:
// --color-hero-from #0C1528 · --color-hero-via #1D2B60 · --color-hero-to #4D3DFF
// --color-glow #7B6CFF · --color-accent-soft #9A90FF · --color-primary-outline #C3BEFF
export default async function Image() {
  const mascot = await readFile(join(process.cwd(), "public/figma/ninja-labs-mascot.png"), "base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundImage: "linear-gradient(160deg, #0C1528 0%, #1D2B60 55%, #4D3DFF 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <img
            alt=""
            height={96}
            src={`data:image/png;base64,${mascot}`}
            style={{ borderRadius: "20px" }}
            width={96}
          />
          <div style={{ fontSize: 48, fontWeight: 700, color: "#FFFFFF" }}>Ninja Labs</div>
        </div>
        <div
          style={{
            marginTop: "48px",
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#FFFFFF",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Complete bounties. Collect proof.</span>
          <span style={{ color: "#9A90FF" }}>Own your track record.</span>
        </div>
        <div style={{ marginTop: "40px", fontSize: 30, color: "rgba(255,255,255,0.75)" }}>
          A builder community and bounty marketplace for the Injective ecosystem.
        </div>
      </div>
    ),
    size,
  );
}
