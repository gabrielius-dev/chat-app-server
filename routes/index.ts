import express from "express";
import { userLoginPost, userSignUpPost } from "../controllers";
import cors from "cors";
const router = express.Router();

const corsForAuthenticatedRoutes = cors({
  origin: "http://localhost:4000",
  credentials: true,
});

const corsForPublicRoutes = cors({
  origin: "http://localhost:4000",
});

router.options(["/sign-up", "/login"], corsForPublicRoutes);
router.options("*", corsForAuthenticatedRoutes);

router.post("/sign-up", corsForPublicRoutes, userSignUpPost);
router.post("/login", corsForPublicRoutes, userLoginPost);

export default router;
