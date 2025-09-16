import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma.js";

async function main(total: number) {
  await prisma.$transaction(async (tx) => {
    // Create admin
    const users = [
      {
        name: "Zabet",
        email: "admin@flyarzan.com",
        emailVerified: true,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await tx.user.createMany({
      data: users,
      skipDuplicates: true,
    });

    // Get created user IDs
    const userIds = await tx.user.findMany({
      select: { id: true },
      take: 1,
    });

    // Create accounts for users with same password
    const password = await hashPassword("12345678");
    await tx.account.createMany({
      data: userIds.map(({ id }) => ({
        userId: id,
        accountId: id,
        providerId: "credential",
        password,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
  });
}

main(1)
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
