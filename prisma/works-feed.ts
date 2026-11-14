// `npm run works:fetch`: city works from the newsvl.ru feed (lib/worksFeed.ts). Safe on the server; cron runs it.
import { prisma } from "@/lib/db";
import { syncNewsWorks } from "@/lib/worksFeed";

syncNewsWorks()
  .then(({ news, saved, removed }) => console.log(`news about works ${news}, saved ${saved}, removed old ${removed}`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
