import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { loadNamespace } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageParams = { locale: string };
type OgCopy = { alt: string; headline: string; highlight: string; tagline: string };

// Copy comes from messages/<locale>/common.json `site.og`. The JSON is read directly because this route is collected at
// build time (like generateStaticParams), where next-intl's request-bound `getTranslations` has no headers() to read.
async function ogCopy(requested: string): Promise<OgCopy> {
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const common = await loadNamespace(locale, "common");
  return (common.site as { og: OgCopy }).og;
}

// `alt` is localized per locale through generateImageMetadata (a static `export const alt` cannot read the locale).
export async function generateImageMetadata({ params }: { params: ImageParams | Promise<ImageParams> }) {
  const { locale } = await params;
  const { alt } = await ogCopy(locale);
  return [{ id: "social", alt, size, contentType }];
}

// ImageResponse (Satori) cannot resolve CSS custom properties, so the brand
// tokens from globals.css are inlined verbatim here:
// --color-hero-from #0C1528 · --color-hero-via #1D2B60 · --color-hero-to #4D3DFF
// --color-glow #7B6CFF · --color-accent-soft #9A90FF · --color-primary-outline #C3BEFF
export default async function Image({ params }: { params: Promise<ImageParams> }) {
  const { locale } = await params;
  const t = await ogCopy(locale);
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
          <span>{t.headline}</span>
          <span style={{ color: "#9A90FF" }}>{t.highlight}</span>
        </div>
        <div style={{ marginTop: "40px", fontSize: 30, color: "rgba(255,255,255,0.75)" }}>
          {t.tagline}
        </div>
      </div>
    ),
    size,
  );
}
