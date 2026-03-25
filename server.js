require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Activity = require("./Activity");
const Customer = require("./Customer");
const Booking = require("./Booking");
const Admin = require("./Admin");
const User = require("./User");

const app = express();


/* =========================
   MIDDLEWARE
========================= */

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


/* =========================
   DATABASE CONNECTION
========================= */

mongoose.connect(process.env.MONGO_URI,{
serverSelectionTimeoutMS:5000
})
.then(()=>console.log("MongoDB Connected"))
.catch(err=>{
console.log("MongoDB Failed:",err);
process.exit(1);
});


/* =========================
   JWT VERIFY
========================= */

function verifyToken(req,res,next){

const authHeader=req.headers.authorization;

if(!authHeader){
return res.status(401).send("Access denied");
}

const token=authHeader.split(" ")[1];

try{

const decoded=
jwt.verify(token,process.env.JWT_SECRET);

req.user=decoded;

next();

}catch(err){

res.status(401).send("Invalid token");

}

}


/* =========================
   SUPER ADMIN CHECK
========================= */

function isSuperAdmin(req, res, next) {

  if (!req.user) {
    return res.status(403).json({ success:false });
  }

  if (req.user.role !== "super_admin") {
    return res.status(403).json({ success:false });
  }

  next();

}


/* =========================
   ROOT ROUTE
========================= */

app.get("/",(req,res)=>{
res.redirect("/admin.html");
});


/* =========================
   CREATE DEFAULT ADMIN
========================= */

app.get("/create-admin",async(req,res)=>{

const existing=
await Admin.findOne({username:"owner@dpstudio"});

if(existing){
return res.send("Admin exists");
}

const hashed=
await bcrypt.hash("dpstudio123",10);

await Admin.create({
username:"owner@dpstudio",
password:hashed
});

res.send("Admin created successfully");

});


/* =========================
   LOGIN
========================= */

app.post("/admin/login",async(req,res)=>{

const {username,password}=req.body;

let user=
await Admin.findOne({username});

let role="super_admin";

if(!user){

user=
await User.findOne({username});

role="staff";

}

if(!user){
return res.status(404).send("User not found");
}

const match=
await bcrypt.compare(password,user.password);

if(!match){
return res.status(401).send("Wrong password");
}

const token=
jwt.sign(
{ id:user._id, username:user.username, role },
process.env.JWT_SECRET,
{ expiresIn:"1d" }
);


/* ACTIVITY LOG */

await Activity.create({

username:user.username,
action:"LOGIN",
details:"User logged in",

ipAddress:
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress,

device:
req.headers["user-agent"]

});

res.json({token,role});

});


/* =========================
   ADD CUSTOMER
========================= */

app.post("/add-customer",
verifyToken,
async(req,res)=>{

const {name,phone,address}=req.body;

await Customer.create({name,phone,address});

res.send("Customer added");

});


/* =========================
   CUSTOMER LIST
========================= */

app.get("/customers-list",
verifyToken,
async(req,res)=>{

const data=
await Customer.find();

res.json(data);

});


/* =========================
   CUSTOMER DROPDOWN
========================= */

app.get("/customers-dropdown",
verifyToken,
async(req,res)=>{

const data=
await Customer.find({}, {name:1});

res.json(data);

});


/* =========================
   ADD BOOKING
========================= */

app.post("/add-booking",
verifyToken,
async(req,res)=>{

const {
customerName,
customerPhone,
eventType,
packageName,
totalAmount,
advancePaid,
eventDate
}=req.body;

let balanceDue=
totalAmount-advancePaid;

if(balanceDue<0){
balanceDue=0;
}

const count=
await Booking.countDocuments();

const year=
new Date().getFullYear();

const invoiceNumber=
`DP-${year}-${String(count+1).padStart(5,"0")}`;

const status=
balanceDue===0
? "Paid"
: "Pending";


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


/* ACTIVITY LOG */

await Activity.create({

username:req.user.username,
action:"BOOKING_CREATED",
details:`Created ${invoiceNumber}`,

ipAddress:
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress,

device:
req.headers["user-agent"]

});


res.send("Booking added");

});


/* =========================
   BOOKINGS LIST
========================= */

app.get("/bookings-list",
verifyToken,
async(req,res)=>{

const data=
await Booking.find()
.sort({createdAt:-1});

res.json(data);

});


/* =========================
   SINGLE BOOKING
========================= */

app.get("/booking/:id",
verifyToken,
async(req,res)=>{

const booking=
await Booking.findById(req.params.id);

if(!booking){
return res.status(404)
.send("Booking not found");
}

res.json(booking);

});


/* =========================
   UPDATE PAYMENT
========================= */

app.put("/update-booking/:id",
verifyToken,
superAdminOnly,
async(req,res)=>{

try{

const booking=
await Booking.findById(req.params.id);

if(!booking){
return res.status(404)
.send("Booking not found");
}

let newAdvance=req.body.advancePaid;

if(newAdvance>booking.totalAmount){
newAdvance=booking.totalAmount;
}

if(newAdvance<0){
newAdvance=0;
}

booking.advancePaid=newAdvance;

booking.balanceDue=
booking.totalAmount-booking.advancePaid;

booking.status=
booking.balanceDue===0
? "Paid"
: "Pending";

await booking.save();


/* ACTIVITY LOG */

await Activity.create({

username:req.user.username,
action:"PAYMENT_UPDATED",
details:`Updated ${booking.invoiceNumber}`,

ipAddress:
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress,

device:
req.headers["user-agent"]

});


res.send("Payment updated");

}catch(err){

console.log(err);

res.status(500)
.send("Payment update failed");

}

});


/* =========================
   DASHBOARD STATS (FIXED)
========================= */

app.get("/dashboard-stats",
verifyToken,
async(req,res)=>{

try{

const totalBookings =
await Booking.countDocuments();

const bookings =
await Booking.find();

let totalIncome = 0;
let pendingAmount = 0;

bookings.forEach(b=>{

totalIncome += b.advancePaid || 0;

pendingAmount += b.balanceDue || 0;

});

const totalCustomers =
await Customer.countDocuments();

res.json({

totalBookings,
totalIncome,
pendingAmount,
totalCustomers

});

}catch(err){

console.log(err);

res.status(500)
.send("Failed to load dashboard stats");

}

});


/* =========================
   ACTIVITY LIST
========================= */

app.get("/activity-list",
verifyToken,
superAdminOnly,
async(req,res)=>{

try{

const activities=
await Activity.find()
.sort({createdAt:-1})
.limit(100);

res.json(activities);

}catch(err){

console.log(err);

res.status(500)
.send("Failed to load activity");

}

});
// ==============================
// SUPER ADMIN DELETE SYSTEM
// ==============================

// check super admin
function isSuperAdmin(req, res, next) {

  if (!req.session.user) {
    return res.status(403).json({ success:false });
  }

  if (req.session.user.role !== "superadmin") {
    return res.status(403).json({ success:false });
  }

  next();
}


// get all bookings
app.get("/superadmin/bookings",
verifyToken,
isSuperAdmin,
async (req, res) => {

  try {

    const bookings =
    await Booking.find().sort({ createdAt:-1 });

    res.json(bookings);

  }

  catch(err){

    console.log(err);
    res.status(500).json([]);

  }

});
// delete booking + invoice
app.delete("/superadmin/delete-booking/:id", isSuperAdmin, async (req, res) => {

  try {

    const bookingId = req.params.id;

    // delete booking
    await Booking.findByIdAndDelete(bookingId);

    // delete invoice
  app.delete("/superadmin/delete-booking/:id",
verifyToken,
isSuperAdmin,
async (req, res) => {

  try {

    const bookingId = req.params.id;

    await Booking.findByIdAndDelete(bookingId);

    await Activity.create({
      username: req.user.username,
      action: "BOOKING_DELETED",
      details: "Deleted booking " + bookingId,
      ipAddress: req.ip,
      device: req.headers["user-agent"]
    });

    res.json({ success:true });

  }

  catch(err){

    console.log(err);
    res.json({ success:false });

  }

});
    // save log
    await Activity.create({
      username: req.session.user.username,
      action: "delete",
      details: "Deleted booking " + bookingId,
      ipAddress: req.ip,
      device: req.headers["user-agent"]
    });

    res.json({ success: true });

  } catch (err) {

    console.log(err);
    res.json({ success: false });

  }

});


/* =========================
   START SERVER
========================= */

const PORT=
process.env.PORT || 10000;

app.listen(PORT,()=>{

console.log(
"Server running on port "+PORT
);

});
