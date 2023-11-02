import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import UserModel from "../models/user";
import expressAsyncHandler from "express-async-handler";

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
