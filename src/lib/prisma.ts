import { PrismaClient } from "@prisma/client";

// Standard singleton pattern so dev's hot-reload (tsx watch) doesn't spawn
// a new PrismaClient, and therefore a new connection pool, on every save.
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = global.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
