import { getAmadeusToken } from "@/lib/amadeus.js";
import { HTTPException } from "hono/http-exception";
import { format } from "date-fns";
import type { FlightOfferSearchQueryType } from "@/schema/flightSearchSchema.js";
import type { FlightMulticityRequestType } from "@/schema/flightMulticitySchema.js";

// Flight Offer BASE API
const FLIGHT_OFFER_API = "https://test.api.amadeus.com/v2/shopping";

export const flightOfferService = {
  // Get Flight Offers
  async getFlightOffers(queries: FlightOfferSearchQueryType) {
    const token = await getAmadeusToken();

    if (!token) {
      throw new HTTPException(502);
    }

    // Build Query - only include required parameters
    const searchQueries = new URLSearchParams({
      originLocationCode: queries.originLocationCode,
      destinationLocationCode: queries.destinationLocationCode,
      departureDate: format(queries.departureDate, "yyyy-MM-dd"),
      adults: queries.adults.toString(),
      travelClass: queries.travelClass,
    });

    // Children optional
    if (queries.children !== undefined && queries.children > 0) {
      searchQueries.append("children", queries.children.toString());
    }

    // Return date (Only for round-trip)
    if (queries.returnDate !== undefined && queries.returnDate !== null) {
      searchQueries.append(
        "returnDate",
        format(queries.returnDate, "yyyy-MM-dd")
      );
    }

    // Search with currency
    if (queries.currencyCode && queries.currencyCode !== undefined) {
      searchQueries.append("currencyCode", queries.currencyCode);
    }

    const url = `${FLIGHT_OFFER_API}/flight-offers?${searchQueries.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new HTTPException(500, {
        message: `Failed to search flights: ${response.statusText}`,
      });
    }

    return await response.json();
  },

  // Get Multi-City Flight Offers
  async getMultiCityFlightOffers(requestData: FlightMulticityRequestType) {
    const token = await getAmadeusToken();

    if (!token) {
      throw new HTTPException(502);
    }

    const url = `${FLIGHT_OFFER_API}/flight-offers`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new HTTPException(500, {
        message: `Failed to search multi-city flights: ${response.statusText}`,
      });
    }

    return await response.json();
  },
};
