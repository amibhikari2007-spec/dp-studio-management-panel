const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: {
        type: String,
        default: "Super Admin"
    }
});

module.exports = mongoose.model("Admin", adminSchema);
