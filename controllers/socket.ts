import { Socket } from "socket.io";
import { ExtendedError } from "socket.io/dist/namespace";
import { io } from "..";
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

  socket.on("create-group-chat", async (groupChat: GroupInterface) => {
    groupChat.users.forEach((user) => {
      io.to(user).emit("group-chat-added", {
        message: `You've been added to the '${groupChat.name}' group chat.`,
        groupChat,
      });
    });
  });

  socket.on(
    "edit-group-chat",
    async (groupChat: GroupInterface, prevGroupChat: GroupInterface) => {
      io.to(groupChat._id).emit("receive-edit-group-chat", groupChat);

      const removedUsers = prevGroupChat.users.filter(
        (user) => !groupChat.users.includes(user)
      );

      const newUsers = groupChat.users.filter(
        (user) => !prevGroupChat.users.includes(user)
      );

      removedUsers.forEach((user) => {
        io.to(user).emit("group-chat-removed", {
          message: `You've been removed from the '${groupChat.name}' group chat.`,
          groupChat,
        });
      });

      newUsers.forEach((user) => {
        io.to(user).emit("group-chat-added", {
          message: `You've been added to the '${groupChat.name}' group chat.`,
          groupChat,
        });
      });

      io.to(`group-chat-list-${groupChat._id}`).emit(
        "receive-edit-group-chat-list",
        groupChat
      );
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
};
