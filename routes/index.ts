import express from "express";
import {
  userLoginPost,
  userSignUpPost,
  userLogOutPost,
  getUserDetails,
} from "../controllers";
import cors from "cors";
const router = express.Router();

const corsForAuthenticatedRoutes = cors({
  origin: "http://localhost:5173",
  credentials: true,
});

const corsForPublicRoutes = cors({
  origin: "http://localhost:5173",
});

router.options(["/sign-up", "/login"], corsForPublicRoutes);
router.options("*", corsForAuthenticatedRoutes);

router.post("/sign-up", corsForPublicRoutes, userSignUpPost);
router.post("/login", corsForPublicRoutes, userLoginPost);
router.post("/logout", corsForAuthenticatedRoutes, userLogOutPost);
router.get("/user", corsForAuthenticatedRoutes, getUserDetails);

export default router;
