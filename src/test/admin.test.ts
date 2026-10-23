// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PostManager } from "@/components/admin/PostManager";
import { getAdminBounties, getAdminHighlights, getAdminPosts, highlightPublishOptionFor, highlightTypeLabelKey, highlightTypeLabelKeys, postCategoryLabelKeys, publishOptionFor, type AdminPost } from "@/lib/admin";
import { HIGHLIGHT_TYPE_CODES } from "@/lib/api/codecs";
import { bounties } from "@/lib/bounties";
import { renderWithIntl } from "@/test/intl";
import en from "../../messages/en/admin.json";
import ko from "../../messages/ko/admin.json";
import zh from "../../messages/zh/admin.json";

describe("admin post publish option (PostManager → saveAdminPost)", () => {
  it("always sends `publish` on create, derived from the chosen status", () => {
    expect(publishOptionFor(undefined, "published", "create")).toEqual({ publish: true });
    expect(publishOptionFor(undefined, "draft", "create")).toEqual({ publish: false });
    expect(publishOptionFor("draft", "draft", "create")).toEqual({ publish: false });
  });

  it("omits `publish` on a plain edit and sends it only when the status toggled", () => {
    expect(publishOptionFor("published", "published", "edit")).toBeUndefined();
    expect(publishOptionFor("draft", "draft", "edit")).toBeUndefined();
    expect(publishOptionFor("draft", "published", "edit")).toEqual({ publish: true });
    expect(publishOptionFor("published", "draft", "edit")).toEqual({ publish: false });
    // The edited row was not in the loaded list (e.g. the list re-read failed): treat it as a toggle rather than guess.
    expect(publishOptionFor(undefined, "published", "edit")).toEqual({ publish: true });
  });

  it("applies the same contract to highlight `is_published` booleans", () => {
    expect(highlightPublishOptionFor(undefined, true, "create")).toEqual({ publish: true });
    expect(highlightPublishOptionFor(undefined, false, "create")).toEqual({ publish: false });
    expect(highlightPublishOptionFor(true, true, "edit")).toBeUndefined();
    expect(highlightPublishOptionFor(false, false, "edit")).toBeUndefined();
    expect(highlightPublishOptionFor(false, true, "edit")).toEqual({ publish: true });
    expect(highlightPublishOptionFor(true, false, "edit")).toEqual({ publish: false });
  });
});

const loadedPost: AdminPost = {
  slug: "launch-week",
  title: "Launch week",
  category: "Ninja Labs",
  status: "published",
  publishedAt: "2026-10-01",
  bodyMarkdown: "Body",
  thumbnail: null,
  externalUrl: null,
};
const adminApi = {
  getAdminPosts: vi.fn(async () => [loadedPost]),
  saveAdminPost: vi.fn(async () => ({ id: "post-1" })),
  uploadAdminMedia: vi.fn(),
  deleteAdminPost: vi.fn(),
};

vi.mock("@/components/auth/FoundationProvider", () => ({
  useAdminApi: () => adminApi,
}));

describe("PostManager publish option (render)", () => {
  beforeAll(() => {
    // jsdom has no <dialog> or scrollIntoView; the manager only needs them to exist.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
    HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  it("derives `publish` from the status of the loaded row, not the server-rendered prop", async () => {
    // The SSR prop is stale (draft); the client re-read says the post is already published.
    // `children` is a required prop of PostManager and this is a .ts file, so createElement must receive it as a prop.
    // eslint-disable-next-line react/no-children-prop
    renderWithIntl(createElement(PostManager, { posts: [{ ...loadedPost, status: "draft" }], children: null, tabs: null }));
    await waitFor(() => expect(adminApi.getAdminPosts).toHaveBeenCalled());
    // The row's status badge (not the "Published" column header) reflects the loaded row.
    await screen.findByText("Published", { selector: "span" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(adminApi.saveAdminPost).toHaveBeenCalledTimes(1));
    // published → published on edit: `publish` is omitted so the BE keeps published_at.
    expect(adminApi.saveAdminPost).toHaveBeenCalledWith(expect.objectContaining({ slug: "launch-week", status: "published" }), false, undefined);
  });
});

describe("admin bounty adapter", () => {
  it("maps iAsset price widget meta fields from the public registry", () => {
    const bounty = getAdminBounties().find(({ slug }) => slug === "iasset-price-widget");

    expect(bounty).toMatchObject({
      submissionGuide: "Submit everything reviewers need to run the widget without extra back-and-forth.\n\n- A public GitHub repository with build and test instructions\n- A preview URL demonstrating live, loading, and unavailable states\n- A README covering integration props and setup notes",
      deliverables: ["GitHub repository", "Preview URL", "README with integration notes"],
      reviewProcess: "Ninja Labs triage followed by Injective sponsor approval.",
    });
  });

  it("uses empty values for absent submission guides and deliverables", () => {
    const registryBounty = bounties.find(({ slug }) => slug === "design-system-build");
    expect(registryBounty).toBeDefined();

    const deliverables = registryBounty!.deliverables;
    const submissionGuideMarkdown = registryBounty!.submissionGuideMarkdown;
    delete registryBounty!.deliverables;
    delete registryBounty!.submissionGuideMarkdown;

    try {
      const bounty = getAdminBounties().find(({ slug }) => slug === "design-system-build");
      expect(bounty).toMatchObject({ deliverables: [], submissionGuide: "" });
    } finally {
      if (deliverables === undefined) {
        delete registryBounty!.deliverables;
      } else {
        registryBounty!.deliverables = deliverables;
      }
      if (submissionGuideMarkdown === undefined) {
        delete registryBounty!.submissionGuideMarkdown;
      } else {
        registryBounty!.submissionGuideMarkdown = submissionGuideMarkdown;
      }
    }
  });

  it("isolates returned reward and deliverables from the public registry", () => {
    const registryBounty = bounties.find(({ slug }) => slug === "iasset-price-widget");
    const bounty = getAdminBounties().find(({ slug }) => slug === "iasset-price-widget");
    expect(registryBounty).toBeDefined();
    expect(bounty).toBeDefined();

    expect(bounty!.reward).not.toBe(registryBounty!.reward);
    expect(bounty!.deliverables).not.toBe(registryBounty!.deliverables);

    bounty!.reward.amount = 0;
    bounty!.deliverables.push("Mutated admin deliverable");

    expect(registryBounty!.reward.amount).toBe(500);
    expect(registryBounty!.deliverables).toEqual(["GitHub repository", "Preview URL", "README with integration notes"]);
  });
});

describe("admin label keys", () => {
  it.each([["en", en], ["ko", ko], ["zh", zh]] as const)("resolve every highlight type and post category in %s", (_locale, messages) => {
    for (const { type } of getAdminHighlights()) {
      expect(messages.hallOfFame.highlights.types).toHaveProperty(highlightTypeLabelKey(type) ?? "missing");
    }
    // All six BE HIGHLIGHT_TYPES have a label; an unknown code has none (the UI shows the raw code).
    expect(HIGHLIGHT_TYPE_CODES).toEqual(["MILESTONE", "FEATURED_BOUNTY", "PROJECT", "PARTNERSHIP", "AWARD", "OTHER"]);
    for (const code of HIGHLIGHT_TYPE_CODES) {
      expect(messages.hallOfFame.highlights.types).toHaveProperty(highlightTypeLabelKeys[code]);
    }
    expect(highlightTypeLabelKey("FUTURE_TYPE")).toBeNull();
    for (const { category } of getAdminPosts()) {
      expect(messages.notices.categories).toHaveProperty(postCategoryLabelKeys[category]);
    }
    for (const key of Object.values(postCategoryLabelKeys)) {
      expect(messages.notices.categories).toHaveProperty(key);
    }
  });
});

describe("admin bounty fixtures", () => {
  it("shows intake ON exactly for bounties that require an application", () => {
    const publicBounties = new Map(bounties.map((bounty) => [bounty.slug, bounty]));
    for (const adminBounty of getAdminBounties()) {
      expect(adminBounty.intakeEnabled).toBe(publicBounties.get(adminBounty.slug)?.applicationRequired ?? false);
    }
  });
});
