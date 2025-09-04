import { Hono } from "hono";
import { flightOfferService } from "./offerService.js";
import { validateInput } from "@/lib/validateInput.js";
import { flightOneWaySearchSchema } from "@/schema/flightSearchSchema.js";

const app = new Hono();

/*
  @route    GET: /flight-offers
  @access   private
  @desc     Get flight offers (One Way)
*/
app.get("/one-way", async (c) => {
  // Validate Query
  const validatedQuery = await validateInput({
    type: "query",
    schema: flightOneWaySearchSchema,
    data: c.req.query(),
  });

  const result = await flightOfferService.getOneWayFlightOffers(validatedQuery);
  return c.json(result);
});

export default app;
