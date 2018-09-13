const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const users = new Schema({
    telegramUserId: {
        type: Number,
    },
    username:{
        type: String,
        default: ''
    },

    state: {
        stateName: {
            type: String,
            default: 'registration'
        },
        additionalInfo: {
            type: String,
            default: null,
        }
    },
    //Разрешение на получение сообщения о новых диспутах в телегу
    manager:{
        type: Boolean,
        default: false
    },
    currentIdTask:{
        type: String,
        default: ''
    },
    free: {
        type: Boolean,
        default: true
    },
    stackOfTechnologies: {
        type: String,
        default: ''
    }
},{});


const UserModel = mongoose.model('users', users);
module.exports = UserModel;