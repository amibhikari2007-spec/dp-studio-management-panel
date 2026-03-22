const bookingSchema = new mongoose.Schema({

customerName: String,

customerPhone: String,

eventType: String,

packageName: String,

totalAmount: Number,

advancePaid: Number,

balanceDue: Number,

eventDate: Date

});
