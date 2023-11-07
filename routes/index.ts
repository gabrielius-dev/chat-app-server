import express from "express";
import {
  userLoginPost,
  userSignUpPost,
  userLogOutPost,
  getUserDetails,
} from "../controllers";
import cors from "cors";
const router = express.Router();

const corsForRoutes = cors({
  origin: "http://localhost:5173",
  credentials: true,
});

router.options("*", corsForRoutes);

router.post("/sign-up", corsForRoutes, userSignUpPost);
router.post("/login", corsForRoutes, userLoginPost);
router.post("/logout", corsForRoutes, userLogOutPost);
router.get("/user", corsForRoutes, getUserDetails);

export default router;
