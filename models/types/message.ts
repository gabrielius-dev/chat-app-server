import UserInterface from "./user";

export default interface MessageInterface {
  sender: UserInterface;
  receiver: UserInterface;
  _id: string;
  content?: string;
  createdAt: Date;
  images?: Image[];
}

interface Image {
  width: number;
  height: number;
  url: string;
}

interface SenderInterface {
  _id: string;
  img?: string;
  username: string;
}

export interface GroupMessageInterface {
  _id: string;
  content?: string;
  createdAt: string;
  sender: SenderInterface;
  receiver: string;
  images?: Image[];
}
