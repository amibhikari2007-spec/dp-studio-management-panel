const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Customer=require("./Customer");
const Booking=require("./Booking");
require("dotenv").config();

const Admin = require("./Admin");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

username: {

type: String,
unique: true,
required: true

},

password: {

type: String,
required: true

},

role: {

type: String,
default: "admin"

},

createdAt: {

type: Date,
default: Date.now

}

});

const User = mongoose.model("User", userSchema);

const User = mongoose.model("User", userSchema);

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
/* Add Customer */

app.post("/add-customer",async(req,res)=>{

const {name,phone,address}=req.body;

await Customer.create({

name,

phone,

address

});

res.send("Customer Added Successfully");

});
/* Get Customers List */

app.get("/customers-list",async(req,res)=>{

const customers=await Customer.find();

res.json(customers);

});
/* Add Booking */

app.post("/add-booking",async(req,res)=>{

const{

customerName,

customerPhone,
    
eventType,

packageName,

totalAmount,

advancePaid,

eventDate

}=req.body;

/* Balance Calculation */

const balanceDue=totalAmount-advancePaid;

/* Invoice Number Generator */

const count=await Booking.countDocuments();

const year=new Date().getFullYear();

const invoiceNumber=`DP-${year}-${String(count+1).padStart(5,"0")}`;

/* Status */

const status=balanceDue===0?"Paid":"Pending";

/* Save Booking */

await Booking.create({

customerName,
    
customerPhone,
    
eventType,

packageName,

totalAmount,

advancePaid,

balanceDue,

eventDate,

invoiceNumber,

status

});

res.send("Booking Added Successfully");

});
/* Get All Bookings */

app.get("/bookings-list", async (req, res) => {

const bookings = await Booking.find().sort({createdAt:-1});

res.json(bookings);

});
/* Dashboard Stats */

app.get("/dashboard-stats", async (req, res) => {

const bookings = await Booking.find();

let totalIncome = 0;
let pendingAmount = 0;

bookings.forEach(b => {

totalIncome += b.advancePaid;

pendingAmount += b.balanceDue;

});

res.json({

totalBookings: bookings.length,
totalIncome,
pendingAmount

});

});
/* Get Customers for dropdown */

app.get("/customers-dropdown", async (req, res) => {

const customers = await Customer.find().sort({ name: 1 });

res.json(customers);
    /* Dashboard Chart Data */

app.get("/dashboard-chart-data", async (req, res) => {

const bookings = await Booking.find();

let monthlyBookings = new Array(12).fill(0);

let totalAdvance = 0;
let totalPending = 0;

bookings.forEach(b => {

const month = new Date(b.eventDate).getMonth();

monthlyBookings[month]++;

totalAdvance += b.advancePaid;

totalPending += b.balanceDue;

});

res.json({

monthlyBookings,
totalAdvance,
totalPending
    /* Create New User */

app.post("/create-user", async (req, res) => {

const { username, password, role } = req.body;

if (!username || !password) {

return res.status(400).send("Missing fields");

}

const existing = await User.findOne({ username });

if (existing) {

return res.status(400).send("User already exists");

}

const newUser = new User({

username,
password,
role

});

await newUser.save();

res.send("User created successfully");

});

});

});

});
