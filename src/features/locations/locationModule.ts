import { Hono } from "hono";
import { locationService } from "./locationService.js";
import { validateInput } from "@/lib/validateInput.js";
import { object, string } from "yup";
import { paginationQuerySchema } from "@/schema/paginationSchema.js";

const app = new Hono();

/*
  @route    GET: /locations
  @access   private
  @desc     Get city locations (With airports, countries, iataCode, etc)
*/
app.get("/", async (c) => {
  // Validate Query
  const validatedQuery = await validateInput({
    type: "query",
    schema: object({
      keyword: string().required(),
    }).concat(paginationQuerySchema),
    data: c.req.query(),
  });

  const { keyword, ...pagination } = validatedQuery;

  const result = await locationService.getLocations(keyword, pagination);
  return c.json(result);
});

export default app;
