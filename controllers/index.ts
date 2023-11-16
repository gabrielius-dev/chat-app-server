import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import UserModel from "../models/user";
import expressAsyncHandler from "express-async-handler";
import passport from "passport";
import UserInterface from "../models/types/user";

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

        req.login(user, (err) => {
          if (err) return next(err);
          res.status(200).json({
            success: true,
            message: "Sign up successful",
            user,
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
          req.login(user, (err) => {
            if (err) {
              return next(err);
            }
            return res
              .status(200)
              .json({ success: true, message: "Login successful", user });
          });
        })(req, res, next);
      }
    }
  ),
];

export const userLogOutPost = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
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
      res.status(200).json({
        success: true,
        message: "User found",
        user: req.user,
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

export const getUserList = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const skipAmount = ((Number(req.query.loadOffset) || 1) - 1) * 10;
    const userList = await UserModel.find(
      { _id: { $ne: req.query.userId } },
      "-password"
    )
      .skip(skipAmount)
      .limit(10)
      .exec();

    res.status(200).json({ userList });
  }
);
