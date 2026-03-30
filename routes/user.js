const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

username:{
type:String,
required:true,
unique:true
},

password:{
type:String,
required:true
},

role:{
type:String,
enum:["staff","admin","super_admin"],
default:"staff"
},

createdAt:{
type:Date,
default:Date.now
}

});

module.exports = mongoose.model("User", userSchema);