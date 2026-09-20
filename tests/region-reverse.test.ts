import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStateCities,
  provinceSearchNames,
  reverseGeocodeCoordinates,
} from "../services/region.service.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reverse geocoding", () => {
  it("treats Indonesian and English province names as equivalent", () => {
    expect(provinceSearchNames("Jawa Barat")).toEqual([
      "Jawa Barat",
      "west java",
    ]);
    expect(provinceSearchNames("West Java")).toEqual([
      "West Java",
      "Jawa Barat",
    ]);
    expect(provinceSearchNames("Jawa")).toEqual([
      "Jawa Barat",
      "west java",
    ]);
  });

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

  it("uses the Indonesian regency instead of a district as the city", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            features: [
              {
                properties: {
                  type: "city",
                  name: "Padalarang",
                  city: "Padalarang",
                  county: "West Bandung Regency",
                  state: "West Java",
                  country: "Indonesia",
                  countrycode: "ID",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      reverseGeocodeCoordinates(-6.8738, 107.4694),
    ).resolves.toEqual({
      city: "Kabupaten Bandung Barat",
      province: "Jawa Barat",
      country: "Indonesia",
      countryCode: "ID",
    });
  });

  it("maps Jawa to Jawa Barat and loads Indonesian regencies locally", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { code: "31", name: "DKI Jakarta" },
              { code: "32", name: "Jawa Barat" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { code: "32.73", name: "Kota Bandung" },
              { code: "32.17", name: "Kabupaten Bandung Barat" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getStateCities("Indonesia", "Jawa")).resolves.toEqual([
      { code: "32.17", name: "Kabupaten Bandung Barat" },
      { code: "32.73", name: "Kota Bandung" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/regencies/32.json",
    );
  });
});
