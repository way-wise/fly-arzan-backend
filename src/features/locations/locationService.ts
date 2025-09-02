import { getAmadeusToken } from "@/lib/amadeus.js";
import { HTTPException } from "hono/http-exception";

// Location BASE API
const LOCATION_API = "https://test.api.amadeus.com/v1";

export const locationService = {
  // Get Location
  async getLocation(keyword: string) {
    const token = await getAmadeusToken();

    if (!token) {
      throw new HTTPException(502);
    }

    const url = `${LOCATION_API}/reference-data/locations?subType=CITY&keyword=${keyword}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to search locations: ${response.statusText}`);
    }

    return await response.json();
  },
};
