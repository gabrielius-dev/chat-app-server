import { Schema, model } from "mongoose";
import UserInterface from "./types/user";

const userSchema = new Schema(
  {
    username: { type: String, required: true, maxLength: 25 },
    password: { type: String, required: true, maxLength: 100 },
    img: String,
    bio: { type: String, maxLength: 100 },
    lastOnline: { type: Date, default: Date.now },
    online: { type: Boolean, default: true },
  },
  { versionKey: false }
);

const UserModel = model<UserInterface & Document>("User", userSchema);

export default UserModel;
