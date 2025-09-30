import { Hono } from "hono";

const app = new Hono();

/*
  @route    GET: /geo-currency
  @access   public
  @desc     Get ip geo location and other information
*/
app.get("/", async (c) => {
  const forwardedForIp = c.req.header("X-Forwarded-For");

  const API_KEY = process.env.GEO_LOCATION_API_KEY;
  const url = `https://api.ipapi.com/api/${forwardedForIp}?access_key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    return c.json(data);
  } catch (error) {
    console.error("Error fetching geolocation data:", error);
  }
});

export default app;
