import UserInterface from "./user";

export default interface GroupInterface {
  name: string;
  _id: string;
  image?: string;
  users: UserInterface[];
  createdAt: Date;
  creator: string;
}
