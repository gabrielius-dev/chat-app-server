export default interface GroupInterface {
  name: string;
  _id: string;
  image?: string;
  users: string[];
  createdAt: Date;
  creator: string;
}
