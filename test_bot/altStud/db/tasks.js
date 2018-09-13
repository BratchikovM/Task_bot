const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const tasks = new Schema({
    telegramUserId: {
        type: Number,
    },
    username:{
        type: String,
        default: ''
    },
    succ:{
        type: Boolean,
        default: false
    },
    task:{
        title:{
            type: String,
            default: ''
        },
        description:{
            type: String,
            default: ''
        },
        stack:{
            type: String,
            default: ''
        },
        whotake:{
            type: String,
            default: ''
        }
    }
},{});


const TaskModel = mongoose.model('tasks', tasks);
module.exports = TaskModel;