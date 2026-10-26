import { beforeEach, describe, expect, it, vi } from "vitest";

// A layout's notFound() renders the [locale] boundary WITHOUT the page's generateMetadata, so each detail layout needs its
// own not-found title (bounties did already). Otherwise an unknown member/notice 404 carries the site's home title.
const state = vi.hoisted(() => ({ profile: undefined as unknown, notice: undefined as unknown }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("@/lib/runtime/config", () => ({ loadRuntimeConfig: () => ({ runtimeMode: "api" }) }));
vi.mock("@/lib/members", () => ({ getRuntimeProfile: async () => state.profile }));
vi.mock("@/lib/notices", () => ({ getRuntimeNotice: async () => state.notice }));

const members = await import("@/app/[locale]/members/[id]/layout");
const notices = await import("@/app/[locale]/notices/[id]/layout");

const uuid = "4f2c3f0e-9d2a-4a5b-8c6d-1e2f3a4b5c6d";
const args = (id: string) => ({ params: Promise.resolve({ locale: "en", id }) }) as never;

beforeEach(() => {
  state.profile = undefined;
  state.notice = undefined;
});

describe("detail layouts: metadata for ids that end in notFound()", () => {
  it("member: unknown nickname and malformed id get the not-found title", async () => {
    expect(await members.generateMetadata(args("nobodyhere"))).toEqual({ alternates: {}, title: "members.profile.notFoundTitle" });
    expect(await members.generateMetadata(args("%00"))).toEqual({ alternates: {}, title: "members.profile.notFoundTitle" });
  });
  it("member: a found profile leaves the title to the page", async () => {
    state.profile = { slug: "builderone" };
    expect(await members.generateMetadata(args("builderone"))).toEqual({});
  });
  it("notice: unknown id gets the not-found title, a found one leaves it to the page", async () => {
    expect(await notices.generateMetadata(args(uuid))).toEqual({ alternates: {}, title: "notices.detail.notFoundTitle" });
    state.notice = { slug: uuid };
    expect(await notices.generateMetadata(args(uuid))).toEqual({});
  });
});
