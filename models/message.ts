import { Schema, model } from "mongoose";
import MessageInterface from "./types/message";

const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const MessageModel = model<MessageInterface & Document>(
  "Message",
  messageSchema
);

export default MessageModel;
