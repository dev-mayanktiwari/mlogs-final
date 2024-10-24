import express, { Application, NextFunction, Request, Response } from "express";
import router from "./router/apiRouter";
import cors from "cors";
import globalErrorHandler from "./middleware/globalErrorHandler";
import { EResponseMessage } from "./constant/responseMessage";
import httpError from "./utils/httpError";
import helmet from "helmet";
import cookieParser from "cookie-parser";

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cookieParser());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));


// Routes
app.use("/api/v1", router);

//404 Handler
app.use((req: Request, _: Response, next: NextFunction) => {
  try {
    throw new Error(EResponseMessage.NOT_FOUND);
  } catch (error) {
    httpError(next, error, req, 404);
  }
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;

