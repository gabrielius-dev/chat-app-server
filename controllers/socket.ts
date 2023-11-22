import { Socket } from "socket.io";
import { ExtendedError } from "socket.io/dist/namespace";
import MessageModel from "../models/message";
import { io } from "..";
import UserModel from "../models/user";
import UserInterface from "../models/types/user";

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
          .emit("get-new-user", { ...user, latestMessage: messageObject });
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
};
