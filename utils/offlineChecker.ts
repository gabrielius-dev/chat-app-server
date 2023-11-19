import UserModel from "../models/user";

async function checkOfflineUsers() {
  const threshold = 2 * 60 * 1000;

  const offlineUsers = await UserModel.find({
    lastOnline: { $lt: new Date(Date.now() - threshold) },
    online: false,
  });

  await Promise.all(
    offlineUsers.map(async (user) => {
      user.online = false;
      await user.save();
    })
  );
}

export default checkOfflineUsers;
