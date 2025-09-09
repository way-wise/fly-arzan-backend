import { prisma } from "./lib/prisma.js";

// --- Helpers ---
const toFloat = (v?: string) => (v && v.trim() !== "" ? parseFloat(v) : null);
const toInt = (v?: string) => (v && v.trim() !== "" ? parseInt(v) : null);
const toBigInt = (v?: string) => (v && v.trim() !== "" ? BigInt(v) : null);
const toBoolYes = (v?: string) => (v ? v.toLowerCase() === "yes" : false);
const norm = (s?: string | null) => (s ? s.trim() : null);
const normalizeCountry = (s: string) =>
  s
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[-_]/g, " ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
import { promises as fs } from "fs";
import path from "path";

function parseCSV(content: string): string[][] {
  const rows = content
    .replace(/\r/g, "")
    .split("\n")
    .filter((r) => r.trim().length > 0);
  return rows.map((row) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' && (i === 0 || row[i - 1] !== "\\")) {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map((v) => v.trim().replace(/^"|"$/g, ""));
  });
}

async function main() {
  console.log("Starting data import...");

  await prisma.airline.deleteMany({});
  await prisma.airport.deleteMany({});
  await prisma.city.deleteMany({});
  await prisma.region.deleteMany({});
  await prisma.country.deleteMany({});

  await importCountries();
  await importRegions();
  await importCitiesAndAirports();
  await importAirlines();

  console.log("Data import finished.");
}

async function importCountries() {
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "Airlines",
    "Data",
    "Countries Database",
    "countries.csv"
  );
  const fileContent = await fs.readFile(filePath, "utf-8");
  const rows = parseCSV(fileContent).slice(1);

  for (const columns of rows) {
    const [
      iso,
      iso3,
      isoNumeric,
      fips,
      name,
      capital,
      areaSqKm,
      population,
      continent,
      tld,
      currencyCode,
      currencyName,
      phoneCode,
      postalCodeFormat,
      postalCodeRegex,
      languages,
      geonameid,
      neighbours,
    ] = columns;

    if (iso) {
      await prisma.country.upsert({
        where: { iso },
        update: {},
        create: {
          iso,
          iso3,
          isoNumeric: toInt(isoNumeric || undefined),
          fips,
          name,
          capital,
          areaSqKm: toFloat(areaSqKm || undefined),
          population: toBigInt(population || undefined),
          continent,
          tld,
          currencyCode,
          currencyName,
          phoneCode,
          postalCodeFormat,
          postalCodeRegex,
          languages,
          geonameid: toInt(geonameid || undefined),
          neighbours,
        },
      });
    }
  }
  console.log("Countries imported.");
}

async function importRegions() {
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "Airlines",
    "Data",
    "Cities Database",
    "regions.csv"
  );
  const fileContent = await fs.readFile(filePath, "utf-8");
  const rows = parseCSV(fileContent).slice(1);

  for (const columns of rows) {
    const [
      id,
      code,
      localCode,
      name,
      continent,
      isoCountry,
      wikipediaLink,
      keywords,
    ] = columns;

    if (code && isoCountry) {
      const country = await prisma.country.findUnique({
        where: { iso: isoCountry },
      });
      if (country) {
        await prisma.region.upsert({
          where: { code },
          update: {},
          create: {
            code,
            localCode,
            name,
            continent,
            isoCountry,
            wikipediaLink,
            keywords,
          },
        });
      }
    }
  }
  console.log("Regions imported.");
}

async function importCitiesAndAirports() {
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "Airlines",
    "Data",
    "Airports Database",
    "airports.csv"
  );
  const fileContent = await fs.readFile(filePath, "utf-8");
  const rows = parseCSV(fileContent).slice(1);

  for (const columns of rows) {
    const [
      id,
      ident,
      type,
      name,
      latitudeDeg,
      longitudeDeg,
      elevationFt,
      continent,
      isoCountry,
      isoRegion,
      municipality,
      scheduledService,
      gpsCode,
      iataCode,
      localCode,
      homeLink,
      wikipediaLink,
      keywords,
    ] = columns;

    // Filter for relevant airports: only medium/large airports with an IATA code.
    const hasIata = iataCode && iataCode.trim() !== "";
    const isRelevantType =
      type === "medium_airport" || type === "large_airport";

    if (municipality && isoCountry && isoRegion && hasIata && isRelevantType) {
      const country = await prisma.country.findUnique({
        where: { iso: isoCountry },
      });
      const region = await prisma.region.findUnique({
        where: { code: isoRegion },
      });

      if (country && region) {
        let city = await prisma.city.findFirst({
          where: {
            name: municipality,
            countryIso: isoCountry,
            regionCode: isoRegion,
          },
        });

        if (!city) {
          city = await prisma.city.create({
            data: {
              name: municipality,
              countryIso: isoCountry,
              regionCode: isoRegion,
            },
          });
        }

        const gps = gpsCode?.trim();
        // Treat gps_code as ICAO when it looks like a 4-letter code
        const icao =
          gps && /^[A-Z0-9]{4}$/.test(gps) ? gps.toUpperCase() : null;
        const identCode = ident?.trim();
        const createData = {
          ident: identCode || null,
          type,
          name,
          latitudeDeg: toFloat(latitudeDeg || undefined),
          longitudeDeg: toFloat(longitudeDeg || undefined),
          elevationFt: toInt(elevationFt || undefined),
          continent,
          cityId: city.id,
          scheduledService: toBoolYes(scheduledService),
          icaoCode: icao,
          iataCode: iataCode?.trim().toUpperCase() || null,
          gpsCode: gps || null,
          localCode: localCode || null,
          homeLink: homeLink || null,
          wikipediaLink: wikipediaLink || null,
          keywords: keywords || null,
        } as const;

        if (icao) {
          await prisma.airport.upsert({
            where: { icaoCode: icao },
            update: {},
            create: createData as any,
          });
        } else if (identCode) {
          await prisma.airport.upsert({
            where: { ident: identCode },
            update: {},
            create: createData as any,
          });
        }
      }
    }
  }
  console.log("Cities and Airports imported.");
}

async function importAirlines() {
  const filePath = path.join(
    __dirname,
    "..",
    "..",
    "Airlines",
    "Data",
    "Airlines Database",
    "airline_iata_icao_codes.json"
  );
  const fileContent = await fs.readFile(filePath, "utf-8");
  const data = JSON.parse(fileContent);

  // Build a normalized lookup of countries from the DB to reduce brittle manual mappings
  const allCountries = await prisma.country.findMany({
    select: { iso: true, name: true },
  });
  // Some truly exceptional legacy names still need a small synonym map
  const synonyms: Record<string, string> = {
    "united states of america": "united states",
    "russian federation": "russia",
    "czech republic": "czechia",
    swaziland: "eswatini",
    macau: "macao",
    "timor-leste": "timor leste",
    "republic of the congo": "congo",
    "democratic republic of the congo": "congo, the democratic republic of",
    "the netherlands": "netherlands",
  };

  // Build maps: normalized country name -> country record
  const countryByNorm = new Map<string, { iso: string; name: string }>();
  for (const c of allCountries) {
    countryByNorm.set(normalizeCountry(c.name), c);
  }

  const resolveCountry = (
    rawName: string
  ): { iso: string; name: string } | null => {
    const n = normalizeCountry(rawName);
    if (countryByNorm.has(n)) return countryByNorm.get(n)!;
    const syn = synonyms[n];
    if (syn && countryByNorm.has(syn)) return countryByNorm.get(syn)!;
    // For Congo variants, try contains-based approach
    if (n.includes("congo")) {
      for (const [k, v] of countryByNorm.entries()) {
        if (
          k.includes("congo") &&
          n.includes("democratic") === k.includes("democratic")
        ) {
          return v;
        }
      }
    }
    // As a last resort, attempt startsWith match (helps with territories)
    for (const [k, v] of countryByNorm.entries()) {
      if (n.startsWith(k) || k.startsWith(n)) return v;
    }
    return null;
  };

  for (const countryName in data) {
    const airlines = data[countryName];
    const resolved = resolveCountry(countryName);
    console.log(
      `Processing country: ${countryName} -> ${
        resolved ? resolved.name : "NOT FOUND"
      }`
    );

    if (resolved && Array.isArray(airlines)) {
      console.log(`Resolved to country: ${resolved.name} (${resolved.iso})`);
      const country = resolved;
      {
        for (const raw of airlines) {
          const name: string | null = raw.name?.toString().trim() || null;
          const iata: string | null =
            (raw.IATA || raw.iata || null)?.toString().trim() || null;
          const icao: string | null =
            (raw.ICAO || raw.icao || null)?.toString().trim() || null;
          const website: string | null = raw.website?.toString().trim() || null;
          const notes: string | null = raw.notes?.toString().trim() || null;
          const isUpToDate: boolean = Boolean(
            raw.is_up_to_date ?? raw.isUpToDate ?? false
          );

          if (!name) continue;

          if (icao) {
            await prisma.airline.upsert({
              where: { icao },
              update: {
                name,
                iata,
                website,
                notes,
                isUpToDate,
                countryIso: country.iso,
              },
              create: {
                name,
                iata,
                icao,
                website,
                notes,
                isUpToDate,
                countryIso: country.iso,
              },
            });
          } else {
            // No ICAO: try to find by (country + iata) or (country + name)
            const existing = await prisma.airline.findFirst({
              where: {
                countryIso: country.iso,
                OR: [
                  iata
                    ? { iata: { equals: iata, mode: "insensitive" } }
                    : undefined,
                  { name: { equals: name, mode: "insensitive" } },
                ].filter(Boolean) as any,
              },
            });

            if (!existing) {
              await prisma.airline.create({
                data: {
                  name,
                  iata,
                  icao: null,
                  website,
                  notes,
                  isUpToDate,
                  countryIso: country.iso,
                },
              });
            } else {
              // Optionally update fields for completeness
              await prisma.airline.update({
                where: { id: existing.id },
                data: {
                  iata,
                  website,
                  notes,
                  isUpToDate,
                },
              });
            }
          }
        }
      }
    } else if (Array.isArray(airlines) && airlines.length > 0) {
      console.log(`Country not found in DB for mapping: ${countryName}`);
    }
  }
  console.log("Airlines imported.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
