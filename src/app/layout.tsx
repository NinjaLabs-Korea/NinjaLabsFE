import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { FoundationProvider } from "@/components/auth/FoundationProvider";
import { previewUser } from "@/lib/mocks/fixtures";
import { composeFoundationRuntime, loadRuntimeConfig } from "@/lib/runtime/config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  metadataBase: new URL(loadRuntimeConfig().origin),
  title: "Ninja Labs — Build. Complete. Own your track record.",
  description:
    "A builder community and bounty marketplace for the Injective ecosystem. Every task you finish mints an on-chain NFT — together they become a portfolio you truly own.",
  openGraph: {
    title: "Ninja Labs — Build. Complete. Own your track record.",
    description:
      "A builder community and bounty marketplace for the Injective ecosystem. Every task you finish mints an on-chain NFT — together they become a portfolio you truly own.",
    siteName: "Ninja Labs",
    type: "website",
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ninja Labs — Build. Complete. Own your track record.",
    description:
      "A builder community and bounty marketplace for the Injective ecosystem. Every task you finish mints an on-chain NFT — together they become a portfolio you truly own.",
  },
};
const { foundationConfig } = composeFoundationRuntime(previewUser);


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="bg-page text-ink font-sans antialiased min-h-dvh flex flex-col">
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-inverse"
          href="#main-content"
        >
          Skip to content
        </a>
        <FoundationProvider config={foundationConfig}>
          <Header />
          <main className="flex-1" id="main-content">{children}</main>
          <Footer />
        </FoundationProvider>
      </body>
    </html>
  );
}
