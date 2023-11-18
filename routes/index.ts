import express, { NextFunction, Request, Response } from "express";
import {
  userLoginPost,
  userSignUpPost,
  userLogOutPost,
  getUserDetails,
  getUserList,
  getMessages,
  getDatabaseUserDetails,
} from "../controllers";
import cors from "cors";
const router = express.Router();

const corsForRoutes = cors({
  origin: "http://localhost:5173",
  credentials: true,
});

router.options("*", corsForRoutes);

function checkAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) next();
  else res.status(401).json({ message: "Unauthorized" });
}

router.post("/sign-up", corsForRoutes, userSignUpPost);
router.post("/login", corsForRoutes, userLoginPost);
router.post("/logout", corsForRoutes, checkAuth, userLogOutPost);
router.get("/user", corsForRoutes, getUserDetails);
router.get("/user/:id", corsForRoutes, checkAuth, getDatabaseUserDetails);
router.get("/userList", corsForRoutes, checkAuth, getUserList);
router.get("/messages", corsForRoutes, checkAuth, getMessages);

export default router;
