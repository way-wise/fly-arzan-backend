import { date, object, string, type InferType } from "yup";

export const flightOneWaySearchSchema = object({
  originLocationCode: string().required(),
  destinationLocationCode: string().required(),
  departureDate: date()
    .required("Departure date is are required")
    .min(new Date(), "Departure date cannot be in the past"),
  adults: string().required(),
});

export type FlightOneWaySearchQueryType = InferType<
  typeof flightOneWaySearchSchema
>;
