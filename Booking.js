const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({

customerName: String,
customerPhone: String,
eventType: String,
packageName: String,
totalAmount: Number,
advancePaid: Number,
balanceDue: Number,
eventDate: String,
invoiceNumber: String,
status: String,
deliveryStatus:{
type:String,
default:"Pending"
}
createdAt:{
type: Date,
default: Date.now
}

});

module.exports = mongoose.model("Booking", bookingSchema);
