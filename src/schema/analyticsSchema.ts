import * as yup from "yup";

export const searchEventSchema = yup.object({
  origin: yup.string().trim().required(),
  destination: yup.string().trim().required(),
  tripType: yup.string().oneOf(["one-way", "round-trip", "multi-city"]).required(),
  travelClass: yup.string().optional(),
  adults: yup.number().integer().min(1).max(9).default(1),
  children: yup.number().integer().min(0).max(9).default(0),
});

export const clickOutEventSchema = yup.object({
  origin: yup.string().trim().required(),
  destination: yup.string().trim().required(),
  tripType: yup.string().oneOf(["one-way", "round-trip", "multi-city"]).required(),
  partner: yup.string().optional(),
});

export const reportsQuerySchema = yup.object({
  range: yup
    .string()
    .oneOf(["last24h", "prev24h"]) // used for single-range endpoints
    .optional(),
  limit: yup.number().integer().min(1).max(100).default(10).optional(),
  format: yup.string().oneOf(["json", "csv"]).default("json").optional(),
});
