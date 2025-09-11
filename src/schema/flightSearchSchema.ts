import { date, object, string, type InferType } from "yup";

export const flightOneWaySearchSchema = object({
  originLocationCode: string().required(),
  destinationLocationCode: string().required(),
  departureDate: date()
    .required("Departure date is are required")
    .min(new Date(), "Departure date cannot be in the past"),
  returnDate: date()
    .min(new Date(), "Return date cannot be in the past")
    .test(
      "is-after-departure",
      "Return date must be after departure date",
      function (value) {
        const { departureDate } = this.parent;
        if (!departureDate || !value) return true;
        return value > departureDate;
      }
    )
    .optional(),
  adults: string().required(),
  children: string().optional(),
  travelClass: string().optional(),
});

export type FlightOneWaySearchQueryType = InferType<
  typeof flightOneWaySearchSchema
>;
