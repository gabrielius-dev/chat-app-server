import express, { Request, Response } from "express";
import { userSignUpPost } from "../controllers";
const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.send("Index page");
});

router.post("/sign-up", userSignUpPost);

export default router;
