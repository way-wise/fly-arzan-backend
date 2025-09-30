import { Hono } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

const app = new Hono();

app.get("/", async (c) => {
  const connInfo = getConnInfo(c);
  const ipAddress = connInfo.remote.address;

  // Detected IP address
  console.log("Detected IP address:", ipAddress);

  const API_KEY = process.env.GEO_LOCATION_API_KEY;
  const url = `https://api.ipapi.com/api/${ipAddress}?access_key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // API response
    console.log("API response:", data);

    return c.json(data);
  } catch (error) {
    console.error("Error fetching geolocation data:", error);
  }
});

export default app;
