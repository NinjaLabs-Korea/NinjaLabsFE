import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { runTabFoundationReset } from "@/lib/tab-foundation-reset";

afterEach(() => {
  cleanup();
  // The provider caches one foundation per tab; never let a test leak its adapter into the next one.
  runTabFoundationReset();
});
