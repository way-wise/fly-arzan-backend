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

export default app;
