import createServer from "./server";
import checkOfflineUsers from "./utils/offlineChecker";
import cron from "node-cron";

const port = process.env.PORT || 8000;

const server = createServer();

cron.schedule("* * * * *", () => {
  checkOfflineUsers();
});

server.listen(port);
