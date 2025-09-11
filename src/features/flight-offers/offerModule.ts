import { Hono } from "hono";
import { flightOfferService } from "./offerService.js";
import { validateInput } from "@/lib/validateInput.js";
import { flightOfferSearchSchema } from "@/schema/flightSearchSchema.js";

const app = new Hono();

/*
  @route    GET: /flight-offers
  @access   private
  @desc     Get flight offers (One Way)
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

export default app;
