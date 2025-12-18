import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";

const app = new Hono();

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest airport to given coordinates
 */
async function findNearestAirport(lat: number, lon: number) {
  try {
    const airports = await prisma.airport.findMany({
      where: {
        latitudeDeg: { not: null },
        longitudeDeg: { not: null },
        iataCode: { not: null },
        type: { in: ["large_airport", "medium_airport"] },
      },
      select: {
        name: true,
        iataCode: true,
        latitudeDeg: true,
        longitudeDeg: true,
        city: {
          select: {
            name: true,
            country: { select: { name: true, iso: true } },
          },
        },
      },
    });

    let nearest: (typeof airports)[0] | null = null;
    let minDistance = Infinity;

    for (const airport of airports) {
      if (airport.latitudeDeg && airport.longitudeDeg) {
        const distance = haversineDistance(
          lat,
          lon,
          airport.latitudeDeg,
          airport.longitudeDeg
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = airport;
        }
      }
    }

    if (!nearest) return null;

    return {
      iataCode: nearest.iataCode,
      name: nearest.name,
      city: nearest.city?.name,
      country: nearest.city?.country?.name,
      countryCode: nearest.city?.country?.iso,
    };
  } catch {
    return null;
  }
}

/*
  @route    GET: /geo-currency/currencies
  @access   public
  @desc     Get list of all currencies with names
*/
app.get("/currencies", async (c) => {
  const OPEN_EXCHANGE_API_KEY = process.env.OPEN_EXCHANGE_API_KEY;
  const currenciesUrl = `https://openexchangerates.org/api/currencies.json?app_id=${OPEN_EXCHANGE_API_KEY}`;

  try {
    const response = await fetch(currenciesUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch currencies data");
    }
    const currenciesData = await response.json();

    return c.json(currenciesData);
  } catch (error) {
    console.error("Error fetching currencies data:", error);
    return c.json({ error: "Failed to fetch currencies" }, 500);
  }
});

/*
  @route    GET: /geo-currency
  @access   public
  @desc     Get ip geo location and currency information with all exchange rates
*/
app.get("/", async (c) => {
  try {
    // Get IP from headers or use 'check' for auto-detect (works for local dev)
    const forwardedForIp = c.req.header("X-Forwarded-For") || "check";

    // Location information from IP Address
    const API_KEY = process.env.GEO_LOCATION_API_KEY;
    const url = `https://api.ipapi.com/api/${forwardedForIp}?access_key=${API_KEY}`;

    // GET Latest Exchange Rate Based on US Dollar
    const OPEN_EXCHANGE_API_KEY = process.env.OPEN_EXCHANGE_API_KEY;
    const exchangeUrl = `https://openexchangerates.org/api/latest.json?app_id=${OPEN_EXCHANGE_API_KEY}`;

    // Fetch geolocation first to get coordinates
    const geoResponse = await fetch(url);
    if (!geoResponse.ok) {
      console.error("Geolocation API error:", await geoResponse.text());
      return c.json({ error: "Failed to fetch geolocation data" }, 500);
    }
    const geoData = await geoResponse.json();

    // Fetch exchange rates and nearest airport in parallel for speed
    const [exchangeResponse, nearestAirport] = await Promise.all([
      fetch(exchangeUrl),
      geoData.latitude && geoData.longitude
        ? findNearestAirport(geoData.latitude, geoData.longitude)
        : Promise.resolve(null),
    ]);

    if (!exchangeResponse.ok) {
      console.error("Exchange rate API error:", await exchangeResponse.text());
      return c.json({ error: "Failed to fetch exchange rate data" }, 500);
    }
    const exchangeData = await exchangeResponse.json();

    return c.json({
      countryCode: geoData.country_code,
      countryName: geoData.country_name,
      city: geoData.city,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      languages: geoData.location?.languages || [],
      countryFlag: geoData.location?.country_flag,
      callingCode: geoData.location?.calling_code,
      timeZone: geoData.time_zone,
      currency: geoData.currency,
      exchangeRate: {
        base: exchangeData.base,
        rates: exchangeData.rates,
      },
      nearestAirport,
    });
  } catch (error) {
    console.error("Error in geo-currency endpoint:", error);
    return c.json({ error: "Failed to fetch geo-currency data" }, 500);
  }
});

export default app;
