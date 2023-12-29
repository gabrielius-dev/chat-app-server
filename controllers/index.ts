import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { body, check, validationResult } from "express-validator";
import UserModel from "../models/user";
import expressAsyncHandler from "express-async-handler";
import passport from "passport";
import mongoose from "mongoose";
import MessageModel from "../models/message";
import { updateUserLastOnline } from "../utils/updateUser";
import GroupModel from "../models/group";
import { google } from "googleapis";
import resizeAndCompressImage from "../utils/resizeImage";
import streamifier from "streamifier";
dotenv.config();

const drive = google.drive({
  version: "v3",
  auth: new google.auth.GoogleAuth({
    keyFile: "./configs/google_service_account.json",
    scopes: ["https://www.googleapis.com/auth/drive"],
  }),
});

export const userSignUpPost = [
  body("username")
    .escape()
    .trim()
    .notEmpty()
    .withMessage("Username must be specified")
    .isLength({ max: 100 })
    .withMessage("Username can't exceed 100 characters")
    .custom(async (value) => {
      const user = await UserModel.findOne({ username: value });
      if (user) throw new Error("Username already exists");
    }),
  body("password")
    .escape()
    .trim()
    .notEmpty()
    .withMessage("Password must be specified")
    .isLength({ max: 100 })
    .withMessage("Password can't exceed 100 characters"),
  body("passwordConfirmation")
    .escape()
    .trim()
    .notEmpty()
    .withMessage("Password confirmation must be specified")
    .isLength({ max: 100 })
    .withMessage("Password confirmation can't exceed 100 characters")
    .custom((value, { req }) => {
      if (req.body.passwordConfirmation && value !== req.body.password)
        throw new Error("Passwords don't match");
      else return true;
    }),
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const errors = validationResult(req).formatWith((err) => {
        if (err.type === "field")
          return {
            path: err.path,
            message: err.msg,
          };
      });
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Sign up failed",
          errors: errors.array(),
        });
      } else {
        const { username, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new UserModel({
          username,
          password: hashedPassword,
        });
        await user.save();

        req.login(user, async (err) => {
          if (err) return next(err);
          const updatedUser = await UserModel.findByIdAndUpdate(
            user._id,
            {
              lastOnline: Date.now(),
              online: true,
            },
            { new: true }
          );

          res.status(200).json({
            success: true,
            message: "Sign up successful",
            user: updatedUser,
          });
        });
      }
    }
  ),
];

export const userLoginPost = [
  body("username")
    .escape()
    .trim()
    .notEmpty()
    .withMessage("Username must be specified")
    .isLength({ max: 100 })
    .withMessage("Username can't exceed 100 characters")
    .custom(async (value) => {
      const user = await UserModel.findOne({ username: value });
      if (!user) throw new Error("Username doesn't exist");
    }),
  body("password")
    .escape()
    .trim()
    .notEmpty()
    .withMessage("Password must be specified")
    .isLength({ max: 100 })
    .withMessage("Password can't exceed 100 characters"),
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const errors = validationResult(req).formatWith((err) => {
        if (err.type === "field")
          return {
            path: err.path,
            message: err.msg,
          };
      });
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Login failed",
          errors: errors.array(),
        });
      } else {
        passport.authenticate("local", (err: any, user: any, info: any) => {
          if (err) {
            return next(err);
          }
          if (!user) {
            return res.status(400).json({
              success: false,
              message: "Login failed",
              errors: [info],
            });
          }
          req.login(user, async (err) => {
            if (err) {
              return next(err);
            }
            const updatedUser = await UserModel.findByIdAndUpdate(
              user._id,
              {
                lastOnline: Date.now(),
                online: true,
              },
              { new: true }
            );

            return res.status(200).json({
              success: true,
              message: "Login successful",
              user: updatedUser,
            });
          });
        })(req, res, next);
      }
    }
  ),
];

export const userLogOutPost = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    await UserModel.findByIdAndUpdate(req.user._id, {
      lastOnline: Date.now(),
      online: false,
    });
    req.logout((err: any) => {
      if (err) return next(err);
    });
    res.clearCookie("connect.sid");
    res.status(200).json({ success: true, message: "Log out successful" });
  }
);

export const getUserDetails = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
      const updatedUser = await UserModel.findByIdAndUpdate(
        // @ts-ignore
        req.user._id,
        {
          lastOnline: Date.now(),
          online: true,
        },
        { new: true }
      );

      res.status(200).json({
        success: true,
        message: "User found",
        user: updatedUser,
      });
    } else {
      res.status(200).json({
        success: false,
        message: "User not found",
        user: null,
      });
    }
  }
);

export const getChatList = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    //@ts-ignore
    await updateUserLastOnline(req.user._id);

    const LIMIT = (Number(req.query.loadOffset) || 1) * 10;

    // @ts-ignore
    const userId = req.user._id;
    const result = await UserModel.aggregate([
      {
        $match: {
          _id: { $ne: userId },
        },
      },
      {
        $lookup: {
          from: "messages",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $eq: ["$sender", "$$userId"] },
                        { $eq: ["$receiver", userId] },
                      ],
                    },
                    {
                      $and: [
                        { $eq: ["$sender", userId] },
                        { $eq: ["$receiver", "$$userId"] },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $sort: { createdAt: -1 },
            },
            {
              $limit: 1,
            },
            {
              $lookup: {
                from: "users",
                localField: "sender",
                foreignField: "_id",
                as: "senderDetails",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "receiver",
                foreignField: "_id",
                as: "receiverDetails",
              },
            },
            {
              $unwind: {
                path: "$senderDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$receiverDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                sender: {
                  _id: "$senderDetails._id",
                  username: "$senderDetails.username",
                  img: "$senderDetails.img",
                  online: "$senderDetails.online",
                  lastOnline: "$senderDetails.lastOnline",
                  password: "$senderDetails.password",
                },
                receiver: {
                  _id: "$receiverDetails._id",
                  username: "$receiverDetails.username",
                  img: "$receiverDetails.img",
                  online: "$receiverDetails.online",
                  lastOnline: "$receiverDetails.lastOnline",
                  password: "$receiverDetails.password",
                },
                content: 1,
                createdAt: 1,
              },
            },
          ],
          as: "latestMessage",
        },
      },
      {
        $unwind: {
          path: "$latestMessage",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: {
          "latestMessage.createdAt": -1,
        },
      },
      {
        $limit: LIMIT,
      },
      {
        $project: {
          password: 0,
        },
      },
    ]);
    res.status(200).json(result);
  }
);

export const getGroupChat = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.chatId;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      res.status(200).json({
        success: false,
        message: "Group chat not found",
        groupChat: null,
      });
      return;
    }
    const groupChat = await GroupModel.findById(chatId).exec();

    if (!groupChat)
      res.status(400).json({
        success: false,
        message: "Group chat not found",
        groupChat: null,
      });
    else
      res
        .status(200)
        .json({ success: true, message: "Group chat found", groupChat });
  }
);

export const createGroupChat = [
  check("name")
    .escape()
    .trim()
    .notEmpty()
    .withMessage("Name must be specified")
    .isLength({ max: 100 })
    .withMessage("Name can't exceed 100 characters"),
  check("users")
    .customSanitizer((value) => {
      return JSON.parse(value);
    })
    .isArray({ min: 1 })
    .withMessage("At least one user must be specified"),
  check("image").custom((value, { req }) => {
    if (value) {
      if (!req.file || !req.file.mimetype.startsWith("image/")) {
        throw new Error("Please upload a valid image file");
      } else return true;
    } else return true;
  }),
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req).formatWith((err) => {
        if (err.type === "field")
          return {
            path: err.path,
            message: err.msg,
          };
      });

      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Group creation failed",
          errors: errors.array(),
        });
      } else {
        try {
          let imageUrl = null;
          if (req.file && process.env.GROUP_IMAGES_FOLDER_ID) {
            const resizedAndCompressedImage = await resizeAndCompressImage(
              req.file.buffer
            );
            const stream = streamifier.createReadStream(
              resizedAndCompressedImage
            );

            const response = await drive.files.create({
              requestBody: {
                name: req.file.originalname,
                mimeType: req.file.mimetype,
                parents: [process.env.GROUP_IMAGES_FOLDER_ID],
              },
              fields: "id",
              media: {
                mimeType: req.file.mimetype,
                body: stream,
              },
            });
            if (response.data.id)
              await drive.permissions.create({
                fileId: response.data.id,
                requestBody: {
                  role: "reader",
                  type: "anyone",
                },
              });

            imageUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
          }
          // @ts-ignore
          const userId = req.user._id;
          const users = [userId, ...req.body.users];
          const group = new GroupModel({
            name: req.body.name,
            users,
            image: imageUrl,
          });
          await group.save();

          res.status(200).json({
            success: true,
            message: "Group created successfully",
            group,
          });
        } catch (err: any) {
          res.status(500).json({
            success: false,
            message: "Error during group creation",
            error: err.message,
          });
        }
      }
    }
  ),
];

export const getGroupChatList = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const LIMIT = (Number(req.query.loadOffset) || 1) * 5;

    // @ts-ignore
    const userId = req.user._id;
    const result = await GroupModel.aggregate([
      {
        $match: {
          users: userId.toString(),
        },
      },
      {
        $lookup: {
          from: "messages",
          let: { groupId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$receiver", "$$groupId"],
                },
              },
            },
            {
              $sort: { createdAt: -1 },
            },
            {
              $limit: 1,
            },
            {
              $lookup: {
                from: "users",
                localField: "sender",
                foreignField: "_id",
                as: "senderDetails",
              },
            },
            {
              $unwind: {
                path: "$senderDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                sender: {
                  _id: "$senderDetails._id",
                  username: "$senderDetails.username",
                  img: "$senderDetails.img",
                },
                receiver: 1,
                content: 1,
                createdAt: 1,
              },
            },
          ],
          as: "latestMessage",
        },
      },
      {
        $unwind: {
          path: "$latestMessage",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: {
          "latestMessage.createdAt": -1,
          createdAt: -1,
        },
      },
      {
        $limit: LIMIT,
      },
      {
        $project: {
          users: 0,
        },
      },
    ]);

    res.status(200).json(result);
  }
);

export const getUserList = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user._id;
    const LIMIT = Number(req.query.loadOffset) * 10;
    const USERNAME = req.query.username;

    let query = {};

    if (USERNAME && typeof USERNAME === "string" && USERNAME.trim() !== "") {
      const escapedUsername = USERNAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      query = {
        username: {
          $regex: new RegExp(`^${escapedUsername}`, "i"),
        },
        _id: {
          $ne: userId,
        },
      };
    } else {
      query = {
        _id: {
          $ne: userId,
        },
      };
    }

    const users = await UserModel.find(query)
      .collation({ locale: "en", strength: 2 })
      .sort({ username: 1 })
      .limit(LIMIT);

    res.status(200).json(users);
  }
);

export const getGroupChatMessages = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const groupChat = req.query.groupChat;
    const skipAmount = Number(req.query.skipAmount);
    const LIMIT = 30;

    const messages = await MessageModel.find({
      receiver: groupChat,
    })
      .sort({ createdAt: -1 })
      .skip(skipAmount)
      .limit(LIMIT)
      .populate({
        path: "sender",
        select: "_id username img",
      })
      .exec();

    const sortedMessages = messages.reverse();
    if (messages.length === 0) res.status(200).json([]);
    else res.status(200).json(sortedMessages);
  }
);

export const getMessages = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const currentUser = req.query.user;
    const selectedUser = req.query.selectedUser;
    const skipAmount = Number(req.query.skipAmount);
    const LIMIT = 30;

    const messages = await MessageModel.find({
      $or: [
        { sender: currentUser, receiver: selectedUser },
        { sender: selectedUser, receiver: currentUser },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skipAmount)
      .populate("sender receiver")
      .limit(LIMIT)
      .exec();

    const sortedMessages = messages.reverse();
    if (messages.length === 0) res.status(200).json([]);
    else res.status(200).json(sortedMessages);
  }
);

export const getDatabaseUserDetails = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    //@ts-ignore
    await updateUserLastOnline(req.user._id);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(200).json({
        success: false,
        message: "User not found",
        user: null,
      });
      return;
    }

    const user = await UserModel.findById(req.params.id).exec();

    if (!user)
      res
        .status(200)
        .json({ success: false, message: "User not found", user: null });
    else res.status(200).json({ success: true, message: "User found", user });
  }
);

export const deleteMessage = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    //@ts-ignore
    await updateUserLastOnline(req.user._id);

    const messageId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(200).json({
        success: false,
        message: "Message not found",
      });
      return;
    } else {
      await MessageModel.findByIdAndDelete(messageId);
      res.sendStatus(204);
    }
  }
);
