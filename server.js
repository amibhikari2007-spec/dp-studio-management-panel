const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const Admin = require("./Admin");

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* Root test route */
app.get("/", (req, res) => {
    res.send("DP Studio Management Panel Running Successfully 🚀");
});

/* Create first admin automatically */
app.get("/create-admin", async (req, res) => {

    const existingAdmin = await Admin.findOne({
        username: "owner@dpstudio"
    });

    if(existingAdmin){
        return res.send("Admin already exists");
    }

    const hashedPassword = await bcrypt.hash("dpstudio123", 10);

    await Admin.create({
        username: "owner@dpstudio",
        password: hashedPassword
    });

    res.send("Super Admin Created Successfully");
});

/* Admin login route */
app.post("/admin/login", async (req, res) => {

    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });

    if(!admin){
        return res.status(404).send("Admin not found");
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if(!isMatch){
        return res.status(401).send("Wrong password");
    }

    const token = jwt.sign(
        { id: admin._id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    res.json({
        message: "Login successful",
        token
    });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
