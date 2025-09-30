import { Hono } from "hono";

const app = new Hono();

/*
  @route    GET: /geo-currency
  @access   public
  @desc     Get ip geo location and other information
*/
app.get("/", async (c) => {
  const forwardedForIp = c.req.header("X-Forwarded-For");

  // Location information from IP Address
  const API_KEY = process.env.GEO_LOCATION_API_KEY;
  const url = `https://api.ipapi.com/api/${forwardedForIp}?access_key=${API_KEY}`;

  // GET Latest Exchange Rate Based on US Dollar
  const OPEN_EXCHANGE_API_KEY = process.env.OPEN_EXCHANGE_API_KEY;
  const exchangeUrl = `https://openexchangerates.org/api/latest.json?app_id=${OPEN_EXCHANGE_API_KEY}`;

  try {
    const [geoResponse, exchangeResponse] = await Promise.all([
      fetch(url),
      fetch(exchangeUrl),
    ]);

    const [geoData, exchangeData] = await Promise.all([
      geoResponse.json(),
      exchangeResponse.json(),
    ]);

    return c.json({ geoData, exchangeData });
  } catch (error) {
    console.error("Error fetching geolocation or exchange rate data:", error);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
});

export default app;
