import type { PaginationQuery } from "@/schema/paginationSchema.js";

// Extract pagination queries
export function getPaginationQuery(query: PaginationQuery) {
  const take = query.limit;
  const skip = (query.page - 1) * query.limit;

  return {
    skip,
    take,
    page: query.page,
    limit: query.limit,
  };
}