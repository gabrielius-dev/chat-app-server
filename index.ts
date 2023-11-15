import createServer from "./server";

const port = process.env.PORT || 8000;

const { app, server } = createServer();

server.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});

export default app;
