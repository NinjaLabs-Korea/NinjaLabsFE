import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { runTabFoundationReset } from "@/lib/tab-foundation-reset";

afterEach(() => {
  cleanup();
  // The provider caches one foundation per tab; never let a test leak its adapter into the next one.
  runTabFoundationReset();
});

// jsdom has no <dialog> modal API. LocaleSwitcher always mounts a ConfirmDialog, whose Modal calls close() on mount.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (!proto.showModal) proto.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  if (!proto.close) proto.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
}
