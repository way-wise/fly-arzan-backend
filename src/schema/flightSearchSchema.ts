import { date, object, string, number, type InferType } from "yup";
import { startOfDay, isAfter, isSameDay, isValid, parseISO } from "date-fns";

export const flightOfferSearchSchema = object({
  originLocationCode: string()
    .required("Origin airport code is required")
    .length(3, "Origin code must be 3 characters")
    .matches(/^[A-Z]{3}$/, "Origin code must be 3 uppercase letters"),

  destinationLocationCode: string()
    .required("Destination airport code is required")
    .length(3, "Destination code must be 3 characters")
    .matches(/^[A-Z]{3}$/, "Destination code must be 3 uppercase letters")
    .test(
      "different-from-origin",
      "Destination must be different from origin",
      function (value) {
        return value !== this.parent.originLocationCode;
      }
    ),

  departureDate: date()
    .transform((value, originalValue) => {
      // Handle string dates from URL params (YYYY-MM-DD format)
      if (
        typeof originalValue === "string" &&
        originalValue.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        const parsed = parseISO(originalValue);
        return isValid(parsed) ? parsed : value;
      }
      return value;
    })
    .required("Departure date is required")
    .test(
      "not-in-past",
      "Departure date cannot be in the past",
      function (value) {
        if (!value || !isValid(value)) return false;

        const today = startOfDay(new Date());
        const selectedDate = startOfDay(value);

        return isSameDay(selectedDate, today) || isAfter(selectedDate, today);
      }
    ),

  returnDate: date()
    .transform((value, originalValue) => {
      // Handle string dates from URL params
      if (
        typeof originalValue === "string" &&
        originalValue.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        const parsed = parseISO(originalValue);
        return isValid(parsed) ? parsed : value;
      }
      return value;
    })
    .test("not-in-past", "Return date cannot be in the past", function (value) {
      if (!value) return true; // Optional field
      if (!isValid(value)) return false;

      const today = startOfDay(new Date());
      const selectedDate = startOfDay(value);

      return isSameDay(selectedDate, today) || isAfter(selectedDate, today);
    })
    .test(
      "is-after-or-same-as-departure",
      "Return date must be on or after departure date",
      function (value) {
        const { departureDate } = this.parent;
        if (!departureDate || !value) return true;
        if (!isValid(departureDate) || !isValid(value)) return false;

        const departure = startOfDay(departureDate);
        const returnDate = startOfDay(value);

        return (
          isSameDay(returnDate, departure) || isAfter(returnDate, departure)
        );
      }
    )
    .optional(),

  adults: number()
    .transform((value, originalValue) => {
      if (typeof originalValue === "string") {
        const parsed = parseInt(originalValue, 10);
        return isNaN(parsed) ? 1 : parsed; // Default to 1 if parsing fails
      }
      return value || 1; // Default to 1 if undefined
    })
    .min(1, "At least 1 adult is required")
    .max(9, "Maximum 9 adults allowed")
    .integer("Adults must be a whole number")
    .default(1), // Amadeus default

  children: number()
    .transform((value, originalValue) => {
      if (typeof originalValue === "string") {
        const parsed = parseInt(originalValue, 10);
        return isNaN(parsed) ? undefined : parsed;
      }
      return value;
    })
    .min(0, "Children cannot be negative")
    .max(9, "Maximum 9 children allowed")
    .integer("Children must be a whole number")
    .optional(), // Truly optional as per Amadeus docs

  travelClass: string()
    .oneOf(
      ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
      "Travel class must be ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST"
    )
    .default("ECONOMY"),
}).test(
  "total-passengers",
  "Total passengers (adults + children) cannot exceed 9",
  function (value) {
    const { adults, children } = value;
    const total = (adults || 1) + (children || 0);
    return total <= 9;
  }
);

export type FlightOfferSearchQueryType = InferType<
  typeof flightOfferSearchSchema
>;
