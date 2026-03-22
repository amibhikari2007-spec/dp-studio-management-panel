const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({

username: {
type: String,
required: true
},

action: {
type: String,
required: true
},

details: {
type: String,
default: ""
},

date: {
type: Date,
default: Date.now
}

});

module.exports = mongoose.model("Activity", activitySchema);
