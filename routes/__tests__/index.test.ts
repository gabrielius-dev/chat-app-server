import request from "supertest";
import UserModel from "../../models/user";
import createServer from "../../server";
import { Server } from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

let testServer: Server;

beforeAll(async () => {
  const app = createServer();
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
  // UNIT TESTS THAT DOESN'T COMMUNICATE WITH DATABASE
  describe("Unit tests that doesn't communicate with database", () => {
    it("Passwords doesn't match", async () => {
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
