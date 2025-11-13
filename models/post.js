const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({

    user :  {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User'
    },
    date : {
        type : Date,
        default : Date.now
    },
    content : {
        type : String,
        required : true,

    },

    likes : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User'
    }]
})

module.exports = mongoose.model('Post', postSchema);