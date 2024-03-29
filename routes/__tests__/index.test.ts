import request from "supertest";
import UserModel from "../../models/user";
import { Server } from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import createTestServer from "../../testServer";
const session = require("supertest-session");
import { MongoMemoryServer } from "mongodb-memory-server";
import MessageModel from "../../models/message";
dotenv.config();

let testServer: Server;
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const app = createTestServer();
  testServer = app.listen(1234, () => {
    console.log(`Test Server is Fire at http://localhost:1234`);
  });
});

afterAll(async () => {
  await mongod.stop();
  await mongoose.disconnect();
  testServer.close();
});

describe("POST /sign-up", () => {
  describe("Unit tests that don't communicate with database", () => {
    it("Passwords don't match", async () => {
      const user = {
        username: "test_username",
        password: "test_password",
        passwordConfirmation: "test_passwor",
      };

      const response = await request(testServer)
        .post("/sign-up")
        .send(user)
        .set("Accept", "application/json");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Sign up failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Passwords don't match"
      );
    });

    it("Username can't exceed 25 characters", async () => {
      const user = {
        username: "aaaaaaaaaaaaaaaaaaaaaaaaaa",
        password: "test_password",
        passwordConfirmation: "test_password",
      };

      const response = await request(testServer)
        .post("/sign-up")
        .send(user)
        .set("Accept", "application/json");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Sign up failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Username can't exceed 25 characters"
      );
    });

    it("Passwords can't exceed 100 characters", async () => {
      const user = {
        username: "test_username",
        password:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        passwordConfirmation:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      };

      const response = await request(testServer)
        .post("/sign-up")
        .send(user)
        .set("Accept", "application/json");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Sign up failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Password can't exceed 100 characters"
      );
      expect(response.body.errors[1]).toHaveProperty(
        "message",
        "Password confirmation can't exceed 100 characters"
      );
    });
  });

  describe("Integration tests with real database", () => {
    afterEach(async () => {
      await request(testServer).post("/logout");
    });

    it("Should successfully sign up a user", async () => {
      const user = {
        username: "test_username",
        password: "test_password",
        passwordConfirmation: "test_password",
      };
      const response = await request(testServer)
        .post("/sign-up")
        .send(user)
        .set("Accept", "application/json");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Sign up successful");

      await UserModel.findByIdAndDelete(response.body.user);
    });

    it("Username already exists in the database", async () => {
      const databaseUser = new UserModel({
        username: "test_username",
        password: "test_password",
      });
      await databaseUser.save();

      const user = {
        username: "test_username",
        password: "test_password",
        passwordConfirmation: "test_password",
      };

      const response = await request(testServer)
        .post("/sign-up")
        .send(user)
        .set("Accept", "application/json");
      await UserModel.findByIdAndDelete(databaseUser);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Sign up failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Username already exists"
      );
    });
  });
});

describe("POST /login", () => {
  let databaseUser: mongoose.Document;
  beforeAll(async () => {
    // Hashed password from bcrypt
    databaseUser = new UserModel({
      username: "testing_username",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser.save();
  });

  afterAll(async () => {
    await UserModel.findByIdAndDelete(databaseUser);
  });

  describe("Unit tests that don't communicate with database", () => {
    it("Username can't exceed 25 characters", async () => {
      const user = {
        username: "aaaaaaaaaaaaaaaaaaaaaaaaaa",
        password: "test_password",
      };

      const response = await request(testServer)
        .post("/login")
        .send(user)
        .set("Accept", "application/json");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Login failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Username can't exceed 25 characters"
      );
    });

    it("Password can't exceed 100 characters", async () => {
      const user = {
        username: "testing_username",
        password:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      };

      const response = await request(testServer)
        .post("/login")
        .send(user)
        .set("Accept", "application/json");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Login failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Password can't exceed 100 characters"
      );
    });
  });

  describe("Integration tests with real database", () => {
    afterEach(async () => {
      await request(testServer).post("/logout");
    });

    it("Should successfully login a user", async () => {
      const user = {
        username: "testing_username",
        password: "testing_password",
      };
      const response = await request(testServer)
        .post("/login")
        .send(user)
        .set("Accept", "application/json");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Login successful");
    });

    it("Username doesn't exist in the database", async () => {
      const user = {
        username: "fake_username",
        password: "fake_password",
      };

      const response = await request(testServer)
        .post("/login")
        .send(user)
        .set("Accept", "application/json");
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Login failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Username doesn't exist"
      );
    });

    it("Incorrect password", async () => {
      const user = {
        username: "testing_username",
        password: "wrong_password",
      };

      const response = await request(testServer)
        .post("/login")
        .send(user)
        .set("Accept", "application/json");
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message", "Login failed");
      expect(response.body.errors[0]).toHaveProperty(
        "message",
        "Incorrect password"
      );
    });
  });
});

describe("POST /logout", () => {
  let databaseUser: mongoose.Document;
  beforeAll(async () => {
    // Hashed password from bcrypt
    databaseUser = new UserModel({
      username: "testing_username",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser.save();
  });

  afterAll(async () => {
    await UserModel.findByIdAndDelete(databaseUser);
  });

  it("Logs out user successfully", async () => {
    const user = {
      username: "testing_username",
      password: "testing_password",
    };
    const testSession = session(testServer);

    const response = await testSession
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");

    const response2 = await testSession
      .post("/logout")
      .send(user)
      .set("Accept", "application/json");

    expect(response2.status).toBe(200);
  });
});

describe("GET /user", () => {
  it("User is logged in and details are retrieved", async () => {
    const testSession = session(testServer);

    const databaseUser = new UserModel({
      username: "testing_username",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser.save();

    const user = {
      username: "testing_username",
      password: "testing_password",
    };
    const response2 = await testSession
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response2.status).toBe(200);
    expect(response2.body).toHaveProperty("message", "Login successful");

    const response = await testSession
      .get("/user")
      .set("Accept", "application/json");

    await UserModel.findByIdAndDelete(databaseUser);

    expect(response.status).toBe(200);
    expect(response.body.user).toHaveProperty("username", "testing_username");
  });
  it("User is not logged in, details not found", async () => {
    const response = await request(testServer)
      .get("/user")
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "User not found");
    expect(response.body.user).toBe(null);
  });
});

describe("GET /user/:id", () => {
  let databaseUser: mongoose.Document;
  let databaseUser1: mongoose.Document;

  beforeAll(async () => {
    // Hashed password from bcrypt
    databaseUser = new UserModel({
      username: "testing_username",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser.save();

    // Hashed password from bcrypt
    databaseUser1 = new UserModel({
      username: "testing_username1",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser1.save();
  });

  afterAll(async () => {
    await UserModel.findByIdAndDelete(databaseUser);
    await UserModel.findByIdAndDelete(databaseUser1);
  });

  it("User doesn't exist", async () => {
    const user = {
      username: "testing_username",
      password: "testing_password",
    };
    const testSession = session(testServer);

    const response = await testSession
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");

    const response1 = await testSession
      .get("/user/FAKE_ID")
      .set("Accept", "application/json");

    expect(response1.status).toBe(200);
    expect(response1.body).toHaveProperty("message", "User not found");
    expect(response1.body.user).toBe(null);
  });

  it("User exists", async () => {
    const user = {
      username: "testing_username",
      password: "testing_password",
    };
    const testSession = session(testServer);

    const response = await testSession
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");

    const response1 = await testSession
      .get(`/user/${databaseUser1._id}`)
      .set("Accept", "application/json");

    expect(response1.status).toBe(200);
    expect(response1.body).toHaveProperty("message", "User found");
    expect(response1.body.user).not.toBe(null);
  });
});

describe("GET /chatList", () => {
  let databaseUser: mongoose.Document;
  let databaseUser1: mongoose.Document;

  beforeAll(async () => {
    // Hashed password from bcrypt
    databaseUser = new UserModel({
      username: "testing_username",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser.save();

    // Hashed password from bcrypt
    databaseUser1 = new UserModel({
      username: "testing_username1",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser1.save();
  });

  afterAll(async () => {
    await UserModel.findByIdAndDelete(databaseUser);
    await UserModel.findByIdAndDelete(databaseUser1);
  });

  it("Retrieves user list correctly", async () => {
    const user = {
      username: "testing_username",
      password: "testing_password",
    };
    const testSession = session(testServer);

    const response = await testSession
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");

    const response1 = await testSession
      .get("/chat-list")
      .set("Accept", "application/json");

    expect(response1.status).toBe(200);

    const userWithoutPassword = { ...databaseUser1.toObject() };
    delete userWithoutPassword.password;
    userWithoutPassword._id = userWithoutPassword._id.toString();
    userWithoutPassword.lastOnline =
      userWithoutPassword.lastOnline.toISOString();

    expect(response1.body).toEqual([userWithoutPassword]);
  });
});

describe("GET /messages", () => {
  let databaseUser: mongoose.Document;
  let databaseUser1: mongoose.Document;

  beforeAll(async () => {
    // Hashed password from bcrypt
    databaseUser = new UserModel({
      username: "testing_username",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser.save();

    // Hashed password from bcrypt
    databaseUser1 = new UserModel({
      username: "testing_username1",
      password: "$2b$10$ef2EuqL5GPBnl7LNf5GP9.eLjpgdMr9ukpwG5t3fe91uA7oohiRre",
    });
    await databaseUser1.save();
  });

  afterAll(async () => {
    await UserModel.findByIdAndDelete(databaseUser);
    await UserModel.findByIdAndDelete(databaseUser1);
  });

  it("Empty messages array", async () => {
    const testSession = session(testServer);

    const user = {
      username: "testing_username",
      password: "testing_password",
    };
    const response = await testSession
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");

    const response1 = await testSession
      .get("/messages")
      .set("Accept", "application/json");

    expect(response1.status).toBe(200);
    expect(response1.body).toEqual([]);
  });

  it("Retrieves messages", async () => {
    const testSession = session(testServer);

    const user = {
      username: "testing_username",
      password: "testing_password",
    };
    const response = await testSession
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");

    const message = new MessageModel({
      sender: databaseUser._id,
      receiver: databaseUser1._id,
      content: "Hello test",
    });

    await message.save();

    const retrievedMessage = (
      await MessageModel.findById(message._id)
        .populate("sender receiver")
        .exec()
    )?.toObject();

    const response1 = await testSession
      .get(
        `/messages?user=${databaseUser._id}&selectedUser=${databaseUser1._id}&skipAmount=0`
      )
      .set("Accept", "application/json");

    expect(response1.status).toBe(200);

    const fixedMessage = {
      ...retrievedMessage,
      _id: retrievedMessage?._id.toString(),
      createdAt: retrievedMessage?.createdAt.toISOString(),
      receiver: {
        ...retrievedMessage?.receiver,
        _id: retrievedMessage?.receiver._id.toString(),
        lastOnline: retrievedMessage?.receiver.lastOnline.toISOString(),
      },
      sender: {
        ...retrievedMessage?.sender,
        _id: retrievedMessage?.sender._id.toString(),
        lastOnline: retrievedMessage?.sender.lastOnline.toISOString(),
      },
    };

    expect(response1.body).toEqual([fixedMessage]);
  });
});
