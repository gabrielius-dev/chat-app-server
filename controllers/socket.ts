import { Socket } from "socket.io";
import { ExtendedError } from "socket.io/dist/namespace";
import MessageModel from "../models/message";
import { io } from "..";

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
    console.log(roomId);
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
      console.log(roomId);

      io.to(roomId).emit("receive-message", messageObject);
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
};
