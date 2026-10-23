import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Browsers request /favicon.ico unprompted; the proxy matcher skips `.ico`, so without this handler the path fell
// through to the [locale] route (locale = "favicon.ico") and answered 404. Serve the same PNG as the `icon.png`
// metadata file (browsers sniff the content type) with a long cache life; the bytes are read once per server instance.
let iconBytes: Promise<ArrayBuffer> | null = null;

export const dynamic = "force-static";

export async function GET() {
  iconBytes ??= readFile(join(process.cwd(), "src/app/icon.png")).then(
    (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  return new Response(await iconBytes, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
