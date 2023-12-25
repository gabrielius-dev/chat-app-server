import { Socket } from "socket.io";
import { ExtendedError } from "socket.io/dist/namespace";
import MessageModel from "../models/message";
import { io } from "..";
import UserModel from "../models/user";
import UserInterface from "../models/types/user";
import { updateUserLastOnline } from "../utils/updateUser";
import GroupModel from "../models/group";
import GroupInterface from "../models/types/group";

export const handleAuthentication = (
  socket: Socket,
  next: (err?: ExtendedError | undefined) => void
) => {
  const customSocket = socket as Socket & { request: { user?: any } };

  if (customSocket.request.user) {
    next();
  } else {
    next(new Error("unauthorized"));
  }
};

export const handleConnection = (socket: Socket) => {
  console.log("A user connected");

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
  });

  socket.on(
    "send-message",
    async (
      message: string,
      sender: string,
      receiver: string,
      roomId: string
    ) => {
      await updateUserLastOnline(sender);

      const messageObject = new MessageModel({
        sender,
        receiver,
        content: message,
      });
      await messageObject.save();

      io.to(roomId).emit("receive-message", messageObject);

      if (io.sockets.adapter.rooms.get(messageObject.receiver.toString())) {
        const user: UserInterface = (await UserModel.findById(
          messageObject.sender
        ).lean())!;
        socket
          .to(messageObject.receiver.toString())
          .emit("get-new-chat", { ...user, latestMessage: messageObject });
      }

      if (io.sockets.adapter.rooms.get(messageObject.sender.toString())) {
        const user: UserInterface = (await UserModel.findById(
          messageObject.receiver
        ).lean())!;
        io.to(messageObject.sender.toString()).emit("get-new-chat", {
          ...user,
          latestMessage: messageObject,
        });
      }
    }
  );

  socket.on(
    "send-group-message",
    async (
      message: string,
      sender: string,
      receiver: string,
      roomId: string
    ) => {
      await updateUserLastOnline(sender);

      const messageObject = new MessageModel({
        sender,
        receiver,
        content: message,
      });
      await messageObject.save();

      const retrievedMessage = await MessageModel.findById(messageObject._id)
        .populate({
          path: "sender",
          select: "_id username img",
        })
        .exec();

      io.to(roomId).emit("receive-group-message", retrievedMessage);

      if (io.sockets.adapter.rooms.get(messageObject.receiver.toString())) {
        const group: GroupInterface = (await GroupModel.findById(
          messageObject.receiver
        ).lean())!;
        io.to(messageObject.receiver.toString()).emit("get-new-group-chat", {
          ...group,
          latestMessage: retrievedMessage,
        });
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
};
