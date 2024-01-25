Welcome to the server repository of the [Real-Time Messaging App](https://github.com/gabrielius-dev/chat-app), the backend powerhouse of this personal full-stack messaging project. This server is crafted using Node.js with Express.js and Typescript, providing essential support for real-time communication and data handling.

<!-- TESTING -->

## Testing with Jest and Supertest

Please note that testing in this project is limited and primarily serves as a learning exercise rather than comprehensive coverage. Due to the personal nature of this project, only a handful of tests have been implemented to get familiar with testing environments. The tests do not aim to validate 100% of the project's functionality.

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running follow these simple example steps.

1. **Clone the Front-End Repository**

   - If you haven't already, clone the front-end repository by following the instructions in the [Real-Time Messaging App - Front End Repository](https://github.com/gabrielius-dev/chat-app).

2. **Create a MongoDB Database**

   - Create a MongoDB database for your project. If you don't have MongoDB installed, sign up for a free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a new cluster. Update the MongoDB connection string in the `.env` file of the server directory with your database connection details.

3. **Get Cloudinary Configuration**

   - Sign up for a free account on [Cloudinary](https://cloudinary.com/), and obtain your API key, API secret, and cloud name. Update the corresponding fields in the `.env` file of the server directory with your Cloudinary configuration.

4. **Clone the Repository**

   ```sh
   git clone https://github.com/gabrielius-dev/chat-app-server
   ```

5. **Install NPM packages**

   ```sh
   npm install
   ```

6. **Create a `.env` file in the root of your project and add the following variables**

   ```text
    MONGODB_URI=<mongodb_uri>
    SESSION_SECRET_KEY=<session_secret_key>
    CLOUDINARY_CLOUD_NAME=<cloudinary_cloud_name>
    CLOUDINARY_API_KEY=<cloudinary_api_key>
    CLOUDINARY_API_SECRET=<cloudinary_api_secret>
    FRONT_END_URL=<front_end_url>
   ```

   - `MONGODB_URI`: Obtain this from your MongoDB Atlas setup. It should point to your MongoDB database.

   - `SESSION_SECRET_KEY`: Use a strong, random string as your session secret key.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Obtain these from your Cloudinary account.
   - `FRONT_END_URL`: Set this to the URL of your front-end application.

7. **Run the development server**
   ```sh
   npm run dev
   ```
