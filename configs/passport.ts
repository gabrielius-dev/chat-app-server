import passport from "passport";
import User from "../models/user";
import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";
import { CustomVerifyOptions } from "./types/passport";

function initializePassport() {
  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        const user = await User.findOne({ username });
        if (!user) {
          const customOptions: CustomVerifyOptions = {
            success: false,
            message: "Username doesn't exist",
            path: "username",
          };
          return done(null, false, customOptions);
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          const customOptions: CustomVerifyOptions = {
            success: false,
            message: "Incorrect password",
            path: "password",
          };
          return done(null, false, customOptions);
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, (user as any)._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

export default initializePassport;
