import { Schema, ValidationError } from "yup";
import { AppValidationError } from "./errorHandler.js";

// Validate Input Function
interface ValidateInputProps {
  type: "form" | "query" | "param";
  schema: Schema;
  data: unknown;
}

export const validateInput = async ({
  type,
  schema,
  data,
}: ValidateInputProps) => {
  try {
    const validated = await schema.validate(data, {
      stripUnknown: true,
    });

    return validated;
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new AppValidationError(
        type,
        err.message,
        type === "form" ? err.path || "" : undefined
      );
    }

    throw err;
  }
};
