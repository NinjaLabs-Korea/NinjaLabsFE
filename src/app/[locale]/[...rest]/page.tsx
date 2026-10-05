import { notFound } from "next/navigation";

// Unknown paths under a valid locale render the localized app/[locale]/not-found.tsx.
export default function CatchAll() {
  notFound();
}
