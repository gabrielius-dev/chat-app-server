import createServer from "./server";
import checkOfflineUsers from "./utils/offlineChecker";
import cron from "node-cron";

const port = process.env.PORT || 8000;

const { app, server, io } = createServer();

cron.schedule("* * * * *", () => {
  checkOfflineUsers();
});

server.listen(port);

export default app;
export { io };
