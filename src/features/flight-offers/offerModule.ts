import { Hono } from "hono";
import { flightOfferService } from "./offerService.js";
import { validateInput } from "@/lib/validateInput.js";
import { flightOfferSearchSchema } from "@/schema/flightSearchSchema.js";
import { flightMulticitySchema } from "@/schema/flightMulticitySchema.js";

const app = new Hono();

/*
  @route    GET: /flight-offers
  @access   public
  @desc     Get flight offers (One Way & Round Way)
*/
app.get("/", async (c) => {
  // Validate Query
  const validatedQuery = await validateInput({
    type: "query",
    schema: flightOfferSearchSchema,
    data: c.req.query(),
  });

  const result = await flightOfferService.getFlightOffers(validatedQuery);
  return c.json(result);
});

/*
  @route    POST: /flight-offers
  @access   public
  @desc     Get multi-city flight offers
*/
app.post("/", async (c) => {
  // Validate Request Body
  const validatedBody = await validateInput({
    type: "form",
    schema: flightMulticitySchema,
    data: await c.req.json(),
  });

  const result = await flightOfferService.getMultiCityFlightOffers(
    validatedBody
  );
  return c.json(result);
});

/*
  @route    GET: /flight-offers/cheapest-dates
  @access   public
  @desc     Get cheapest flight dates for flexible dates calendar
  @query    origin - Origin IATA code (required)
  @query    destination - Destination IATA code (required)
  @query    departureDate - Departure date YYYY-MM-DD (optional)
  @query    oneWay - One way flight (optional, default false)
  @query    duration - Trip duration in days (optional)
  @query    nonStop - Non-stop flights only (optional)
*/
app.get("/cheapest-dates", async (c) => {
  const origin = c.req.query("origin");
  const destination = c.req.query("destination");

  if (!origin || !destination) {
    return c.json({ message: "origin and destination are required" }, 400);
  }

  const params = {
    origin,
    destination,
    departureDate: c.req.query("departureDate"),
    oneWay: c.req.query("oneWay") === "true",
    duration: c.req.query("duration"),
    nonStop: c.req.query("nonStop") === "true",
    viewBy: "DATE" as const,
  };

  const result = await flightOfferService.getCheapestFlightDates(params);
  return c.json(result);
});

/*
  @route    GET: /flight-offers/flexible-prices
  @access   public
  @desc     Get prices for a date range using Flight Cheapest Date Search API (single efficient call)
  @query    origin - Origin IATA code (required)
  @query    destination - Destination IATA code (required)
  @query    departureDate - Start date YYYY-MM-DD (optional)
  @query    endDate - End date YYYY-MM-DD for range (optional)
  @query    oneWay - Boolean for one-way flights (optional)
  @query    viewBy - DATE, DURATION, or WEEK (optional, default DATE)
*/
app.get("/flexible-prices", async (c) => {
  const origin = c.req.query("origin");
  const destination = c.req.query("destination");

  if (!origin || !destination) {
    return c.json({ message: "origin and destination are required" }, 400);
  }

  const departureDate = c.req.query("departureDate");
  const endDate = c.req.query("endDate");
  const oneWay = c.req.query("oneWay") === "true";
  const viewBy = (c.req.query("viewBy") as "DATE" | "DURATION" | "WEEK") || "DATE";

  const result = await flightOfferService.getFlexibleDatePrices({
    origin,
    destination,
    departureDate,
    endDate,
    oneWay,
    viewBy,
  });

  return c.json(result);
});

export default app;
