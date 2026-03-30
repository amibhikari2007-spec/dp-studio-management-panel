const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
{
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
},

ipAddress:{
type:String,
default:"--"
},

device:{
type:String,
default:"Unknown"
}

},
{
timestamps:true
}
);

module.exports =
mongoose.model("Activity",activitySchema);