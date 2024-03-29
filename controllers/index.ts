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
import GroupInterface from "../models/types/group";
import cloudinary from "../configs/cloudinary.config";
import uploadToCloudinary from "../utils/uploadToCloudinary";
import getPublicIdFromUrl from "../utils/getPublicIdFromUrl";
import MessageInterface from "../models/types/message";
dotenv.config();

export const userSignUpPost = [
  body("username")
    .customSanitizer((value) => decodeURIComponent(value))
    .trim()
    .notEmpty()
    .withMessage("Username must be specified")
    .isLength({ max: 25 })
    .withMessage("Username can't exceed 25 characters")
    .custom(async (value) => {
      const user = await UserModel.findOne({ username: value });
      if (user) throw new Error("Username already exists");
    }),
  body("password")
    .customSanitizer((value) => decodeURIComponent(value))
    .trim()
    .notEmpty()
    .withMessage("Password must be specified")
    .isLength({ max: 100 })
    .withMessage("Password can't exceed 100 characters"),
  body("passwordConfirmation")
    .customSanitizer((value) => decodeURIComponent(value))
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
    .customSanitizer((value) => decodeURIComponent(value))
    .trim()
    .notEmpty()
    .withMessage("Username must be specified")
    .isLength({ max: 25 })
    .withMessage("Username can't exceed 25 characters")
    .custom(async (value) => {
      const user = await UserModel.findOne({ username: value });
      if (!user) throw new Error("Username doesn't exist");
    }),
  body("password")
    .customSanitizer((value) => decodeURIComponent(value))
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
    req.session.destroy((err: any) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
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
    const searchValue = req.query.searchValue;

    let regex;

    if (typeof searchValue === "string" && searchValue.trim() !== "") {
      const escapedSearchValue = searchValue.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      regex = new RegExp(`^${escapedSearchValue}`, "i");
    }

    // @ts-ignore
    const userId = req.user._id;
    const result = await UserModel.aggregate([
      {
        $match: {
          _id: { $ne: userId },
          ...(regex && {
            username: { $regex: regex },
          }),
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
                images: 1,
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
          lastOnline: -1,
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

export const getChatListChat = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const chatId = req.params.id;

    // @ts-ignore
    const userId = req.user._id;

    const result = await UserModel.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(chatId),
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
                images: 1,
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
          lastOnline: -1,
        },
      },
      {
        $project: {
          password: 0,
        },
      },
    ]);

    if (result.length) res.status(200).json(result[0]);
    else res.sendStatus(404);
  }
);

export const getGroupChat = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    //@ts-ignore
    await updateUserLastOnline(req.user._id);

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
    .customSanitizer((value) => decodeURIComponent(value))
    .trim()
    .notEmpty()
    .withMessage("Name must be specified")
    .isLength({ max: 25 })
    .withMessage("Name can't exceed 25 characters"),
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
      const io = req.app.get("socketio");
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
          if (req.file) {
            const uploadedImage = await uploadToCloudinary(
              {
                resource_type: "image",
                folder: "group_avatars",
              },
              req.file.buffer
            );

            if (uploadedImage) {
              imageUrl = uploadedImage.secure_url;
            }
          }
          // @ts-ignore
          const userId = req.user._id;
          const users = [userId, ...req.body.users];
          const groupChat = new GroupModel({
            name: req.body.name,
            creator: userId,
            users,
            image: imageUrl,
          });
          await groupChat.save();

          groupChat.users.forEach((user) => {
            io.to(user).emit("group-chat-added", {
              message: `You've been added to the '${groupChat.name}' group chat.`,
              groupChat,
            });
          });

          res.status(200).json({
            success: true,
            message: "Group created successfully",
            groupChat,
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

export const editGroupChat = [
  check("name")
    .customSanitizer((value) => decodeURIComponent(value))
    .trim()
    .notEmpty()
    .withMessage("Name must be specified")
    .isLength({ max: 25 })
    .withMessage("Name can't exceed 25 characters"),
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
      const io = req.app.get("socketio");
      //@ts-ignore
      await updateUserLastOnline(req.user._id);
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
          if (req.file) {
            const uploadedImage = await uploadToCloudinary(
              {
                resource_type: "image",
                folder: "group_avatars",
              },
              req.file.buffer
            );

            if (uploadedImage) {
              imageUrl = uploadedImage.secure_url;
            }
          }

          const prevGroupChat: GroupInterface = (await GroupModel.findById(
            req.body._id
          )
            .lean()
            .exec())!;

          // @ts-ignore
          const userId = req.user._id;
          const users = [userId, ...req.body.users];
          let updatedGroup;
          if (imageUrl)
            updatedGroup = (await GroupModel.findByIdAndUpdate(
              req.body._id,
              {
                name: req.body.name,
                users,
                image: imageUrl,
              },
              { new: true }
            ).exec())!;
          else
            updatedGroup = (await GroupModel.findByIdAndUpdate(
              req.body._id,
              {
                name: req.body.name,
                users,
              },
              { new: true }
            ).exec())!;

          const updatedGroupObject: GroupInterface = updatedGroup.toObject();

          if (updatedGroup) {
            if (req.body.prevImageId && req.file)
              await cloudinary.uploader.destroy(req.body.prevImageId);

            io.to(updatedGroupObject._id.toString()).emit(
              "receive-edit-group-chat",
              updatedGroupObject
            );

            const removedUsers = prevGroupChat.users.filter(
              (user) => !updatedGroupObject.users.includes(user)
            );

            const newUsers = updatedGroupObject.users.filter(
              (user) => !prevGroupChat.users.includes(user)
            );

            removedUsers.forEach((user) => {
              io.to(user).emit("group-chat-removed", {
                message: `You've been removed from the '${updatedGroupObject.name}' group chat.`,
                groupChat: updatedGroupObject,
              });
            });

            newUsers.forEach((user) => {
              io.to(user).emit("group-chat-added", {
                message: `You've been added to the '${updatedGroupObject.name}' group chat.`,
                groupChat: updatedGroupObject,
              });
            });

            updatedGroupObject.users.forEach((user) => {
              io.to(user).emit(
                "receive-edit-group-chat-list",
                updatedGroupObject
              );
            });

            res.status(200).json({
              success: true,
              message: "Group created successfully",
              groupChat: updatedGroup,
            });
          }
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

export const deleteGroupChat = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const io = req.app.get("socketio");
    //@ts-ignore
    await updateUserLastOnline(req.user._id);

    const groupChatId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(groupChatId)) {
      res.status(200).json({
        success: false,
        message: "Group chat not found",
      });
      return;
    } else {
      const deletedGroupChat: GroupInterface | null = await GroupModel.findById(
        groupChatId
      ).lean();
      if (deletedGroupChat?.image) {
        const imageId = getPublicIdFromUrl(deletedGroupChat.image);
        await cloudinary.uploader.destroy(imageId);
      }
      await GroupModel.findByIdAndDelete(groupChatId);

      if (deletedGroupChat) {
        io.to(deletedGroupChat._id.toString()).emit(
          "receive-delete-group-chat",
          deletedGroupChat
        );

        deletedGroupChat.users.forEach((user) => {
          io.to(user).emit("group-chat-deleted", {
            message: `The group chat '${deletedGroupChat.name}' has been deleted by the creator of the group. `,
            groupChat: deletedGroupChat,
          });
        });
      }

      const messagesToDelete: MessageInterface[] = await MessageModel.find({
        receiver: groupChatId,
      });

      for (const message of messagesToDelete) {
        if (message.images && message.images.length > 0) {
          for (const image of message.images) {
            const imageId = getPublicIdFromUrl(image.url);
            await cloudinary.uploader.destroy(imageId);
          }
        }
      }

      await MessageModel.deleteMany({ receiver: groupChatId });

      res.sendStatus(204);
    }
  }
);

export const getGroupChatList = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const LIMIT = (Number(req.query.loadOffset) || 1) * 5;
    const searchValue = req.query.searchValue;

    let regex;

    if (typeof searchValue === "string" && searchValue.trim() !== "") {
      const escapedSearchValue = searchValue.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      regex = new RegExp(`^${escapedSearchValue}`, "i");
    }

    // @ts-ignore
    const userId = req.user._id;
    const result = await GroupModel.aggregate([
      {
        $match: {
          users: userId.toString(),
          ...(regex && {
            name: { $regex: regex },
          }),
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
                images: 1,
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

export const getGroupChatListChat = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const groupId = req.params.id;

    const result = await GroupModel.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(groupId),
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
                images: 1,
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
        $project: {
          users: 0,
        },
      },
    ]);

    if (result.length) res.status(200).json(result[0]);
    else res.sendStatus(404);
  }
);

export const getUserList = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore
    const userId = req.user._id;
    const LIMIT = Number(req.query.loadOffset) * 10;
    const USERNAME = req.query.username;
    const userList = req.query.userList;
    const excludeUser = req.query.excludeUser;
    let allUsers;

    let query: any = {
      _id: {
        $nin: [userId],
      },
    };

    if (excludeUser && excludeUser !== "") {
      query._id.$nin.push(excludeUser);
    }

    if (USERNAME && typeof USERNAME === "string" && USERNAME.trim() !== "") {
      const escapedUsername = USERNAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.username = {
        $regex: new RegExp(`^${escapedUsername}`, "i"),
      };
    } else if (Array.isArray(userList) && userList.length > 0) {
      const userIds = (userList as string[]).map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      query._id.$in = userIds;
    }

    const fetchedUsers = await UserModel.find(query)
      .collation({ locale: "en", strength: 2 })
      .sort({ username: 1 })
      .limit(LIMIT);

    const remainingLimit = LIMIT - fetchedUsers.length;

    if (
      remainingLimit > 0 &&
      !(USERNAME && typeof USERNAME === "string" && USERNAME.trim() !== "")
    ) {
      let additionalQuery: any = {
        _id: {
          $nin: [userId, ...fetchedUsers.map((user) => user._id)],
        },
      };

      if (excludeUser && excludeUser !== "") {
        additionalQuery._id.$nin.push(excludeUser);
      }

      const additionalUsers = await UserModel.find(additionalQuery)
        .collation({ locale: "en", strength: 2 })
        .sort({ username: 1 })
        .limit(remainingLimit);

      allUsers = [...fetchedUsers, ...additionalUsers];
    } else {
      allUsers = fetchedUsers;
    }

    res.status(200).json(allUsers);
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

export const createMessage = [
  check("message").customSanitizer((value) => decodeURIComponent(value)),
  check("sender").customSanitizer((value) => decodeURIComponent(value)),
  check("receiver").customSanitizer((value) => decodeURIComponent(value)),
  check("roomId").customSanitizer((value) => decodeURIComponent(value)),
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const io = req.app.get("socketio");
      try {
        //@ts-ignore
        await updateUserLastOnline(req.user._id);
        const { sender, receiver, message, sendingIndicatorId, roomId } =
          req.body;

        let { createdAt } = req.body;

        if (message) {
          const messageObject = new MessageModel({
            sender,
            receiver,
            content: message,
            createdAt,
          });

          await messageObject.save();

          const retrievedMessage: MessageInterface =
            (await MessageModel.findById(messageObject._id)
              .populate("sender receiver")
              .lean()
              .exec())!;

          io.to(roomId).emit("receive-message", retrievedMessage);

          io.to(retrievedMessage.receiver._id.toString()).emit("get-new-chat", {
            ...retrievedMessage.sender,
            latestMessage: retrievedMessage,
          });

          io.to(retrievedMessage.sender._id.toString()).emit("get-new-chat", {
            ...retrievedMessage.receiver,
            latestMessage: retrievedMessage,
          });
        }
        const files = req.files as Express.Multer.File[] | undefined;

        if (files && files.length > 0) {
          const images = [];

          for (const image of files) {
            const uploadedImage = await uploadToCloudinary(
              {
                resource_type: "image",
                folder: "messages",
              },
              image.buffer
            );

            if (uploadedImage) {
              const { width, height, secure_url } = uploadedImage;
              images.push({ width, height, url: secure_url });
            }
          }
          //If text message exists show image(s) message first
          if (message) {
            let currentTimestampNumeric = parseInt(createdAt);

            let newTimestampNumeric = currentTimestampNumeric - 1;

            createdAt = newTimestampNumeric.toString();
          }

          const messageObject = new MessageModel({
            sender,
            receiver,
            images,
            createdAt,
            sendingIndicatorId,
          });
          await messageObject.save();

          const retrievedMessage: MessageInterface =
            (await MessageModel.findById(messageObject._id)
              .populate("sender receiver")
              .lean()
              .exec())!;

          io.to(roomId).emit("receive-message", retrievedMessage);

          io.to(retrievedMessage.receiver._id.toString()).emit("get-new-chat", {
            ...retrievedMessage.sender,
            latestMessage: retrievedMessage,
          });

          io.to(retrievedMessage.sender._id.toString()).emit("get-new-chat", {
            ...retrievedMessage.receiver,
            latestMessage: retrievedMessage,
          });
        }
        res.sendStatus(200);
      } catch (err: any) {
        res.status(500).json({
          success: false,
          message: "Error during message sending",
          error: err.message,
        });
      }
    }
  ),
];

export const createGroupMessage = [
  check("message").customSanitizer((value) => decodeURIComponent(value)),
  check("sender").customSanitizer((value) => decodeURIComponent(value)),
  check("receiver").customSanitizer((value) => decodeURIComponent(value)),
  check("roomId").customSanitizer((value) => decodeURIComponent(value)),
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const io = req.app.get("socketio");
      try {
        //@ts-ignore
        await updateUserLastOnline(req.user._id);
        const { sender, receiver, message, roomId, sendingIndicatorId } =
          req.body;

        let { createdAt } = req.body;

        if (message) {
          const messageObject = new MessageModel({
            sender,
            receiver,
            content: message,
            createdAt,
          });

          await messageObject.save();

          const retrievedMessage: MessageInterface =
            (await MessageModel.findById(messageObject._id)
              .populate({
                path: "sender",
                select: "_id username img",
              })
              .lean()
              .exec())!;

          io.to(roomId).emit("receive-group-message", retrievedMessage);

          const group: GroupInterface = (await GroupModel.findById(
            messageObject.receiver
          ).lean())!;

          group.users.forEach((user) => {
            io.to(user).emit("get-new-group-chat", {
              ...group,
              latestMessage: retrievedMessage,
            });
          });
        }
        const files = req.files as Express.Multer.File[] | undefined;

        if (files && files.length > 0) {
          const images = [];

          for (const image of files) {
            const uploadedImage = await uploadToCloudinary(
              {
                resource_type: "image",
                folder: "messages",
              },
              image.buffer
            );

            if (uploadedImage) {
              const { width, height, secure_url } = uploadedImage;
              images.push({ width, height, url: secure_url });
            }
          }

          //If text message exists show image(s) message first
          if (message) {
            let currentTimestampNumeric = parseInt(createdAt);

            let newTimestampNumeric = currentTimestampNumeric - 1;

            createdAt = newTimestampNumeric.toString();
          }

          const messageObject = new MessageModel({
            sender,
            receiver,
            images,
            createdAt,
            sendingIndicatorId,
          });
          await messageObject.save();

          const retrievedMessage: MessageInterface =
            (await MessageModel.findById(messageObject._id)
              .populate({
                path: "sender",
                select: "_id username img",
              })
              .lean()
              .exec())!;

          io.to(roomId).emit("receive-group-message", retrievedMessage);

          const group: GroupInterface = (await GroupModel.findById(
            messageObject.receiver
          ).lean())!;

          group.users.forEach((user) => {
            io.to(user).emit("get-new-group-chat", {
              ...group,
              latestMessage: retrievedMessage,
            });
          });
        }
        res.sendStatus(200);
      } catch (err: any) {
        res.status(500).json({
          success: false,
          message: "Error during message sending",
          error: err.message,
        });
      }
    }
  ),
];

export const deleteMessage = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const io = req.app.get("socketio");
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
      const message: MessageInterface = (await MessageModel.findById(messageId)
        .populate("sender receiver")
        .lean())!;

      if (message.images && message.images.length > 0) {
        for (const image of message.images) {
          const imageId = getPublicIdFromUrl(image.url);
          await cloudinary.uploader.destroy(imageId);
        }
      }

      await MessageModel.findByIdAndDelete(messageId);

      io.to(message.receiver._id.toString()).emit("message-deleted", message);
      io.to(message.sender._id.toString()).emit("message-deleted", message);
      io.to(message.receiver._id.toString()).emit(
        "message-deleted-chat-list",
        message
      );

      io.to(message.sender._id.toString()).emit(
        "message-deleted-chat-list",
        message
      );

      res.sendStatus(204);
    }
  }
);

export const deleteGroupMessage = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const io = req.app.get("socketio");
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
      const message: MessageInterface = (await MessageModel.findById(
        messageId
      ))!;

      if (message.images && message.images.length > 0) {
        for (const image of message.images) {
          console.log(image);
          const imageId = getPublicIdFromUrl(image.url);
          await cloudinary.uploader.destroy(imageId);
        }
      }

      await MessageModel.findByIdAndDelete(messageId);

      io.to(message.receiver.toString()).emit("group-message-deleted", message);

      const group: GroupInterface = (await GroupModel.findById(
        message.receiver
      ).lean())!;

      group.users.forEach((user) => {
        io.to(user).emit("group-message-deleted-group-chat-list", message);
      });

      res.sendStatus(204);
    }
  }
);

export const editUserDetails = [
  check("username")
    .customSanitizer((value) => decodeURIComponent(value))
    .trim()
    .notEmpty()
    .withMessage("Username must be specified")
    .isLength({ max: 25 })
    .withMessage("Username can't exceed 25 characters")
    .custom(async (value, { req }) => {
      if (value === req.user.username) {
        return true;
      }
      const user = await UserModel.findOne({ username: value });
      if (user) throw new Error("Username already exists");
    }),
  check("bio")
    .customSanitizer((value) => decodeURIComponent(value))
    .trim()
    .isLength({ max: 100 })
    .withMessage("Bio can't exceed 100 characters"),
  check("image").custom((value, { req }) => {
    if (value) {
      if (!req.file || !req.file.mimetype.startsWith("image/")) {
        throw new Error("Please upload a valid image file");
      } else return true;
    } else return true;
  }),
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      //@ts-ignore
      await updateUserLastOnline(req.user._id);

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
          message: "User edit failed",
          errors: errors.array(),
        });
      }
      // @ts-ignore
      else if (req.user._id.toString() !== req.params.id) {
        res.status(400).json({
          success: false,
          message: "Cannot edit other user",
          errors: errors.array(),
        });
      } else {
        try {
          let imageUrl = null;
          if (req.file) {
            const uploadedImage = await uploadToCloudinary(
              {
                resource_type: "image",
                folder: "profile_pics",
              },
              req.file.buffer
            );

            if (uploadedImage) {
              imageUrl = uploadedImage.secure_url;
            }
          }

          let updatedUser;

          if (imageUrl)
            updatedUser = await UserModel.findByIdAndUpdate(
              req.params.id,
              {
                username: req.body.username,
                img: imageUrl,
                bio: req.body.bio,
              },
              { new: true }
            ).exec();
          else
            updatedUser = await UserModel.findByIdAndUpdate(
              req.params.id,
              {
                username: req.body.username,
                bio: req.body.bio,
              },
              { new: true }
            ).exec();

          if (updatedUser) {
            if (req.body.prevImageId && req.file)
              await cloudinary.uploader.destroy(req.body.prevImageId);

            res.status(200).json({
              success: true,
              message: "User profile edited successfully",
              user: updatedUser,
            });
          }
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
