import { Inter, Space_Grotesk } from "next/font/google";

// Single instantiation of the app fonts. AppShell, the root not-found and global-error all import these, so Next emits
// ONE font CSS module. Separate `Inter(...)` calls per file produced duplicate @font-face chunks that were preloaded
// but never used (console warning on every page). Do not call next/font/google anywhere else.
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
