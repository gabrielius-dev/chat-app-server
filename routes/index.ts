import express, { NextFunction, Request, Response } from "express";
import {
  userLoginPost,
  userSignUpPost,
  userLogOutPost,
  getUserDetails,
  getChatList,
  getGroupChat,
  createGroupChat,
  getMessages,
  getDatabaseUserDetails,
  editUserDetails,
  getUserList,
  getGroupChatList,
  getGroupChatMessages,
  deleteMessage,
  editGroupChat,
  getGroupChatListChat,
  deleteGroupChat,
  createMessage,
} from "../controllers";
import cors from "cors";
import multer from "multer";
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

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/sign-up", corsForRoutes, userSignUpPost);
router.post("/login", corsForRoutes, userLoginPost);
router.post("/logout", corsForRoutes, checkAuth, userLogOutPost);
router.get("/user", corsForRoutes, getUserDetails);
router.get("/user/:id", corsForRoutes, checkAuth, getDatabaseUserDetails);
router.put(
  "/user/:id",
  corsForRoutes,
  checkAuth,
  upload.single("image"),
  editUserDetails
);
router.get("/chat-list", corsForRoutes, checkAuth, getChatList);
router.get("/group-chat/:chatId", corsForRoutes, checkAuth, getGroupChat);
router.post(
  "/group-chat",
  corsForRoutes,
  checkAuth,
  upload.single("image"),
  createGroupChat
);
router.put(
  "/group-chat",
  corsForRoutes,
  checkAuth,
  upload.single("image"),
  editGroupChat
);
router.delete("/group-chat/:id", corsForRoutes, checkAuth, deleteGroupChat);
router.get("/group-chat-list", corsForRoutes, checkAuth, getGroupChatList);
router.get(
  "/group-chat-list-chat/:id",
  corsForRoutes,
  checkAuth,
  getGroupChatListChat
);
router.get("/group-messages", corsForRoutes, checkAuth, getGroupChatMessages);
router.get("/messages", corsForRoutes, checkAuth, getMessages);
router.get("/user-list", corsForRoutes, checkAuth, getUserList);
router.post(
  "/message",
  corsForRoutes,
  checkAuth,
  upload.array("images"),
  createMessage
);
router.delete("/message/:id", corsForRoutes, checkAuth, deleteMessage);

export default router;
