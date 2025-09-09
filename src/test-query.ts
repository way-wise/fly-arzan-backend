import { prisma } from "./lib/prisma.js";

async function main() {
  const countries = await prisma.country.findMany({ take: 5 });
  console.log("Countries:", countries);

  const regions = await prisma.region.findMany({ take: 5 });
  console.log("Regions:", regions);

  const cities = await prisma.city.findMany({ take: 5 });
  console.log("Cities:", cities);

  const airports = await prisma.airport.findMany({ take: 5 });
  console.log("Airports:", airports);

  const airlines = await prisma.airline.findMany({ take: 5 });
  console.log("Airlines:", airlines);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
