import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetTabFoundationForTests } from "@/components/auth/FoundationProvider";

afterEach(() => {
  cleanup();
  // The provider caches one foundation per tab; never let a test leak its adapter into the next one.
  resetTabFoundationForTests();
});
