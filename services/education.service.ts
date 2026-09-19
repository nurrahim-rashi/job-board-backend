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

const majors = [
  "Accounting", "Architecture", "Business Administration", "Chemical Engineering",
  "Civil Engineering", "Communication", "Computer Engineering", "Computer Science",
  "Data Science", "Design", "Economics", "Education", "Electrical Engineering",
  "Finance", "Information Systems", "International Relations", "Law", "Management",
  "Marketing", "Mathematics", "Mechanical Engineering", "Medicine", "Nursing",
  "Pharmacy", "Physics", "Political Science", "Psychology", "Public Health",
  "Software Engineering", "Statistics",
];

const fallbackInstitutions = [
  "Bandung Institute of Technology",
  "Gadjah Mada University",
  "Institut Teknologi Sepuluh Nopember",
  "University of Indonesia",
  "Universitas Airlangga",
  "Universitas Brawijaya",
  "Universitas Diponegoro",
  "Universitas Padjadjaran",
];

const filterOptions = (options: string[], query: string) => {
  const normalized = query.trim().toLocaleLowerCase("en");
  return options
    .filter((option) => !normalized || option.toLocaleLowerCase("en").includes(normalized))
    .slice(0, 20);
};

export async function getEducationOptions(
  kind: "degrees" | "majors" | "institutions",
  query: string,
  country?: string,
) {
  if (kind === "degrees") return filterOptions(degrees, query);
  if (kind === "majors") return filterOptions(majors, query);
  if (query.trim().length < 2) return filterOptions(fallbackInstitutions, query);

  try {
    const openAlexParams = new URLSearchParams({
      search: query.trim(),
      "per-page": "15",
      select: "display_name,country_code,type",
    });
    if (process.env.OPENALEX_MAILTO)
      openAlexParams.set("mailto", process.env.OPENALEX_MAILTO);
    const openAlexResponse = await fetch(
      `https://api.openalex.org/institutions?${openAlexParams.toString()}`,
      { signal: AbortSignal.timeout(6_000), headers: { Accept: "application/json" } },
    );
    if (!openAlexResponse.ok)
      throw new Error(`OpenAlex returned ${openAlexResponse.status}`);
    const openAlexPayload = (await openAlexResponse.json()) as {
      results?: Array<{ display_name?: string }>;
    };
    const names = (openAlexPayload.results ?? [])
      .map((item) => item.display_name?.trim())
      .filter((name): name is string => Boolean(name));
    return [...new Set(names)].slice(0, 20);
  } catch (error) {
    console.warn("OpenAlex institution suggestions are unavailable", error);
    try {
      const params = new URLSearchParams({ name: query.trim() });
      if (country?.trim()) params.set("country", country.trim());
      const response = await fetch(
        `https://universities.hipolabs.com/search?${params.toString()}`,
        { signal: AbortSignal.timeout(6_000), headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(`University API returned ${response.status}`);
      const payload = (await response.json()) as Array<{ name?: string }>;
      return [...new Set(payload.map((item) => item.name?.trim()).filter((name): name is string => Boolean(name)))]
        .slice(0, 20);
    } catch (fallbackError) {
      console.warn("University fallback suggestions are unavailable", fallbackError);
      return filterOptions(fallbackInstitutions, query);
    }
  }
}
