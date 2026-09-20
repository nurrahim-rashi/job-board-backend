import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocodeCoordinates } from "../services/region.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reverse geocoding", () => {
  it("accepts a valid country and city even when the provider omits state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            features: [
              {
                properties: {
                  type: "city",
                  name: "Singapore",
                  city: "Singapore",
                  country: "Singapore",
                  countrycode: "SG",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(reverseGeocodeCoordinates(1.3521, 103.8198)).resolves.toEqual({
      city: "Singapore",
      province: "Singapore",
      country: "Singapore",
      countryCode: "SG",
    });
  });

  it("falls back to Nominatim when Photon is unavailable", async () => {
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

    await expect(reverseGeocodeCoordinates(-6.2, 106.8166)).resolves.toEqual({
      city: "Jakarta",
      province: "DKI Jakarta",
      country: "Indonesia",
      countryCode: "ID",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses Indonesian regency and province instead of a district", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            features: [
              {
                properties: {
                  type: "city",
                  city: "Padalarang",
                  county: "Kabupaten Bandung Barat",
                  state: "Java",
                  country: "Indonesia",
                  countrycode: "ID",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            address: {
              town: "Padalarang",
              county: "Kabupaten Bandung Barat",
              state: "Jawa Barat",
              country: "Indonesia",
              country_code: "id",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(reverseGeocodeCoordinates(-6.84, 107.47)).resolves.toEqual({
      city: "Kabupaten Bandung Barat",
      province: "Jawa Barat",
      country: "Indonesia",
      countryCode: "ID",
    });
  });
});
