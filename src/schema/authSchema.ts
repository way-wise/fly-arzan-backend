import { object, string } from "yup";

// Sign Up Schema
export const signUpSchema = object({
  name: string().required("Name is required"),
  email: string().email("Invalid email").required("Email is required"),
  password: string().required("Password is required"),
});

// Sign In Schema
export const signInSchema = object({
  email: string().email("Invalid email").required("Email is required"),
  password: string().required("Password is required"),
});
