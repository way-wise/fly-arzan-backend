import "@dotenvx/dotenvx/config";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
