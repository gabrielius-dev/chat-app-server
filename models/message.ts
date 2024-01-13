import { Schema, model } from "mongoose";
import MessageInterface from "./types/message";

const imageSchema = new Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  url: { type: String, required: true },
});

const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: String,
    images: { type: [imageSchema] },
    createdAt: { type: Date, default: Date.now },
    sendingIndicatorId: String,
  },
  { versionKey: false }
);

const MessageModel = model<MessageInterface & Document>(
  "Message",
  messageSchema
);

export default MessageModel;
