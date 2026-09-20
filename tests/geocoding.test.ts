import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeLocation } from "../services/geocoding.service.js";
import { reverseGeocodeCoordinates } from "../services/region.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("two-way geocoding", () => {
  it("uses city, province, and country for forward geocoding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ lat: "-6.2", lon: "106.8" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      geocodeLocation("Central Jakarta test", "Indonesia", "DKI Jakarta"),
    ).resolves.toEqual({ latitude: "-6.2", longitude: "106.8" });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("q")).toBe(
      "Central Jakarta test, DKI Jakarta, Indonesia",
    );
  });

  it("falls back to Nominatim when Photon reverse geocoding fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            address: {
              city: "Jakarta",
              state: "Jakarta Special Capital Region",
              country: "Indonesia",
              country_code: "id",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(reverseGeocodeCoordinates(-6.2001, 106.8001)).resolves.toEqual({
      city: "Jakarta",
      province: "DKI Jakarta",
      country: "Indonesia",
      countryCode: "ID",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
