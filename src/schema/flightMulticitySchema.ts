import { array, object, string, number, type InferType } from "yup";
import { startOfDay, isAfter, isSameDay, isValid, parseISO } from "date-fns";

// Origin destination schema
const originDestinationSchema = object({
  id: string().required("Origin destination ID is required"),
  originLocationCode: string()
    .required("Origin airport code is required")
    .length(3, "Origin code must be 3 characters")
    .matches(/^[A-Z]{3}$/, "Origin code must be 3 uppercase letters"),
  destinationLocationCode: string()
    .required("Destination airport code is required")
    .length(3, "Destination code must be 3 characters")
    .matches(/^[A-Z]{3}$/, "Destination code must be 3 uppercase letters"),
  departureDateTimeRange: object({
    date: string()
      .required("Departure date is required")
      .matches(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
      .test("valid-date", "Invalid date format", (value) =>
        value ? isValid(parseISO(value)) : false
      )
      .test("not-in-past", "Departure date cannot be in the past", (value) => {
        if (!value) return false;
        const parsed = parseISO(value);
        if (!isValid(parsed)) return false;

        const today = startOfDay(new Date());
        const selectedDate = startOfDay(parsed);

        return isSameDay(selectedDate, today) || isAfter(selectedDate, today);
      }),
  }).required("Departure date time range is required"),
});

// Travelr schema
const travelerSchema = object({
  id: string().required("Traveler ID is required"),
  travelerType: string()
    .required("Traveler type is required")
    .oneOf(["ADULT", "CHILD"], "Traveler type must be ADULT or CHILD"),
});

// Cabin schema
const cabinRestrictionSchema = object({
  cabin: string()
    .required("Cabin is required")
    .oneOf(
      ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
      "Cabin must be ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST"
    )
    .default("ECONOMY"),
  coverage: string()
    .required("Coverage is required")
    .oneOf(
      ["MOST_SEGMENTS", "AT_LEAST_ONE_SEGMENT", "ALL_SEGMENTS"],
      "Invalid coverage type"
    ),
  originDestinationIds: array()
    .of(string())
    .min(1, "At least one origin destination ID is required")
    .required("Origin destination IDs are required"),
});

// Flight multi-city schema
export const flightMulticitySchema = object({
  currencyCode: string()
    .optional()
    .length(3, "Currency code must be 3 characters")
    .matches(/^[A-Z]{3}$/, "Currency code must be 3 uppercase letters")
    .default("USD"),
  originDestinations: array()
    .of(originDestinationSchema)
    .min(2, "At least 2 origin destinations are required for multi-city")
    .max(6, "Maximum 6 origin destinations allowed")
    .required("Origin destinations are required")
    .test("unique-ids", "Origin destination IDs must be unique", (value) => {
      if (!value) return false;
      const ids = value.map((od: any) => od.id);
      return ids.length === new Set(ids).size;
    })
    .test(
      "consecutive-destinations",
      "Each destination must match the next origin",
      (value) => {
        if (!value || value.length < 2) return true;
        for (let i = 0; i < value.length - 1; i++) {
          if (
            value[i].destinationLocationCode !== value[i + 1].originLocationCode
          ) {
            return false;
          }
        }
        return true;
      }
    ),
  travelers: array()
    .of(travelerSchema)
    .min(1, "At least 1 traveler is required")
    .max(9, "Maximum 9 travelers allowed")
    .required("Travelers are required"),
  sources: array()
    .of(string().oneOf(["GDS"], "Invalid source"))
    .optional(),
  searchCriteria: object({
    maxFlightOffers: number()
      .integer()
      .min(1, "Minimum 1 flight offer")
      .max(25, "Maximum 25 flight offers")
      .default(25),
    flightFilters: object({
      cabinRestrictions: array().of(cabinRestrictionSchema).optional(),
    }).optional(),
  }).optional(),
});

export type FlightMulticityRequestType = InferType<
  typeof flightMulticitySchema
>;
