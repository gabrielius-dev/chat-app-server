import UserInterface from "./user";

export default interface MessageInterface {
  sender: UserInterface;
  receiver: UserInterface;
  _id: string;
  content: string;
  createdAt: Date;
}

interface SenderInterface {
  _id: string;
  img?: string;
  username: string;
}

export interface GroupMessageInterface {
  _id: string;
  content: string;
  createdAt: string;
  sender: SenderInterface;
  receiver: string;
}
