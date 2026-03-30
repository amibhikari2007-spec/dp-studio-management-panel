const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({

name:String,

phone:String,

address:String,

createdAt:{
type:Date,
default:Date.now
}

});

module.exports=mongoose.model("Customer",customerSchema);