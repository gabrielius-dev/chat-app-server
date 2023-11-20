import express, { Application, NextFunction, Request, Response } from "express";
import createError from "http-errors";
import logger from "morgan";
import dotenv from "dotenv";
import initializePassport from "./configs/passport";
import session from "express-session";
import mongoose from "mongoose";
import passport from "passport";
import indexRouter from "./routes/index";
import http, { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { handleAuthentication, handleConnection } from "./controllers/socket";
dotenv.config();

type CustomServer = {
  app: Application;
  server: HttpServer;
  io: SocketIOServer;
};

function createServer(): CustomServer {
  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI);
  } else {
    console.error("MONGODB_URI environment variable is not defined.");
  }

  const app: Application = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  let sessionMiddleware;
  if (process.env.SESSION_SECRET_KEY)
    sessionMiddleware = session({
      secret: process.env.SESSION_SECRET_KEY,
      resave: false,
      saveUninitialized: true,
      rolling: true,
      cookie: { maxAge: 24 * 60 * 60 * 1000 },
    });
  else {
    console.error("SESSION_SECRET_KEY environment variable is not defined.");
  }

  if (sessionMiddleware) app.use(sessionMiddleware);

  app.use(passport.initialize());
  app.use(passport.session());
  initializePassport();
  app.use(logger("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use("/", indexRouter);

  const wrap =
    <T extends (req: any, res: any, next: (err?: any) => void) => void>(
      middleware: T
    ) =>
    (socket: Socket, next: (err?: any) => void) =>
      middleware(socket.request, {}, next);

  if (sessionMiddleware) io.use(wrap(sessionMiddleware));
  io.use(wrap(passport.initialize()));
  io.use(wrap(passport.session()));

  io.use(handleAuthentication);

  io.on("connection", handleConnection);

  // catch 404 and forward to error handler
  app.use((req, res, next) => {
    next(createError(404));
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    res.status(err.status || 500);
    res.json({
      error: {
        message: err.message,
        stack: req.app.get("env") === "development" ? err.stack : undefined,
      },
    });
  });

  return { app, server, io };
}

export default createServer;
