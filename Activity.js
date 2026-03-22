const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({

username: String,

action: String,

details: String,

date: {
type: Date,
default: Date.now
}

});

module.exports = mongoose.model("Activity", activitySchema);
