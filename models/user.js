const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/miniProjectDB')

const userSchema = new mongoose.Schema({

    name : String,
    userName : String,
    email : String,
    age : Number, 
    password : String,
    posts : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Post'
    }],

    

})

module.exports = mongoose.model('User', userSchema);