const Activity = require("./Activity");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const Customer = require("./Customer");
const Booking = require("./Booking");
const Admin = require("./Admin");
const User = require("./User"); // ✅ keep this only

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));


/* ROOT ROUTE */

app.get("/", (req, res) => {
res.redirect("/admin.html");
});


/* CREATE DEFAULT ADMIN */

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


/* ADMIN LOGIN */

app.post("/admin/login", async (req, res) => {

const { username, password } = req.body;

/* check Admin collection first */

let user = await Admin.findOne({ username });

let role = "super_admin";

/* if not admin → check Users collection */

if(!user){

user = await User.findOne({ username });

role = "staff";

}

if(!user){

return res.status(404).send("User not found");

}

/* password verify */

const isMatch = await bcrypt.compare(password, user.password);

if(!isMatch){

return res.status(401).send("Wrong password");

}

/* create token */

const token = jwt.sign(

{ id: user._id, role },

process.env.JWT_SECRET,

{ expiresIn: "1d" }

);

/* activity tracker (optional if enabled) */

try{

await Activity.create({

username,

action:"LOGIN",

details:"User logged in"

});

}catch(err){}

/* response */

res.json({

message:"Login successful",

token,

role

});

});


/* ADD CUSTOMER */

app.post("/add-customer", async (req, res) => {

const { name, phone, address } = req.body;

await Customer.create({
name,
phone,
address
});

res.send("Customer Added Successfully");

});


/* CUSTOMER LIST */

app.get("/customers-list", async (req, res) => {

const customers = await Customer.find();

res.json(customers);

});


/* ADD BOOKING */

app.post("/add-booking", async (req, res) => {

const {
customerName,
customerPhone,
eventType,
packageName,
totalAmount,
advancePaid,
eventDate
} = req.body;

const balanceDue = totalAmount - advancePaid;

const count = await Booking.countDocuments();

const year = new Date().getFullYear();

const invoiceNumber =
`DP-${year}-${String(count + 1).padStart(5,"0")}`;

const status = balanceDue === 0 ? "Paid" : "Pending";

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


/* BOOKINGS LIST */

app.get("/bookings-list", async (req, res) => {

const bookings =
await Booking.find().sort({ createdAt: -1 });

res.json(bookings);

});
/* UPDATE BOOKING PAYMENT */

app.put("/update-booking/:id", async (req, res) => {

const {

advancePaid

} = req.body;

const booking = await Booking.findById(req.params.id);

if(!booking){

return res.status(404).send("Booking not found");

}

/* update advance */

booking.advancePaid = advancePaid;

/* recalculate balance */

booking.balanceDue =
booking.totalAmount - advancePaid;

/* update status */

booking.status =
booking.balanceDue === 0
? "Paid"
: "Pending";

await booking.save();

res.send("Booking updated successfully");

});

/* DASHBOARD STATS */

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


/* CUSTOMER DROPDOWN */

app.get("/customers-dropdown", async (req, res) => {

const customers =
await Customer.find().sort({ name: 1 });

res.json(customers);

});


/* DASHBOARD CHART DATA */

app.get("/dashboard-chart-data", async (req, res) => {

const bookings = await Booking.find();

let monthlyBookings = new Array(12).fill(0);

let totalAdvance = 0;
let totalPending = 0;

bookings.forEach(b => {

const month =
new Date(b.eventDate).getMonth();

monthlyBookings[month]++;

totalAdvance += b.advancePaid;
totalPending += b.balanceDue;

});

res.json({
monthlyBookings,
totalAdvance,
totalPending
});

});


/* CREATE NEW USER */

app.post("/create-user", async (req, res) => {

const { username, password, role } = req.body;

if (!username || !password) {

return res.status(400).send("Missing fields");

}

const existing =
await User.findOne({ username });

if (existing) {

return res.status(400).send("User already exists");

}

const hashedPassword =
await bcrypt.hash(password, 10);

await User.create({
username,
password: hashedPassword,
role
});

res.send("User created successfully");

});


/* USER LOGIN */

app.post("/user-login", async (req, res) => {

const { username, password } = req.body;

const user = await User.findOne({ username });

if(!user){
return res.status(404).send("User not found");
}

const match =
await bcrypt.compare(password, user.password);

if(!match){
return res.status(401).send("Wrong password");
}

const token = jwt.sign(
{
id: user._id,
role: user.role
},
process.env.JWT_SECRET,
{ expiresIn: "1d" }
);

res.json({
message: "Login successful",
token,
role: user.role
});

});


/* START SERVER */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

console.log(`Server running on port ${PORT}`);

});
