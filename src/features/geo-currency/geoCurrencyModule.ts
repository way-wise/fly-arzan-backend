import { Hono } from "hono";

const app = new Hono();

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
      console.error("Geolocation API error:", await geoResponse.text());
      return c.json({ error: "Failed to fetch geolocation data" }, 500);
    }
    const geoData = await geoResponse.json();

    // Then fetch exchange rates
    const exchangeResponse = await fetch(exchangeUrl);
    if (!exchangeResponse.ok) {
      console.error("Exchange rate API error:", await exchangeResponse.text());
      return c.json({ error: "Failed to fetch exchange rate data" }, 500);
    }
    const exchangeData = await exchangeResponse.json();

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
        rates: exchangeData.rates,
      },
    });
  } catch (error) {
    console.error("Error in geo-currency endpoint:", error);
    return c.json({ error: "Failed to fetch geo-currency data" }, 500);
  }
});

export default app;
