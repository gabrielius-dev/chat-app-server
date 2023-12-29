import { Schema, model } from "mongoose";
import GroupInterface from "./types/group";

const groupSchema = new Schema(
  {
    name: { type: String, required: true, maxLength: 100 },
    image: String,
    users: { type: [String], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const GroupModel = model<GroupInterface & Document>("Group", groupSchema);

export default GroupModel;
