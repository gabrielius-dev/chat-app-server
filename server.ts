import express, { Application, NextFunction, Request, Response } from "express";
import createError from "http-errors";
import logger from "morgan";
import dotenv from "dotenv";
import initializePassport from "./configs/passport";
import session from "express-session";
import mongoose from "mongoose";
import passport from "passport";
import indexRouter from "./routes/index";

dotenv.config();

function createServer(): Application {
  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI);
  } else {
    console.error("MONGODB_URI environment variable is not defined.");
  }

  const app: Application = express();

  if (process.env.SESSION_SECRET_KEY) {
    app.use(
      session({
        secret: process.env.SESSION_SECRET_KEY,
        resave: false,
        saveUninitialized: true,
      })
    );
  } else {
    console.error("SESSION_SECRET_KEY environment variable is not defined.");
  }

  initializePassport();
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(logger("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use("/", indexRouter);

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

  return app;
}

export default createServer;
