import { afterEach, describe, expect, it, vi } from "vitest";
import { getEducationOptions } from "../services/education.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("institution suggestions", () => {
  it("searches OpenAlex after two characters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { display_name: "Universitas Indonesia" },
            { display_name: "Universitas Indonesia" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getEducationOptions("institutions", "Universitas Indo", "Indonesia"),
    ).resolves.toEqual(["Universitas Indonesia"]);
    expect(
      new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("search"),
    ).toBe("Universitas Indo");
  });

  it("uses the country-aware fallback when OpenAlex has no matches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ name: "Institut Teknologi Bandung" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getEducationOptions("institutions", "Institut Teknologi", "Indonesia"),
    ).resolves.toEqual(["Institut Teknologi Bandung"]);
    const fallbackUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(fallbackUrl.searchParams.get("country")).toBe("Indonesia");
  });

  it("does not call a provider before two characters", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getEducationOptions("institutions", "U")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
