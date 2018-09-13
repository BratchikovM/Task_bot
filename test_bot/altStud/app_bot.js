// Подключение библиотек
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect(config.database, {
    useMongoClient: true
});
const tasks = require('./db/tasks.js');
const users = require('./db/users.js');
const token = config.token;
const bot = new TelegramBot(token, {polling: true});

bot.on('message', router);
bot.on('callback_query', inlineRouter);

// Клавиатура пмов
const mainMenuPM = [
    [{text: "Просмотр заданий"}, {text: "Добавить задание"}, {text: "Удалить задание"}],
    [{text: "Свободные кодеры"}],
    [{text: "Работаю"}, {text: "Не работаю"}],
    [{text: "Мои навыки"}]
];

// Клавиатура кодеров
const mainMenuWorkers = [
    [{text: "Просмотр заданий"}],
    [{text: "Мои навыки"}],
    [{text: "Работаю"}, {text: "Не работаю"}]
];

// Инлайновые кнопки при создании таска
const inlineSetTask = {inline_keyboard:[
        [
            {
                text: 'Название',
                callback_data: "setTitle"
            },
            {
                text: 'Описание',
                callback_data: "setDescription"
            },
            {
                text: 'Стэк технологий',
                callback_data: "setStack"
            }
        ],
        [
            {
                text: 'Просмотреть таск',
                callback_data: "getTask"
            },
            {
                text: 'Сохранить таск',
                callback_data: "saveSetTask"
            }
        ]
    ]};

const inlineStackOfTechnologies = {inline_keyboard:[
        [
            {
                text: 'Добавить навык',
                callback_data: "addNewSkill"
            },
            {
                text: 'Удалить навык',
                callback_data: "removeSkill"
            }
        ],
        [
            {
                text: 'Посмотреть свои навыки',
                callback_data: 'mySkills'
            }
        ]
    ]};

// Список пмов
const pm = [
    'superglass'
];


async function find(array, value) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] === value) return true;
    }
    return false;
}

// Основной роутер
async function router(message, messageType) {

    try {
        console.log("**************************************************** ROUTER ");
        const userId = message.from.id;

        if (message.from.is_bot) {
            return false;
        }

        const userEntry = await users.findOne({telegramUserId: userId});
        console.log(userEntry);

        if (!userEntry) {
            await firstReg(message);
        } else {
            let manager = await find(pm, userEntry.username);
            if(manager && !userEntry.manager) {
                userEntry.manager = manager;
                userEntry.state.stateName = 'startPM';
                await userEntry.save();
            } else if (!manager && userEntry.manager) {
                userEntry.manager = false;
                userEntry.state.stateName = 'startWorkers';
                await userEntry.save();
            }
            console.log(userEntry.state.stateName);
            if (messageType.type === 'text') {
                routesForStates[userEntry.state.stateName]({userEntry, message});
            }
        }
    } catch(e) {
        console.error(e);
    }
}

// Инлайновый роутер
async function inlineRouter(message) {
    try {
        console.log("**************************************************** INLINE_ROUTER ");
        const userId = message.from.id;
        if (message.from.is_bot) {
            return false;
        }

        const userEntry = await users.findOne({telegramUserId: userId});
        const queryRegexp = /[a-z]+/gi;
        const regexpResult = queryRegexp.exec(message.data);
        if(!regexpResult || !regexpResult[0]) {
            return false;
        }
        const queryName = regexpResult[0];
        console.log(message.data);
        console.log(queryName);
        routesForInline[queryName]({userEntry, message});
    } catch(e) {
        console.error(e);
    }
}

const routesForStates = {
    startPM: MenuPM,
    startWorkers: MenuWorkers,
    setTitleStates: setTitleStates,
    setDescriptionStates: setDescriptionStates,
    setStackStates: setStackStates,
    getAllTasks: getAllTasks,
    freeWorkers: freeWorkers,
    thereIsWork: thereIsWork,
    notWork: notWork,
    setNewSkillStates: setNewSkillStates
};

const routesForInline = {
    //Добавить/удалить таск
    setTitle: setTitle,
    setDescription: setDescription,
    setStack: setStack,
    saveSetTask: saveSetTask,
    getTask: getTask,
    removeTask: removeTask,
    delTask: delTask,

    //Добавить/удалить навык
    mySkills: mySkills,
    addNewSkill: addNewSkill,
    removeSkill: removeSkill,
    delSkill: delSkill,

    //Подтверждение для некоторых опций
    // confirmTask: confirmationTask,
    confirm: confirmation,
    confirmSkill: confirmationSkill
};

// Добавление таска в бд
async function saveSetTask(routeObject) {
    console.log("***************************************************** SAVE TASK");
    let docUser = await users.findOne({username: routeObject.userEntry.username });
    let allDocUser = await  users.find();
    var arrWorkers = [];
    let docTask = await tasks.findOne({_id: docUser.currentIdTask });
    if (docTask.task.title == '') {
        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Укажите название проекта');
    } else {
        let arrStackTask = docTask.task.stack.split(',');
        docTask.succ = true;
        await docTask.save();
        for (var i = 0; i < allDocUser.length; i++) {
            if (allDocUser[i].stackOfTechnologies != '') {
                let minCount = Math.ceil(arrStackTask.length/2); // минимальное кол для рекомендации работника
                var count = 0;
                let arrStackUser = allDocUser[i].stackOfTechnologies.split(',');
                for (var j = 0; j < arrStackTask.length; j++) {
                    if (arrStackUser.indexOf(arrStackTask[j]) > -1) {
                        count++;
                    }
                }
                if (count >= minCount) {
                    arrWorkers.push('@'+allDocUser[i].username);
                }
            }
        }
        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Таск Создан. Подходящие работники: '+arrWorkers);
    }
}

// Сообщение заголовке
async function setTitle(routeObject) {
    console.log("***************************************************** setTitle");
    let docUser = await users.findOne({username: routeObject.userEntry.username });

    console.log(docUser);
    docUser.state.stateName = 'setTitleStates';
    await docUser.save();
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Введите название проекта');
}

async function setTitleStates(routeObject) {
    console.log("***************************************************** setTitleSTATES");
    console.log(routeObject);

    let docUser = await users.findOne({username: routeObject.userEntry.username });

    let docTask = await tasks.findOne({_id: docUser.currentIdTask });
    if (routeObject.message.text == '') {
        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Введите название проекта', {
            reply_markup:inlineSetTask,
        });
    } else {
        docTask.task.title = routeObject.message.text;
        await docTask.save();

        console.log(">>>> docUser");
        console.log(docUser);
        docUser.state.stateName = 'startPM';
        await docUser.save();

        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Сохранено!!!', {
            reply_markup:inlineSetTask,
        });
    }
}

// Сообщение описании
async function setDescription(routeObject) {
    console.log("***************************************************** setDescription");
    // console.log(routeObject);
    let docUser = await users.findOne({username: routeObject.userEntry.username });
    console.log(docUser);
    docUser.state.stateName = 'setDescriptionStates';
    await docUser.save();
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Введите описание проекта');
}

// Сообщение стэк
async function setStack(routeObject) {
    console.log("***************************************************** setStack");
    // console.log(routeObject);
    let docUser = await users.findOne({username: routeObject.userEntry.username });
    console.log(docUser);
    docUser.state.stateName = 'setStackStates';
    await docUser.save();
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Введите стэк технологий');
}

async function setStackStates(routeObject) {
    console.log("***************************************************** setStackSTATES");
    console.log(routeObject);

    let docUser = await users.findOne({username: routeObject.userEntry.username });
    console.log(">>>> docUser");
    console.log(docUser);
    let docTask = await tasks.findOne({_id: docUser.currentIdTask });
    docTask.task.stack = routeObject.message.text;
    await docTask.save();
    docUser.state.stateName = 'startPM';
    await docUser.save();

    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Сохранено!!!', {
        reply_markup:inlineSetTask,
    });
}

async function setDescriptionStates(routeObject) {
    console.log("***************************************************** setDescriptionSTATES");
    console.log(routeObject);

    let docUser = await users.findOne({username: routeObject.userEntry.username });
    console.log(">>>> docUser");
    console.log(docUser);
    let docTask = await tasks.findOne({_id: docUser.currentIdTask });
    docTask.task.description = routeObject.message.text;
    await docTask.save();
    docUser.state.stateName = 'startPM';
    await docUser.save();

    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Сохранено!!!', {
        reply_markup:inlineSetTask,

    });
}

// Сообщение с инлайновым меню добавить таск
async function addTask(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ ADDTASK");
    console.log(routeObject);
    let docTask = await new tasks({telegramUserId: routeObject.userEntry.telegramUserId}).save();

    let docUser = await users.findOne({telegramUserId: routeObject.userEntry.telegramUserId});
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>docUser");
    console.log(docUser);
    docUser.currentIdTask = docTask._id;
    await docUser.save();
    docTask.username = docUser.username;
    await docTask.save();
    console.log(docTask);
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Редактирование', {
        reply_markup:inlineSetTask,
    });
}

// Вывод всех тасков
async function getAllTasks(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ getAllTasks");

    let docTask = await tasks.find({succ: true});
    let docUser = await users.findOne({username: routeObject.userEntry.username});
    if (docUser.stackOfTechnologies != '' || docUser.manager) {
        let arrStackUser = docUser.stackOfTechnologies.split(',');
        if (docTask.length !== 0) {
            for (let task of docTask) {
                let arrStackTask = task.task.stack.split(',');
                let minCount = Math.ceil(arrStackTask.length / 2); // минимальное кол для вывода задания
                var count = 0;
                for (var i = 0; i < arrStackTask.length; i++) {
                    if (arrStackUser.indexOf(arrStackTask[i]) > -1) {
                        count++;
                    }
                }
                if (count >= minCount || docUser.manager || task.task.stack == '') {
                    console.log(task);
                    let md = `Название:
${task.task.title}
Описание:                
${task.task.description}
Стэк технологий:
${task.task.stack}

@${task.username}`;
                    await bot.sendMessage(routeObject.userEntry.telegramUserId, md);
                }
            }
        }
        else {
            await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Нет заданий');
        }
    } else {
        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Для начала добавьте свои навыки');
    }
}

// Предпросмотр таска
async function getTask(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ getAllTasks");

    let docTask = await tasks.find({_id: routeObject.userEntry.currentIdTask});
    console.log(docTask);
    if(docTask.length !== 0){
        for (let task of docTask) {
            console.log(task);
            let md = `Название:
${task.task.title}
Описание:
${task.task.description}

Стэк технологий:
${task.task.stack}

@${task.username}`;
            await bot.sendMessage(routeObject.userEntry.telegramUserId, md);
        }
    }
}

// Меню пмов
async function MenuPM(routeObject) {
    console.log("***************************************************** MAIN MENU PM");
    let options = routeObject.message.text;

    switch (options) {
        case '/start':
            bot.sendMessage(routeObject.userEntry.telegramUserId, 'Чего желаете?', {reply_markup: {keyboard: mainMenuPM}});
            break;
        case  'Добавить задание':
            await addTask(routeObject);
            break;
        case "Просмотр заданий":
            await getAllTasks(routeObject);
            break;
        case "Удалить задание":
            await removeTask(routeObject);
            break;
        case "Свободные кодеры":
            freeWorkers(routeObject);
            break;
        case "Работаю":
            thereIsWork(routeObject);
            break;
        case "Не работаю":
            notWork(routeObject);
            break;
        case "Мои навыки":
            changeSkills(routeObject);
            break;
            console.log(options);
    }
}

// Меню рабочих
async function MenuWorkers(routeObject) {
    console.log("***************************************************** MAIN MENU Workers");
    let options = routeObject.message.text;
    switch (options) {
        case '/start':
            bot.sendMessage(routeObject.userEntry.telegramUserId, 'Чего желаете?', {reply_markup: {keyboard: mainMenuWorkers}});
            break;
        case "Просмотр заданий":
            await getAllTasks(routeObject);
            break;
        case "Работаю":
            thereIsWork(routeObject);
            break;
        case "Не работаю":
            notWork(routeObject);
            break;
        case "Мои навыки":
            changeSkills(routeObject);
            break;
            console.log(options);
    }
}

// Регистрация при первом входе
async function firstReg(message) {
    let manager = await find(pm, message.from.username);

    let docUS = await new users({telegramUserId: message.from.id}).save();
    docUS.manager = manager;
    docUS.username = message.from.username;
    if(manager) {
        docUS.state.stateName = 'startPM';
        await docUS.save();
        await bot.sendMessage(message.from.id, 'Hi ' + message.from.username,{reply_markup: {keyboard: mainMenuPM}});
    }
    else {
        docUS.state.stateName = 'startWorkers';
        await docUS.save();
        await bot.sendMessage(message.from.id, 'Hi ' + message.from.username,{reply_markup: {keyboard: mainMenuWorkers}});
    }
}

// Удаление таска

async function removeTask(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ removeTask");

    let docTask = await tasks.find({succ: true});
    console.log(docTask);
    let msg = [];
    if(docTask.length !== 0){
        for (let task of docTask) {
            console.log(task);
            msg.push([
                    {
                        text: task.task.title,
                        callback_data: 'confirm(delTask(' + task._id + '))[removeTask]'
                    }
                ]);
        }
        console.log("msg---------- "+msg);
        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Выберите что хотите удалить',{
            reply_markup:{
                inline_keyboard:msg
            }
        });
    }
    else{
        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Нет заданий');
    }
}

async function delTask(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ deleteTask");
    console.log(routeObject.message.data);
    let regexp = /\((.+)\)/gi;
    let msg = regexp.exec(routeObject.message.data);
    let task = await tasks.findOne({_id:msg[1]});
    await bot.sendMessage(routeObject.userEntry.telegramUserId, "Удалено: "+ task.task.title);
    await tasks.remove({_id:msg[1]});
    removeTask(routeObject);
}

async function confirmation(routeObject) {
    console.log('-----------------------------------------------------------------------confirmation!!!');
    let regexpYes = /\((.+)\)/gi;
    let regexpNo = /\[(.+)\]/gi;
    let yes = regexpYes.exec(routeObject.message.data)[1];
    let no = regexpNo.exec(routeObject.message.data)[1];
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Удалить', {
        reply_markup:{
            inline_keyboard:[
                [
                    {
                        text: 'Да',
                        callback_data: yes
                    },
                    {
                        text: 'Нет',
                        callback_data: no
                    }
                ]
            ]
        }

    });
}


// Подбор свободных рабочих
async function freeWorkers(routeObject) {
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ freeWorkers");
    console.log(routeObject);
    let docUser = await users.find({free: true});
    if(docUser.length !== 0){
        for (let user of docUser) {
            console.log(user);
                let md = `@${user.username}`;
                await bot.sendMessage(routeObject.userEntry.telegramUserId, md);
        }
    } else {
        await bot.sendMessage(routeObject.userEntry.telegramUserId, "Все работают");
    }
}

// Изменение статуса рабочего на есть работа
async function thereIsWork (routeObject) {
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ thereIsWork");
    console.log(routeObject);
    let docUser = await  users.find({username: routeObject.userEntry.username});
    await users.update({username: docUser[0].username}, {$set: {free: false}});
}

// Изменение статуса рабочего на нет работы
async function notWork (routeObject) {
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ notWork");
    console.log(routeObject);
    let docUser = await  users.find({username: routeObject.userEntry.username});
    await users.update({username: docUser[0].username}, {$set: {free: true}});
}

// Сообщение с инлайновым меню изменения навыков
async function changeSkills(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ changeSkills");
    console.log(routeObject);

    let docUser = await users.findOne({telegramUserId: routeObject.userEntry.telegramUserId});
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>docUser");
    console.log(docUser);
    await docUser.save();
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Редактирование', {
        reply_markup:inlineStackOfTechnologies,
    });
}

// Посмотреть все свои навыки
async function mySkills(routeObject) {
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ mySkills");
    console.log(routeObject);

    let docUser = await users.findOne({telegramUserId: routeObject.userEntry.telegramUserId});
    let strDocUserSkills = docUser.stackOfTechnologies;
    if (docUser.manager) {
        docUser.state.stateName = 'startPM';
    } else {
        docUser.state.stateName = 'startWorkers';
    }
    await docUser.save();

    if(strDocUserSkills !== ''){
        await bot.sendMessage(routeObject.userEntry.telegramUserId, strDocUserSkills);
    } else {
        await bot.sendMessage(routeObject.userEntry.telegramUserId, "Вы не добавили навыки");
    }
}

// Добавить новый навык
async function addNewSkill(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ addNewSkill");

    let docUser = await users.findOne({username: routeObject.userEntry.username });
    console.log(docUser);
    docUser.state.stateName = 'setNewSkillStates';
    await docUser.save();
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Введите cвои навыки через запятую');
}

async function setNewSkillStates(routeObject) {
    console.log("***************************************************** setNewSkillStates");
    console.log(routeObject);

    let docUser = await users.findOne({username: routeObject.userEntry.username });
    if (docUser.stackOfTechnologies === '') {
        docUser.stackOfTechnologies = routeObject.message.text;
    } else {
        docUser.stackOfTechnologies = docUser.stackOfTechnologies + ',' + routeObject.message.text;
    }
    if (docUser.manager) {
        docUser.state.stateName = 'startPM';
    } else {
        docUser.state.stateName = 'startWorkers';
    }
    await docUser.save();
    console.log(">>>> docUser");
    console.log(docUser);

    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Сохранено!!!', {
        reply_markup:inlineStackOfTechnologies,
    });
}

// Удалить навык
async function removeSkill(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ removeSkill");

    let docUser = await users.findOne({username: routeObject.userEntry.username });
    let arrSkillsUser = docUser.stackOfTechnologies.split(',');
    let msg = [];
    if(docUser.length !== 0){
        for (let skill of arrSkillsUser) {
            console.log(skill);
            msg.push([
                {
                    text: skill,
                    callback_data: 'confirmSkill(delSkill(' + skill + '))[removeSkill]'
                }
                ]);
        }
        await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Выберите что хотите удалить', {
            reply_markup: {
                inline_keyboard: msg
            }
        });
        console.log(msg);
    }
}

async function delSkill(routeObject){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++ delSkill");
    console.log(routeObject.message.data);
    let regexp = /\((.+)\)/gi;
    let msg = regexp.exec(routeObject.message.data);
    let docUser = await users.findOne({username: routeObject.userEntry.username });
    var arrSkillsUser = docUser.stackOfTechnologies.split(',');
    let findSkill = arrSkillsUser.indexOf(msg[1]);
    console.log(findSkill);
    arrSkillsUser.splice(findSkill, findSkill+1);
    console.log(arrSkillsUser);
    docUser.stackOfTechnologies = arrSkillsUser;
    await docUser.save();
    await bot.sendMessage(routeObject.userEntry.telegramUserId, "Удалено");
    removeSkill(routeObject);
}

// Подтверждение удаления
async function confirmationSkill(routeObject) {
    console.log('-----------------------------------------------------------------------confirmationSkill!!!');
    let regexpYes = /\((.+)\)/gi;
    let regexpNo = /\[(.+)\]/gi;
    let regexpMsg = /\(delSkill(.+)\)/gi;
    let yes = regexpYes.exec(routeObject.message.data)[1];
    let no = regexpNo.exec(routeObject.message.data)[1];
    let msg = regexpMsg.exec(routeObject.message.data)[1];
    await bot.sendMessage(routeObject.userEntry.telegramUserId, 'Удалить '+msg+' ?', {
        reply_markup:{
            inline_keyboard:[
                [
                    {
                        text: 'Да',
                        callback_data: yes
                    },
                    {
                        text: 'Нет',
                        callback_data: no
                    }
                ]
            ]
        }
    });
}
