// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { validateHighlightForm } from "@/components/admin/HighlightManager";
import { validatePostForm } from "@/components/admin/PostManager";
import { isSafeUrl } from "@/lib/url-rules";

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
    // BE CreateNoticeDto.body @MaxLength(50 000)
    expect(validatePostForm({ ...valid, bodyMarkdown: "a".repeat(50_001) })).toEqual({ bodyMarkdown: "tooLong" });
    expect(validatePostForm({ ...valid, bodyMarkdown: "a".repeat(50_000) })).toEqual({});
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

describe("legacy stored URLs on edit (the BE PATCH rule is the lenient IsSafeUrl)", () => {
  it("lets a highlight keep the legacy image and link it already stores, but still checks a changed one", () => {
    const form = { title: "First payout", description: "500 INJ paid", image: "/uploads/x.png", link: "cdn.example/blog", order: 0 };
    expect(validateHighlightForm(form).image).toBe("urlInvalid");
    expect(validateHighlightForm(form).link).toBe("urlInvalid");
    expect(validateHighlightForm(form, { image: "/uploads/x.png", link: "cdn.example/blog" })).toEqual({});
    expect(validateHighlightForm({ ...form, image: "/uploads/y.png" }, { image: "/uploads/x.png", link: "cdn.example/blog" }).image).toBe("urlInvalid");
  });

  it("lets a notice keep the legacy thumbnail and external link it already stores, but still checks a changed one", () => {
    const form = { title: "Batch shipped", bodyMarkdown: "Body", thumbnail: "/uploads/t.png", externalUrl: "injective.com/blog" };
    expect(validatePostForm(form)).toEqual({ thumbnail: "urlInvalid", externalUrl: "urlInvalid" });
    expect(validatePostForm(form, { thumbnail: "/uploads/t.png", externalUrl: "injective.com/blog" })).toEqual({});
    // A stored value the relaxed BE rule would refuse as well is still reported.
    expect(validatePostForm({ ...form, thumbnail: "not a url" }, { thumbnail: "not a url", externalUrl: "injective.com/blog" })).toEqual({ thumbnail: "urlInvalid" });
    expect(validatePostForm({ ...form, externalUrl: "injective.com/other" }, { thumbnail: "/uploads/t.png", externalUrl: "injective.com/blog" })).toEqual({ externalUrl: "urlInvalid" });
  });
});

describe("isSafeUrl (mirror of the BE relaxed PATCH rule)", () => {
  it("accepts http(s) URLs, single-slash paths and bare hosts", () => {
    for (const value of ["https://cdn.example/x.png", "/uploads/x.png", "/bounties/x", "cdn.example/x.png", "www.injective.com/blog"]) expect(isSafeUrl(value)).toBe(true);
  });

  it("rejects other schemes, protocol-relative URLs, userinfo, whitespace and control characters", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,x", "//evil.com/x", "/\\evil.com", "https://u:p@host.com", "https://evil.com\\.example.com", "https://a.com/x y", "/a\u0000b", "not a url", "localhost:3000", ""]) expect(isSafeUrl(value)).toBe(false);
  });
});
