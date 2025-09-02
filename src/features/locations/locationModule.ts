import { Hono } from "hono";
import { locationService } from "./locationService.js";
import { validateInput } from "@/lib/validateInput.js";
import { object, string } from "yup";

const app = new Hono();

/*
  @route    GET: /locations
  @access   private
  @desc     Get city locations
*/
app.get("/", async (c) => {
  // Validate Query
  const validatedQuery = await validateInput({
    type: "query",
    schema: object({
      keyword: string().required(),
    }),
    data: c.req.query(),
  });

  const result = await locationService.getLocation(validatedQuery.keyword);
  return c.json(result);
});

export default app;
