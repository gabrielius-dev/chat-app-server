import { Socket } from "socket.io";
import { ExtendedError } from "socket.io/dist/namespace";
import MessageModel from "../models/message";
import { io } from "..";
import UserModel from "../models/user";
import UserInterface from "../models/types/user";
import { updateUserLastOnline } from "../utils/updateUser";
import GroupModel from "../models/group";
import GroupInterface from "../models/types/group";
import MessageInterface, {
  GroupMessageInterface,
} from "../models/types/message";

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

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
  });

  socket.on(
    "delete-message",
    async (message: MessageInterface, latestMessage: MessageInterface) => {
      if (io.sockets.adapter.rooms.get(message.receiver._id.toString())) {
        socket
          .to(message.receiver._id.toString())
          .emit("message-deleted", message);
        socket
          .to(message.receiver._id.toString())
          .emit("message-deleted-chat-list", message, latestMessage);
      }
      if (io.sockets.adapter.rooms.get(message.sender._id.toString())) {
        io.to(message.sender._id.toString()).emit("message-deleted", message);
        io.to(message.sender._id.toString()).emit(
          "message-deleted-chat-list",
          message,
          latestMessage
        );
      }
    }
  );

  socket.on(
    "delete-group-message",
    async (
      message: GroupMessageInterface,
      latestMessage: GroupMessageInterface
    ) => {
      if (io.sockets.adapter.rooms.get(message.receiver.toString())) {
        io.to(message.receiver.toString()).emit(
          "group-message-deleted",
          message
        );
      }
      if (
        io.sockets.adapter.rooms.get(
          `group-chat-list-${message.receiver.toString()}`
        )
      ) {
        io.to(`group-chat-list-${message.receiver.toString()}`).emit(
          "group-message-deleted-group-chat-list",
          message,
          latestMessage
        );
      }
    }
  );

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

      const retrievedMessage = await MessageModel.findById(messageObject._id)
        .populate("sender receiver")
        .exec();

      io.to(roomId).emit("receive-message", retrievedMessage);

      if (io.sockets.adapter.rooms.get(messageObject.receiver.toString())) {
        const user: UserInterface = (await UserModel.findById(
          messageObject.sender
        ).lean())!;
        socket
          .to(messageObject.receiver.toString())
          .emit("get-new-chat", { ...user, latestMessage: retrievedMessage });
      }

      if (io.sockets.adapter.rooms.get(messageObject.sender.toString())) {
        const user: UserInterface = (await UserModel.findById(
          messageObject.receiver
        ).lean())!;
        io.to(messageObject.sender.toString()).emit("get-new-chat", {
          ...user,
          latestMessage: retrievedMessage,
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

      if (
        io.sockets.adapter.rooms.get(
          `group-chat-list-${messageObject.receiver.toString()}`
        )
      ) {
        const group: GroupInterface = (await GroupModel.findById(
          messageObject.receiver
        ).lean())!;
        io.to(`group-chat-list-${messageObject.receiver.toString()}`).emit(
          "get-new-group-chat",
          {
            ...group,
            latestMessage: retrievedMessage,
          }
        );
      }
    }
  );

  socket.on("edit-group-chat", async (groupChat: GroupInterface) => {
    io.to(groupChat._id).emit("receive-edit-group-chat", groupChat);

    io.to(`group-chat-list-${groupChat._id}`).emit(
      "receive-edit-group-chat-list",
      groupChat
    );
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
};
