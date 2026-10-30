// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroTitle } from "@/components/ui/HeroTitle";

const text = (children: string) => render(<HeroTitle highlight="Build">{children}</HeroTitle>).container.querySelector("h1")?.textContent;

describe("HeroTitle", () => {
  it("adds no ASCII space after fullwidth punctuation", () => {
    expect(text("在 Injective 上一起学习，")).toBe("在 Injective 上一起学习，Build");
    expect(text("学习。")).toBe("学习。Build");
  });

  it("keeps the space after Latin and Hangul text", () => {
    expect(text("Learn,")).toBe("Learn, Build");
    expect(text("함께 배우고")).toBe("함께 배우고 Build");
  });
});
