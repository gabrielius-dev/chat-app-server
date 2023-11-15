import request from "supertest";
import UserModel from "../../models/user";
import createServer from "../../server";
import { Server } from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
const session = require("supertest-session");
dotenv.config();

let testServer: Server;

beforeAll(async () => {
  const { app } = createServer();
  testServer = app.listen(1234, () => {
    console.log(`Test Server is Fire at http://localhost:1234`);
  });
  if (process.env.MONGODB_URI) await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  testServer.close();
  await mongoose.connection.close();
});

describe("POST /sign-up", () => {
  // UNIT TESTS THAT DON'T COMMUNICATE WITH DATABASE
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

    it("Username can't exceed 100 characters", async () => {
      const user = {
        username:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
        "Username can't exceed 100 characters"
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

  // INTEGRATION TESTS WITH REAL DATABASE
  // TAKES SOME TIME
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

  // UNIT TESTS THAT DON'T COMMUNICATE WITH DATABASE
  describe("Unit tests that don't communicate with database", () => {
    it("Username can't exceed 100 characters", async () => {
      const user = {
        username:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
        "Username can't exceed 100 characters"
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

  // INTEGRATION TESTS WITH REAL DATABASE
  // TAKES SOME TIME
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
    const response = await request(testServer)
      .post("/login")
      .send(user)
      .set("Accept", "application/json");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message", "Login successful");

    const response2 = await request(testServer)
      .post("/logout")
      .send(user)
      .set("Accept", "application/json");

    expect(response2.status).toBe(200);
    expect(response2.body).toHaveProperty("message", "Log out successful");
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
