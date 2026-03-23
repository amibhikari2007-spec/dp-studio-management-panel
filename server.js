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
const User = require("./User");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


/* DATABASE CONNECTION */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));


/* JWT AUTH MIDDLEWARE */

function verifyToken(req, res, next){

const authHeader = req.headers.authorization;

if(!authHeader){
return res.status(401).send("Access denied");
}

const token = authHeader.split(" ")[1];

try{

const decoded =
jwt.verify(token, process.env.JWT_SECRET);

req.user = decoded;

next();

}catch(err){

res.status(401).send("Invalid token");

}

}


/* ROLE CHECK MIDDLEWARE */

function superAdminOnly(req, res, next){

if(req.user.role !== "super_admin"){

return res.status(403).send("Super Admin access required");

}

next();

}


/* ROOT ROUTE */

app.get("/", (req, res) => {
res.redirect("/admin.html");
});


/* CREATE DEFAULT ADMIN */

app.get("/create-admin", async (req, res) => {

const existingAdmin =
await Admin.findOne({
username:"owner@dpstudio"
});

if(existingAdmin){

return res.send("Admin already exists");

}

const hashedPassword =
await bcrypt.hash("dpstudio123",10);

await Admin.create({

username:"owner@dpstudio",

password:hashedPassword

});

res.send("Super Admin Created Successfully");

});


/* ADMIN LOGIN */

app.post("/admin/login", async (req, res) => {

const { username, password } = req.body;

let user =
await Admin.findOne({ username });

let role="super_admin";

if(!user){

user =
await User.findOne({ username });

role="staff";

}

if(!user){

return res.status(404).send("User not found");

}

const isMatch =
await bcrypt.compare(password, user.password);

if(!isMatch){

return res.status(401).send("Wrong password");

}

const token =
jwt.sign(

{ id:user._id, role },

process.env.JWT_SECRET,

{ expiresIn:"1d" }

);

await Activity.create({

username,

action:"LOGIN",

details:"User logged in"

});

res.json({

message:"Login successful",

token,

role

});

});


/* ADD CUSTOMER */

app.post("/add-customer",
verifyToken,
async (req,res)=>{

const { name, phone, address } = req.body;

await Customer.create({

name,
phone,
address

});

res.send("Customer Added Successfully");

});


/* CUSTOMER LIST */

app.get("/customers-list",
verifyToken,
async (req,res)=>{

const customers =
await Customer.find();

res.json(customers);

});


/* ADD BOOKING */

app.post("/add-booking",
verifyToken,
async (req,res)=>{

const {

customerName,
customerPhone,
eventType,
packageName,
totalAmount,
advancePaid,
eventDate

} = req.body;

const balanceDue =
totalAmount - advancePaid;

const count =
await Booking.countDocuments();

const year =
new Date().getFullYear();

const invoiceNumber =
`DP-${year}-${String(count+1).padStart(5,"0")}`;

const status =
balanceDue===0 ? "Paid":"Pending";

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

app.get("/bookings-list",
verifyToken,
async (req,res)=>{

const bookings =
await Booking.find()
.sort({ createdAt:-1 });

res.json(bookings);

});


/* UPDATE PAYMENT (SUPER ADMIN ONLY) */

app.put("/update-booking/:id",
verifyToken,
superAdminOnly,
async (req,res)=>{

try{

const booking =
await Booking.findById(req.params.id);

if(!booking){

return res.status(404)
.send("Booking not found");

}

booking.advancePaid =
req.body.advancePaid;

booking.balanceDue =
booking.totalAmount
- booking.advancePaid;

booking.status =
booking.balanceDue===0
? "Paid":"Pending";

await booking.save();

await Activity.create({

username:req.user.id,

action:"PAYMENT_UPDATED",

details:`Updated ${booking.invoiceNumber}`

});

res.send("Payment updated successfully");

}catch(err){

console.log(err);

res.status(500)
.send("Payment update failed");

}

});


/* DASHBOARD STATS */

app.get("/dashboard-stats",
verifyToken,
async (req,res)=>{

const bookings =
await Booking.find();

let totalIncome=0;
let pendingAmount=0;

bookings.forEach(b=>{

totalIncome+=b.advancePaid;

pendingAmount+=b.balanceDue;

});

res.json({

totalBookings:bookings.length,

totalIncome,

pendingAmount

});

});


/* CREATE USER */

app.post("/create-user",
verifyToken,
superAdminOnly,
async (req,res)=>{

const { username,password,role }
= req.body;

if(!username || !password){

return res.status(400)
.send("Missing fields");

}

const existing =
await User.findOne({ username });

if(existing){

return res.status(400)
.send("User already exists");

}

const hashedPassword =
await bcrypt.hash(password,10);

await User.create({

username,
password:hashedPassword,
role

});

res.send("User created successfully");

});


/* START SERVER */

const PORT =
process.env.PORT || 10000;

app.listen(PORT,()=>{

console.log(
`Server running on port ${PORT}`
);

});
