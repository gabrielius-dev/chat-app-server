import express, { Request, Response, Application, NextFunction } from "express";
import createError from "http-errors";
import logger from "morgan";
import dotenv from "dotenv";
import indexRouter from "./routes/index";
import mongoose from "mongoose";
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 8000;

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI);
} else {
  console.error("MONGODB_URI environment variable is not defined.");
}

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/", indexRouter);

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message,
      stack: req.app.get("env") === "development" ? err.stack : undefined,
    },
  });
});

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});

export default app;
