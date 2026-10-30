// Dependency-free hook so the vitest setup file can reset the per-tab foundation cache without importing
// FoundationProvider (which would load the real runtime config before a test file's vi.mock calls apply).
let reset: (() => void) | null = null;

export function registerTabFoundationReset(fn: () => void): void {
  reset = fn;
}

export function runTabFoundationReset(): void {
  reset?.();
}
