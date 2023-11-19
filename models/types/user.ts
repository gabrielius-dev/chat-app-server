export default interface UserInterface {
  username: string;
  password: string;
  _id: string;
  lastOnline: Date;
  online: boolean;
  img?: string;
}
