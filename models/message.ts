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
    content: { type: String },
    images: { type: [imageSchema] },
    createdAt: { type: Date, default: Date.now },
    sendingIndicatorId: { type: String, default: undefined, unique: true },
  },
  { versionKey: false }
);

const MessageModel = model<MessageInterface & Document>(
  "Message",
  messageSchema
);

export default MessageModel;
