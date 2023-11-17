export default interface MessageInterface {
  sender: string;
  receiver: string;
  _id: string;
  content: string;
  createdAt: Date;
}
