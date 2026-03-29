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

function superAdminOnly(req,res,next){

if(!req.user){
return res.status(403).send("Access denied");
}

if(req.user.role !== "super_admin"){
return res.status(403).send("Super Admin required");
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
eventDate,
deliveryStatus
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
   deliveryStatus,
status

});


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

app.get("/private-booking/:id",
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
   DASHBOARD STATS
========================= */

app.get("/dashboard-stats",
verifyToken,
async(req,res)=>{

try{

const bookings = await Booking.find();
   let pendingDeliveries = 0;

bookings.forEach(b => {

if(b.deliveryStatus !== "Delivered"){
pendingDeliveries++;
}

});

let totalIncome = 0;
let pendingAmount = 0;
let todayRevenue = 0;
let monthRevenue = 0;

const today = new Date();

let customerMap = {};
let serviceMap = {};

bookings.forEach(b=>{

totalIncome += b.advancePaid || 0;

pendingAmount += b.balanceDue || 0;

const bookingDate = new Date(b.createdAt);

if(
bookingDate.toDateString() ===
today.toDateString()
){
todayRevenue += b.advancePaid || 0;
}

if(
bookingDate.getMonth() ===
today.getMonth()
){
monthRevenue += b.advancePaid || 0;
}

customerMap[b.customerName] =
(customerMap[b.customerName] || 0) + 1;

serviceMap[b.eventType] =
(serviceMap[b.eventType] || 0) + 1;

});

const topCustomer =
Object.keys(customerMap).sort(
(a,b)=>customerMap[b]-customerMap[a]
)[0] || "-";

const topService =
Object.keys(serviceMap).sort(
(a,b)=>serviceMap[b]-serviceMap[a]
)[0] || "-";

const totalBookings =
await Booking.countDocuments();

const totalCustomers =
await Customer.countDocuments();

res.json({

totalBookings,
totalIncome,
pendingAmount,
totalCustomers,

todayRevenue,
monthRevenue,
topCustomer,
topService,

pendingDeliveries

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


/* =========================
   SUPER ADMIN DELETE BOOKING
========================= */

app.delete("/superadmin/delete-booking/:id",
verifyToken,
superAdminOnly,
async (req,res)=>{

try{

const bookingId=req.params.id;

await Booking.findByIdAndDelete(bookingId);

await Activity.create({

username:req.user.username,
action:"BOOKING_DELETED",
details:"Deleted booking "+bookingId,

ipAddress:
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress,

device:
req.headers["user-agent"]

});

res.json({success:true});

}catch(err){

console.log(err);

res.json({success:false});

}

});


/* =========================
   SUPER ADMIN BOOKINGS LIST
========================= */

app.get("/superadmin/bookings",
verifyToken,
superAdminOnly,
async (req,res)=>{

try{

const bookings=
await Booking.find()
.sort({createdAt:-1});

res.json(bookings);

}catch(err){

console.log(err);
res.status(500).json([]);

}

});
app.post("/create-user",
verifyToken,
superAdminOnly,
async (req,res)=>{

try{

const {username,password,fullName,phone,role} = req.body;

if(!username || !password){
return res.status(400).send("Missing required fields");
}

const exists = await User.findOne({username});

if(exists){
return res.status(400).send("User already exists");
}

const hashed = await bcrypt.hash(password,10);

await User.create({

username,
password:hashed,
fullName,
phone,
role

});


await Activity.create({

username:req.user.username,
action:"USER_CREATED",
details:"Created user "+username,

ipAddress:
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress,

device:req.headers["user-agent"]

});


res.send("User created successfully");

}catch(err){

console.log(err);

res.status(500).send("Failed to create user");

}

});
/* =========================
   PUBLIC INVOICE ROUTE
========================= */

app.get("/public-invoice/:invoiceNumber", async (req, res) => {

try {

const booking =
await Booking.findOne({
invoiceNumber: req.params.invoiceNumber
});

if (!booking) {
return res.status(404).send("Invoice not found");
}

const PDFDocument = require("pdfkit");

const doc = new PDFDocument();

res.setHeader(
"Content-Type",
"application/pdf"
);

res.setHeader(
"Content-Disposition",
`inline; filename=${booking.invoiceNumber}.pdf`
);

doc.pipe(res);


/* HEADER */

doc.fontSize(20)
.text("DP Studio & Light", { align: "center" });

doc.moveDown();


/* DETAILS */

doc.fontSize(12)
.text(`Invoice Number: ${booking.invoiceNumber}`)
.text(`Customer: ${booking.customerName}`)
.text(`Phone: ${booking.customerPhone}`)
.text(`Event: ${booking.eventType}`)
.text(`Date: ${booking.eventDate}`)

doc.moveDown();

doc.text(`Total: ₹${booking.totalAmount}`)
.text(`Paid: ₹${booking.advancePaid}`)
.text(`Balance: ₹${booking.balanceDue}`)
.text(`Status: ${booking.status}`);

doc.end();

} catch (err) {

console.log(err);

res.status(500).send("Invoice generation failed");

}

});
  /* =========================
   PUBLIC BOOKING FETCH FOR INVOICE
========================= */

app.get("/booking/:id", async (req, res) => {

try {

const booking = await Booking.findById(req.params.id);

if (!booking) {
return res.status(404).send("Booking not found");
}

res.json(booking);

} catch (err) {

console.log(err);
res.status(500).send("Error loading booking");

}

});

app.put("/update-delivery-status/:id",
verifyToken,
async(req,res)=>{

try{

await Booking.findByIdAndUpdate(
req.params.id,
{ deliveryStatus:req.body.deliveryStatus }
);

res.json({success:true});

}catch(err){

console.log(err);
res.status(500).send("Update failed");

}

});

app.post("/chat", async (req, res) => {

try {

const userMessage = req.body.message;

const response = await fetch(
"https://api.openai.com/v1/chat/completions",
{
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
},
body: JSON.stringify({
model: "gpt-4o-mini",
messages: [
{
role: "system",
content: `
You are DP Studio & Light assistant.

Business details:

Location: Monoharpur, Dantan, Paschim Medinipur
Phone: 9083521201 / 7908045697

Services:
Wedding photography
Pre-wedding shoot
Drone shoot
Event lighting
Birthday shoot

Rules:
Always reply short and helpful.
If user asks booking → tell them to contact WhatsApp.
If user asks delivery status → ask invoice number.
`
},
{
role: "user",
content: userMessage
}
]
})
}
);

const data = await response.json();

res.json({
reply: data.choices[0].message.content
});

} catch (err) {

console.log(err);
res.status(500).send("AI assistant error");

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
