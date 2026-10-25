// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { validateHighlightForm } from "@/components/admin/HighlightManager";
import { validatePostForm } from "@/components/admin/PostManager";

const mediaPath = "/media/11111111-1111-4111-8111-111111111111";

describe("admin highlight form validation (mirror of BE CreateHighlightDto)", () => {
  const valid = { title: "First payout", description: "500 INJ paid", image: mediaPath, link: "/bounties/helix-volume-analytics", order: 0 };

  it("accepts a complete form with a /media/ image and a site-path link", () => {
    expect(validateHighlightForm(valid)).toEqual({});
    expect(validateHighlightForm({ ...valid, link: "https://injective.com/x", image: "https://cdn.example/x.png" })).toEqual({});
    expect(validateHighlightForm({ ...valid, link: "", image: null })).toEqual({});
  });

  it("requires a non-blank title and description after trim", () => {
    expect(validateHighlightForm({ ...valid, title: "   ", description: " \n " })).toEqual({ title: "required", description: "required" });
  });

  it("applies IsHttpUrlOrSitePath to the link and IsHttpUrlOrMediaPath to the image", () => {
    expect(validateHighlightForm({ ...valid, link: "//evil.com/x" }).link).toBe("urlInvalid");
    expect(validateHighlightForm({ ...valid, link: "javascript:alert(1)" }).link).toBe("urlInvalid");
    expect(validateHighlightForm({ ...valid, link: "/bounties/../admin" }).link).toBe("urlInvalid");
    expect(validateHighlightForm({ ...valid, image: "/bounties/x" }).image).toBe("urlInvalid");
    expect(validateHighlightForm({ ...valid, image: "/media/not-a-uuid" }).image).toBe("urlInvalid");
  });
});

describe("admin highlight display order (mirror of BE @IsInt @Min(0) @MaxPgInt)", () => {
  const valid = { title: "First payout", description: "500 INJ paid", image: null, link: "", order: 0 };

  it("accepts whole numbers from 0 to the Postgres INTEGER ceiling", () => {
    expect(validateHighlightForm({ ...valid, order: 0 })).toEqual({});
    expect(validateHighlightForm({ ...valid, order: 2_147_483_647 })).toEqual({});
  });

  it.each([-1, 1.5, 2_147_483_648, Number.NaN])("rejects %s, which the BE would answer with a 400", (order) => {
    expect(validateHighlightForm({ ...valid, order }).order).toBe("orderInvalid");
  });
});

describe("admin post form validation (mirror of BE CreateNoticeDto)", () => {
  const valid = { title: "Batch shipped", bodyMarkdown: "Body", thumbnail: mediaPath, externalUrl: "https://injective.com/blog" };

  it("accepts a complete form and an empty external link", () => {
    expect(validatePostForm(valid)).toEqual({});
    expect(validatePostForm({ ...valid, externalUrl: null, thumbnail: null })).toEqual({});
  });

  it("requires a title and body", () => {
    expect(validatePostForm({ ...valid, title: " ", bodyMarkdown: "" })).toEqual({ title: "required", bodyMarkdown: "required" });
  });

  it("applies IsHttpUrl to the external link (no site paths) and IsHttpUrlOrMediaPath to the thumbnail", () => {
    expect(validatePostForm({ ...valid, externalUrl: "/notices/1" }).externalUrl).toBe("urlInvalid");
    expect(validatePostForm({ ...valid, externalUrl: "injective.com" }).externalUrl).toBe("urlInvalid");
    expect(validatePostForm({ ...valid, externalUrl: "https://user:pw@injective.com" }).externalUrl).toBe("urlInvalid");
    expect(validatePostForm({ ...valid, thumbnail: "/notices/1" }).thumbnail).toBe("urlInvalid");
    expect(validatePostForm({ ...valid, thumbnail: "https://cdn.example/t.png" })).toEqual({});
  });
});
