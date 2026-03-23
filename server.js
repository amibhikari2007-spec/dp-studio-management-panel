app.put("/update-booking/:id",
verifyToken,
superAdminOnly,
async (req,res)=>{

try{

const booking = await Booking.findById(req.params.id);

if(!booking){
return res.status(404).send("Booking not found");
}

let newAdvance = req.body.advancePaid;

// prevent overpayment
if(newAdvance > booking.totalAmount){
newAdvance = booking.totalAmount;
}

// prevent negative values
if(newAdvance < 0){
newAdvance = 0;
}

booking.advancePaid = newAdvance;

booking.balanceDue =
booking.totalAmount - booking.advancePaid;

if(booking.balanceDue <= 0){
booking.balanceDue = 0;
booking.status = "Paid";
}else{
booking.status = "Pending";
}

await booking.save();

await Activity.create({

username:req.user.id,
action:"PAYMENT_UPDATED",
details:`Updated ${booking.invoiceNumber}`

});

res.send("Payment updated successfully");

}catch(err){

console.log(err);

res.status(500).send("Payment update failed");

}

});
