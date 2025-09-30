import { Hono } from "hono";

const app = new Hono();

/*
  @route    GET: /geo-currency
  @access   public
  @desc     Get ip geo location and currency information
*/
app.get("/", async (c) => {
  const forwardedForIp = c.req.header("X-Forwarded-For");

  // Location information from IP Address
  const API_KEY = process.env.GEO_LOCATION_API_KEY;
  const url = `https://api.ipapi.com/api/${forwardedForIp}?access_key=${API_KEY}`;

  // GET Latest Exchange Rate Based on US Dollar
  const OPEN_EXCHANGE_API_KEY = process.env.OPEN_EXCHANGE_API_KEY;
  const exchangeUrl = `https://openexchangerates.org/api/latest.json?app_id=${OPEN_EXCHANGE_API_KEY}`;

  // Fetch geolocation first to get currency code
  const geoResponse = await fetch(url);
  if (!geoResponse.ok) {
    throw new Error("Failed to fetch geolocation data");
  }
  const geoData = await geoResponse.json();

  // Then fetch exchange rates
  const exchangeResponse = await fetch(exchangeUrl);
  if (!exchangeResponse.ok) {
    throw new Error("Failed to fetch exchange rate data");
  }
  const exchangeData = await exchangeResponse.json();

  // Extract currency code from geo data
  const currencyCode = geoData.currency?.code || "USD";

  // Get the exchange rate for the user's currency, default to 1 (USD)
  const rate = exchangeData.rates[currencyCode] || 1;

  return c.json({
    countryCode: geoData.country_code,
    countryName: geoData.country_name,
    languages: geoData.location?.languages || [],
    countryFlag: geoData.location?.country_flag,
    callingCode: geoData.location?.calling_code,
    timeZone: geoData.time_zone,
    currency: geoData.currency,
    exchangeRate: {
      base: exchangeData.base,
      [currencyCode]: rate,
    },
  });
});

export default app;
