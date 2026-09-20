const degrees = [
  "Elementary School",
  "Middle School",
  "High School",
  "Vocational High School",
  "Diploma",
  "Associate Degree",
  "Bachelor",
  "Master",
  "Doctorate",
  "Other",
];

const filterOptions = (options: string[], query: string) => {
  const normalized = query.trim().toLocaleLowerCase("en");
  return options
    .filter(
      (option) =>
        !normalized || option.toLocaleLowerCase("en").includes(normalized),
    )
    .slice(0, 20);
};

const WIKIDATA_ACADEMIC_DISCIPLINE_ID = "Q11862829";

type WikidataSearchItem = { id?: string };
type WikidataClaim = {
  mainsnak?: { datavalue?: { value?: { id?: string } } };
};
type WikidataEntity = {
  labels?: { en?: { value?: string } };
  claims?: { P31?: WikidataClaim[] };
};

function formatMajorLabel(value: string) {
  const minorWords = new Set(["and", "of", "in", "for", "to"]);
  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && minorWords.has(word.toLocaleLowerCase("en")))
        return word.toLocaleLowerCase("en");
      if (/^[A-Z0-9&.]{2,5}$/.test(word)) return word;
      return `${word.charAt(0).toLocaleUpperCase("en")}${word.slice(1)}`;
    })
    .join(" ");
}

async function searchMajors(query: string) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const searchParams = new URLSearchParams({
    action: "wbsearchentities",
    search: normalizedQuery,
    language: "en",
    uselang: "en",
    type: "item",
    limit: "30",
    format: "json",
    origin: "*",
  });
  const searchResponse = await fetch(
    `https://www.wikidata.org/w/api.php?${searchParams.toString()}`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "PolarisJobs/1.0 (education major autocomplete)",
      },
    },
  );
  if (!searchResponse.ok)
    throw new Error(`Wikidata search returned ${searchResponse.status}`);

  const searchPayload = (await searchResponse.json()) as {
    search?: WikidataSearchItem[];
  };
  const ids = (searchPayload.search ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const entityParams = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "claims|labels",
    languages: "en",
    format: "json",
    origin: "*",
  });
  const entityResponse = await fetch(
    `https://www.wikidata.org/w/api.php?${entityParams.toString()}`,
    {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        "User-Agent": "PolarisJobs/1.0 (education major autocomplete)",
      },
    },
  );
  if (!entityResponse.ok)
    throw new Error(`Wikidata entities returned ${entityResponse.status}`);

  const entityPayload = (await entityResponse.json()) as {
    entities?: Record<string, WikidataEntity>;
  };
  const entities = entityPayload.entities ?? {};
  const labels = ids
    .map((id) => entities[id])
    .filter((entity) =>
      entity?.claims?.P31?.some(
        (claim) =>
          claim.mainsnak?.datavalue?.value?.id ===
          WIKIDATA_ACADEMIC_DISCIPLINE_ID,
      ),
    )
    .map((entity) => entity.labels?.en?.value?.trim())
    .filter((label): label is string => Boolean(label))
    .map(formatMajorLabel);

  return [
    ...new Map(
      labels.map((label) => [label.toLocaleLowerCase("en"), label]),
    ).values(),
  ]
    .sort((left, right) => {
      const queryLower = normalizedQuery.toLocaleLowerCase("en");
      const leftLower = left.toLocaleLowerCase("en");
      const rightLower = right.toLocaleLowerCase("en");
      const leftScore =
        leftLower === queryLower ? 0 : leftLower.startsWith(queryLower) ? 1 : 2;
      const rightScore =
        rightLower === queryLower
          ? 0
          : rightLower.startsWith(queryLower)
            ? 1
            : 2;
      return leftScore - rightScore || left.localeCompare(right);
    })
    .slice(0, 20);
}

export async function getEducationOptions(
  kind: "degrees" | "majors" | "institutions",
  query: string,
  country?: string,
) {
  if (kind === "degrees") return filterOptions(degrees, query);
  if (kind === "majors") {
    try {
      return await searchMajors(query);
    } catch (error) {
      console.warn("Wikidata major suggestions are unavailable", error);
      return [];
    }
  }
  const institutionQuery = query.trim();
  if (institutionQuery.length < 2) return [];
  try {
      const openAlexParams = new URLSearchParams({
        search: institutionQuery,
        "per-page": "15",
        select: "display_name",
      });
      if (process.env.OPENALEX_MAILTO)
        openAlexParams.set("mailto", process.env.OPENALEX_MAILTO);
      const openAlexResponse = await fetch(
        `https://api.openalex.org/institutions?${openAlexParams.toString()}`,
        {
          signal: AbortSignal.timeout(6_000),
          headers: { Accept: "application/json" },
        },
      );
      if (!openAlexResponse.ok)
        throw new Error(`OpenAlex returned ${openAlexResponse.status}`);
      const openAlexPayload = (await openAlexResponse.json()) as {
        results?: Array<{ display_name?: string }>;
      };
      const names = (openAlexPayload.results ?? [])
        .map((item) => item.display_name?.trim())
        .filter((name): name is string => Boolean(name));
      const uniqueNames = [...new Set(names)].slice(0, 20);
      if (uniqueNames.length) return uniqueNames;
      throw new Error("OpenAlex returned no matching institutions");
    } catch (error) {
      console.warn("OpenAlex institution suggestions are unavailable", error);
      try {
        const params = new URLSearchParams({ name: institutionQuery });
        if (country?.trim()) params.set("country", country.trim());
        const response = await fetch(
          `https://universities.hipolabs.com/search?${params.toString()}`,
          {
            signal: AbortSignal.timeout(6_000),
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok)
          throw new Error(`University API returned ${response.status}`);
        const payload = (await response.json()) as Array<{ name?: string }>;
        return [
          ...new Set(
            payload
              .map((item) => item.name?.trim())
              .filter((name): name is string => Boolean(name)),
          ),
        ].slice(0, 20);
      } catch (fallbackError) {
        console.warn(
          "University fallback suggestions are unavailable",
          fallbackError,
        );
      }
    }
  return [];
}
