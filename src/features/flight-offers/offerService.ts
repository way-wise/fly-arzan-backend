import { getAmadeusToken } from "@/lib/amadeus.js";
import { HTTPException } from "hono/http-exception";
import type { FlightOneWaySearchQueryType } from "@/schema/flightSearchSchema.js";

// Flight Offer BASE API
const FLIGHT_OFFER_API = "https://test.api.amadeus.com/v2";

export const flightOfferService = {
  // Get One Way Offers
  async getOneWayFlightOffers(queries: FlightOneWaySearchQueryType) {
    const token = await getAmadeusToken();

    if (!token) {
      throw new HTTPException(502);
    }

    // Build Query
    const searchQueries = new URLSearchParams({
      originLocationCode: queries.originLocationCode,
      destinationLocationCode: queries.destinationLocationCode,
      departureDate: queries.departureDate.toISOString().split("T")[0],
      adults: queries.adults,
      max: "29",
    });

    const url = `${FLIGHT_OFFER_API}/shopping/flight-offers?${searchQueries.toString()}`;

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
