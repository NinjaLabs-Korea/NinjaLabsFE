import { describe, expect, it } from "vitest";
import enCommon from "../../messages/en/common.json";
import koCommon from "../../messages/ko/common.json";
import zhCommon from "../../messages/zh/common.json";
import enMembers from "../../messages/en/members.json";
import koMembers from "../../messages/ko/members.json";
import zhMembers from "../../messages/zh/members.json";
import enHall from "../../messages/en/hallOfFame.json";
import koHall from "../../messages/ko/hallOfFame.json";
import zhHall from "../../messages/zh/hallOfFame.json";
import enNotices from "../../messages/en/notices.json";
import koNotices from "../../messages/ko/notices.json";
import zhNotices from "../../messages/zh/notices.json";

const locales = [
  ["ko", koCommon, koMembers, koHall, koNotices],
  ["en", enCommon, enMembers, enHall, enNotices],
  ["zh", zhCommon, zhMembers, zhHall, zhNotices],
] as const;

describe.each(locales)("night polish r2 copy (%s)", (locale, common, members, hall, notices) => {
  it("has no public badge key in members, hall of fame or notices", () => {
    const keys = (value: unknown, path = ""): string[] =>
      value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => [path + k, ...keys(v, `${path}${k}.`)]) : [];
    for (const messages of [members, hall, notices]) expect(keys(messages).filter((k) => /(^|\.)(public|shareable)$/.test(k))).toEqual([]);
  });

  it("explains no parent/child NFT in the profile portfolio", () => {
    const text = JSON.stringify(members.profile.portfolio);
    expect(text).not.toMatch(/부모|자식|parent|child|父|子 NFT/i);
    expect(members.profile.portfolio).not.toHaveProperty("next");
    expect(members.profile.portfolio).not.toHaveProperty("emptyTitle");
    expect(members.profile.history).not.toHaveProperty("viewFilled");
  });

  it("keeps the notice read-more heading and link different", () => {
    expect(notices.detail.readMoreHeading).not.toBe(notices.detail.readMoreLink);
  });

  it("offers start and notices on the 404 and start on the error page", () => {
    expect(common.notFound).not.toHaveProperty("browseBounties");
    expect(common.notFound.notices).toBeTruthy();
    expect(common.errorPage.home).toBe(common.notFound.home);
  });

  it("makes the footer legal line the copyright only", () => {
    expect(common.footer.legal).toBe("© 2026 Ninja Labs");
  });

  it("never calls the members list a team", () => {
    expect(members.list.heading).not.toMatch(/team|团队|팀/i);
  });
});
