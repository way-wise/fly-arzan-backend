import { Hono } from "hono";
import { prisma } from "@/lib/prisma.js";

const app = new Hono();

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * @route   GET /api/airports/nearest
 * @desc    Find the nearest airport to given coordinates
 * @access  Public
 * @query   lat - Latitude
 * @query   lon - Longitude
 */
app.get("/nearest", async (c) => {
    const lat = parseFloat(c.req.query("lat") || "");
    const lon = parseFloat(c.req.query("lon") || "");

    if (isNaN(lat) || isNaN(lon)) {
        return c.json({ message: "Valid lat and lon query parameters are required" }, 400);
    }

    try {
        // Get all airports with coordinates and IATA codes (major airports)
        const airports = await prisma.airport.findMany({
            where: {
                latitudeDeg: { not: null },
                longitudeDeg: { not: null },
                iataCode: { not: null },
                type: {
                    in: ["large_airport", "medium_airport"],
                },
            },
            select: {
                id: true,
                name: true,
                iataCode: true,
                latitudeDeg: true,
                longitudeDeg: true,
                type: true,
                city: {
                    select: {
                        name: true,
                        country: {
                            select: {
                                name: true,
                                iso: true,
                            },
                        },
                    },
                },
            },
        });

        if (airports.length === 0) {
            return c.json({ message: "No airports found in database" }, 404);
        }

        // Calculate distance to each airport and find the nearest
        let nearestAirport: (typeof airports)[0] & { distance: number } | null = null;
        let minDistance = Infinity;

        for (const airport of airports) {
            if (airport.latitudeDeg && airport.longitudeDeg) {
                const distance = haversineDistance(
                    lat,
                    lon,
                    airport.latitudeDeg,
                    airport.longitudeDeg
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestAirport = {
                        ...airport,
                        distance: Math.round(distance),
                    };
                }
            }
        }

        if (!nearestAirport) {
            return c.json({ message: "Could not find nearest airport" }, 404);
        }

        return c.json({
            airport: {
                iataCode: nearestAirport.iataCode,
                name: nearestAirport.name,
                city: nearestAirport.city?.name,
                country: nearestAirport.city?.country?.name,
                countryCode: nearestAirport.city?.country?.iso,
                distance: nearestAirport.distance,
            },
        });
    } catch (error) {
        console.error("Error finding nearest airport:", error);
        return c.json({ message: "Failed to find nearest airport" }, 500);
    }
});

/**
 * @route   GET /api/airports/search
 * @desc    Search airports by name or IATA code
 * @access  Public
 * @query   q - Search query
 */
app.get("/search", async (c) => {
    const query = c.req.query("q") || "";

    if (query.length < 2) {
        return c.json({ airports: [] });
    }

    try {
        const airports = await prisma.airport.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { name: { contains: query, mode: "insensitive" } },
                            { iataCode: { contains: query, mode: "insensitive" } },
                        ],
                    },
                    { iataCode: { not: null } },
                    { type: { in: ["large_airport", "medium_airport"] } },
                ],
            },
            select: {
                id: true,
                name: true,
                iataCode: true,
                city: {
                    select: {
                        name: true,
                        country: {
                            select: {
                                name: true,
                                iso: true,
                            },
                        },
                    },
                },
            },
            take: 10,
        });

        return c.json({
            airports: airports.map((a) => ({
                iataCode: a.iataCode,
                name: a.name,
                city: a.city?.name,
                country: a.city?.country?.name,
                countryCode: a.city?.country?.iso,
            })),
        });
    } catch (error) {
        console.error("Error searching airports:", error);
        return c.json({ message: "Failed to search airports" }, 500);
    }
});

export default app;
