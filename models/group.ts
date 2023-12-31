import { Schema, model } from "mongoose";
import GroupInterface from "./types/group";

const groupSchema = new Schema(
  {
    name: { type: String, required: true, maxLength: 25 },
    image: String,
    users: { type: [String], required: true },
    createdAt: { type: Date, default: Date.now },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { versionKey: false }
);

const GroupModel = model<GroupInterface & Document>("Group", groupSchema);

export default GroupModel;
