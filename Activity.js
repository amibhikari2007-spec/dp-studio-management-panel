const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({

username:{
type:String,
required:true
},

action:{
type:String,
required:true
},

details:{
type:String,
required:true
}

},{
timestamps:true   // ✅ THIS LINE FIXES INVALID DATE
});

module.exports =
mongoose.model("Activity",activitySchema);
