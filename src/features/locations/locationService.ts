import { prisma } from "@/lib/prisma.js";
import { getPaginationQuery } from "@/lib/pagination.js";
import type { PaginationQuery } from "@/schema/paginationSchema.js";

export const locationService = {
  async getLocations(keyword: string, pagination: PaginationQuery) {
    const { skip, take, page, limit } = getPaginationQuery(pagination);

    const airports = await prisma.airport.findMany({
      where: {
        OR: [
          {
            iataCode: {
              contains: keyword,
              mode: "insensitive",
            },
          },
          {
            city: {
              name: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
        ],
      },
      skip,
      take,
      include: {
        city: {
          include: {
            country: true,
          },
        },
      },
    });

    const total = await prisma.airport.count({
      where: {
        OR: [
          {
            iataCode: {
              contains: keyword,
              mode: "insensitive",
            },
          },
          {
            city: {
              name: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
        ],
      },
    });

    return {
      meta: {
        total,
        page,
        limit,
      },
      data: airports.map((airport) => ({
        city: airport.city.name,
        country: airport.city.country.name,
        airport: airport.name,
        iataCode: airport.iataCode,
        lat: airport.latitudeDeg,
        lang: airport.longitudeDeg,
      })),
    };
  },
};
