import { getAmadeusToken } from "@/lib/amadeus.js";
import { HTTPException } from "hono/http-exception";
import type { FlightOfferSearchQueryType } from "@/schema/flightSearchSchema.js";

// Flight Offer BASE API
const FLIGHT_OFFER_API = "https://test.api.amadeus.com/v2";

export const flightOfferService = {
  // Get Flight Offers
  async getFlightOffers(queries: FlightOfferSearchQueryType) {
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

    if (queries.returnDate !== undefined) {
      searchQueries.append(
        "returnDate",
        queries.returnDate.toISOString().split("T")[0]
      );
    }

    if (queries.children) {
      searchQueries.append("children", queries.children);
    }

    if (queries.travelClass) {
      searchQueries.append("travelClass", queries.travelClass);
    }

    const url = `${FLIGHT_OFFER_API}/shopping/flight-offers?${searchQueries.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to search locations: ${response.statusText}`);
    }

    return response.json();
  },
};
