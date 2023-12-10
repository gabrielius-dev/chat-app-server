import UserModel from "../models/user";

export async function updateUserLastOnline(id: String) {
  await UserModel.findByIdAndUpdate(id, {
    lastOnline: Date.now(),
    online: true,
  });
}
