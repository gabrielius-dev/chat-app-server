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
import MongoStore from "connect-mongo";

dotenv.config();

function createServer() {
  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI);
  } else {
    console.error("MONGODB_URI environment variable is not defined.");
  }

  const app: Application = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONT_END_URL,
      credentials: true,
    },
  });

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET_KEY || "",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === "production" ? true : "auto",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
    proxy: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "",
    }),
  });

  app.use(sessionMiddleware);
  app.set("socketio", io);

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

  io.use(wrap(sessionMiddleware));
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

  return server;
}

export default createServer;
