const express = require("express");
const colors = require("colors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { errorHandler } = require("./middleware/errorMiddleware");
const connectDB = require("./config/db");
const cors = require("cors");
const helmet = require("helmet");

connectDB();

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("ok");
});

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(cors());

app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/checkout", require("./routes/checkoutRoutes"));
app.use("/api/game", require("./routes/gameRoutes"));

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, "0.0.0.0", () =>
    console.log(`Server started on port ${port}`),
  );
}

module.exports = app;
