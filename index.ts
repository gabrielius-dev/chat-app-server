import createServer from "./server";

const port = process.env.PORT || 8000;

const app = createServer();

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});

export default app;
