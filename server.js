const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* Root route */
app.get("/", (req, res) => {
    res.send("DP Studio Management Panel Running Successfully 🚀");
});

/* Test route (backup check) */
app.get("/test", (req, res) => {
    res.send("Server working correctly");
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
