import * as Discord from "discord.js";
import { MongoClient } from "mongodb";
import QuestionManager from "./QuestionManager.js";
import ChannelManager from "./ChannelManager.js";
import IntervalManager from "./IntervalManager.js";


const DB_SIZE = 48358;
const SEC_IN_DAY = 86400;
const SEC_IN_HOUR = 3600;
const TESTING = false;
const DD_PROBABILITY = 8; // out of 100, 25 -> 25% chance

// connect to mongo database
const dbpass = process.env.MongoDBPass;
const uri = `mongodb+srv://asher:${dbpass}@cluster0.u5pnm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

async function startDb(){
    await client.connect();
}
    
startDb();
//-----------------------

const questionManager = new QuestionManager();
const channelManager = new ChannelManager();
const intervalManager = new IntervalManager();
var day = true;

async function getRandomQuestion(){
    const db = client.db("QuestionsDB");
    const collection = db.collection("question");

    let id = Math.floor(Math.random() * DB_SIZE);

    var question = await collection.findOne({identifier: id});

    question.reward = question.reward.split(".")[0];
    let parsed = parseInt(question.reward);
    if(parsed === 100 || parsed === 300 || parsed === 500){
        parsed *= 2;
    }
    question.reward = "" + parsed;

    if(question.clue === "="){  
        //small portion of questions in db are fucked up
        return await getRandomQuestion();
    }
    return question;
}

async function sendScoreSummaryToServer(channel){
    const db = client.db("ScoresDB");
    const collection = db.collection("scores");

    var scores = await collection.find({"guildId": channel.guild.id}).toArray();

    scores.sort((p, q) => {
        if(p.score > q.score){
            return -1;
        }
        return 1;
    });

    var list = "";
    for(let i = 0; i < 10 && i < scores.length; i++){
        // make first 3 emojis
        if(i === 0){
            list = list + `🥇 ${scores[i].userName}:  ${scores[i].score}\n`;
        }
        else if(i === 1){
            list = list + `🥈 ${scores[i].userName}:  ${scores[i].score}\n`;
        }
        else if(i === 2){
            list = list + `🥉 ${scores[i].userName}:  ${scores[i].score}\n`;
        } else {
            list = list + ` ${i+1}.  ${scores[i].userName}:  ${scores[i].score}\n`;
        }
        
    }

    channel.send(`---Leaderboard---\n\n${list}`);
}

async function addScore(guildId, userId, userName, score){
    console.log(`score to add: ${score}`);
    const db = client.db("ScoresDB");
    const collection = db.collection("scores");

    let obj = await collection.findOne({"userId": userId, "guildId": guildId});

    if(obj === null){   // user not in db yet with this guild
        await collection.insertOne({"guildId": guildId, "userId": userId, "userName": userName, "score": score});
    } else {    //update existing user
        await collection.updateOne({"guildId": guildId, "userId": userId}, {$set:{"score": Math.max(obj.score + score, 0)}});
    }

    return;
}


const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES"] });

bot.once('ready', async () => {
    // console.log("ready");
    // load guild data from database
    const db = client.db("GuildsDB");
    const collection = db.collection("guild");
    let guilds = await collection.find().toArray();
    guilds.forEach(guild => {
        let obj = {
            "id": guild["channelId"],
            "name": guild["name"],
            "jRoleId": guild["jRoleId"]
        }
        channelManager.setChannel(guild.guildId, obj);

        intervalManager.setTimeBetween(guild.guildId, guild.timeBetween);
    });

    // sendQuestionToAllServers();
    // const iv = setInterval(sendQuestionToAllServers, SEC_IN_DAY * (1000 / (24 * 2)));

    // setTimeout(() => startUp(), (8.5 * SEC_IN_HOUR) * 1000);
    startUp();
    return;
});

bot.on('guildCreate', async guild => {
    //add guild to managers
    // console.log(guild);
    console.log("guild create");

    // const db = client.db("GuildsDB");
    // const collection = db.collection("guild");

    // set interval for new server with default time inbetween of 14 (one per day at 10am)
    let iv = setInterval(() => { sendQuestionToServer(guild.id) }, (SEC_IN_HOUR * 1000) * 14);
    intervalManager.setBoth(guild.id, iv, 14);

    // send first question
    sendQuestionToServer(guild.id);
});

bot.on('messageCreate', async (msg) => {
    // console.log(msg.author);
    // console.log(msg.member.permissionsIn(msg.channel).has("ADMINISTRATOR"));
    if(msg.author.id === "965400521512980500"){
        // message from self
        return;
    }

    let content = msg.content;
    
    // message endpoints
    let answerRegex = /^!(what|who|where) (is|are) /;
    if(content.match(answerRegex)){
        if(msg.author.id === "227111389171417088"){
            msg.channel.send("Damny 😎");
        }

        if(questionManager.getDailyDouble(msg.guild.id)){
            let playerId = questionManager.getPlayer(msg.guild.id);
            if(playerId !== msg.author.id){
                msg.channel.send(`<@${msg.author.id}> this question is for the person who wagered first, be quiet and let them think`);
                return;
            }

            let answer = content.split(" ").slice(2).join(" ");
            let correct = questionManager.answer(msg.guild.id, answer.toLowerCase());
            let wager = questionManager.getWager(msg.guild.id);

            if(correct > 0){
                questionManager.setDailyDouble(msg.guild.id, false);   //go back to normal questions (probably)
                questionManager.setAnswered(msg.guild.id, true);
                msg.channel.send(`<@${msg.author.id}> Correct! +${wager} 🤤`);
                await addScore(msg.guild.id, msg.author.id, msg.author.username, wager * 2);
                sendScoreSummaryToServer(msg.channel);
                return;
            } else {
                questionManager.setDailyDouble(msg.guild.id, false);
                questionManager.setAnswered(msg.guild.id, true);
                msg.channel.send(`<@${msg.author.id}> thaaats a chunky. -${wager} omegalaughing`);
                // await addScore(msg.guild.id, msg.author.id, msg.author.username, (0 - wager));
                sendScoreSummaryToServer(msg.channel);
                return;
            }
        }
        // limit length
        if(content.length > 60){
            msg.channel.send("make your answer shorter stupid bitch");
            return;
        }

        if(msg.author.bot){
            msg.channel.send("be gone bot");
            return;
        }

        if(!day){
            msg.channel.send("questions will be back soon!");
            return;
        }

        if(questionManager.getQuestion(msg.guild.id).answered){
            msg.channel.send("Someone got it already, L");
            return;
        }


        console.log("answer");
        
        var answer = content.split(" ").slice(2).join(" ");
        
        console.log(answer);
        let correct = questionManager.answer(msg.guild.id, answer.toLowerCase());
        console.log(correct);
        if(correct > 0){
            msg.channel.send(`<@${msg.author.id}> Correct! ${correct} points 🥶`);
            await addScore(msg.channel.guild.id, msg.author.id, msg.author.username, correct);
            sendScoreSummaryToServer(msg.channel);
        } else {
            msg.channel.send(`<@${msg.author.id}> nope`);
        }
        return;
    }

    let setChannelRegex = /^!setChannel /;
    if(content.match(setChannelRegex)){
        console.log("set channel");
        let newChannel = msg.content.split(" ")[1];
        console.log(newChannel);
        let matches = bot.channels.cache.filter(channel => channel.name === newChannel && channel.type === "GUILD_TEXT");

        if(matches.size > 0){
            channelManager.setChannel(msg.guild.id, {"id": matches.at(0).id, "name": matches.at(0).name});

            //update in database
            const db = client.db("GuildsDB");
            const collection = db.collection("guild");
            await collection.updateOne({"guildId": msg.guild.id}, {$set: {"channelId": matches.at(0).id, "name": matches.at(0).name}});

            msg.channel.send("channel set, new questions will be asked in " + matches.at(0).name);
        } else {
            msg.channel.send("couldn't find a text channel with that name, sorry!");
        }
        return;
    }

    let setIntervalRegex = /^!setInterval /;
    if(content.match(setIntervalRegex)){
        console.log(msg.author);
        if(!msg.member.permissionsIn(msg.channel).has("ADMINISTRATOR") && !(msg.author.id === "487079862268329995")){
            msg.channel.send(`<@${msg.author.id}> no admin role having ass...`);
            return;
        }

        let newInterval = parseFloat(msg.content.split(" ")[1]);

        if(newInterval === NaN){
            msg.channel.send(`<@${msg.author.id}> you just sent me some bullshit. try again`);
            return;
        }

        if(newInterval < 0.33){
            msg.channel.send(`<@${msg.author.id}> make your number bigger (0.33 - 14 hour delay, 0.33 = every 20min, 14 = once per day)`);
            return;
        }
        
        newInterval = Math.min(newInterval, 14);

        // cancel current interval 
        intervalManager.clearOne(msg.guild.id);

        // set new interval
        if(day){
            let iv = setInterval(() => { sendQuestionToServer(msg.guild.id) }, (SEC_IN_HOUR * 1000) * newInterval);
            intervalManager.setBoth(msg.guild.id, iv, newInterval);
            msg.channel.send(`new interval set! Questions will be asked every ${newInterval} hours`);
        } else {
            // if not day, dont set interval until startup
            intervalManager.setTimeBetween(newInterval);
            msg.channel.send(`new interval set! Questions will be asked every ${newInterval} hours starting in the morning`);
        }
        
        // update interval in database
        const db = client.db("GuildsDB");
        const collection = db.collection("guild");
        collection.updateOne({"guildId": msg.guild.id}, {$set: {"timeBetween": newInterval}});

        return;
    }

    let leaderboardRegex = /^!leaderboard/;
    if(content.match(leaderboardRegex)){
        sendScoreSummaryToServer(msg.channel);
        return;
    }

    let wagerRegex = /^!wager /;
    if(content.match(wagerRegex)){
        console.log("wager");

        if(!questionManager.getDailyDouble(msg.guild.id)){
            msg.channel.send(`<@${msg.author.id}> gotta wait for a daily double`);
            return;
        }

        let wager = parseInt(msg.content.split(" ")[1].split(".")[0]);
        console.log(wager);

        if(isNaN(wager)){
            msg.channel.send(`<@${msg.author.id}> send a number`);
            return;
        }

        if(wager < 0){
            msg.channel.send(`<@${msg.author.id}> Xander I am confident only you would try to pull some shit like this... ratio`);
            return;
        }

        // check wager against player's total score
        const db = client.db("ScoresDB");
        const collection = db.collection("scores");
        let score = await collection.findOne({"guildId": msg.guild.id, "userId": msg.author.id});
        score = score.score;    //???kekw
        console.log(score);
        if(score === undefined || score === 0){
            msg.channel.send(`<@${msg.author.id}> get some points first... broke ass...`);
            return;
        }

        if(score < wager){
            msg.channel.send(`<@${msg.author.id}> your wager must be less than your score`);
            return;
        }

        let first = questionManager.setPlayer(msg.guild.id, msg.author.id);
        if(!first){
            msg.channel.send(`<@${msg.author.id}> too slow kekleo`);
            return;
        }

        addScore(msg.guild.id, msg.author.id, msg.author.name, wager * -1);

        questionManager.setWager(msg.guild.id, wager);
        let q = questionManager.getQuestion(msg.guild.id);
        msg.channel.send(`<@${msg.author.id}> you got it! Here's your question:\n\nCategory: ${q.category}\nClue: ${q.clue}`);

    }

    // let roleRegex = /^!role/;
    // if(content.match(roleRegex)){
    //     let role = channelManager.getJRole(msg.guild.id);
    //     console.log(msg.author.roles);
    //     let memb = msg.guild.members;
    //     console.log(memb);

    // }
    
    let useRegex = /^!use/;
    if(content.match(useRegex)){
        console.log("use");
        let response = "ANSWERING :\n    ex: !who are the isley brothers\n    ex: !what is the berlin wall\n" + 
            "    Invoking the command can be done with !<who, what or where><space><is or are>, no combination has an effect on the answer\n\n" + 
            "Daily Jeopardy use:\n\n!setChannel <text channel name> : sets the servers text channel for questions to be asked in\n\n" +
            "!leaderboard : displays the servers leaderboard\n\n";
            
        msg.channel.send(response);
        return;
    }

    let secretRegex = /^!secret/;
    if(content.match(secretRegex)){
        msg.channel.send("in 2004 I hit a pedestrian and kept driving KEKW");
    }
});

async function startUp(){
    console.log("startup!");
    day = true;
    //start interval for each server
    //assume time between set for all servers
    await sendQuestionToAllServers();
    await bot.guilds.fetch()
    .then(guilds => {
        guilds.forEach(guild => {
            console.log(guild.name);
            if(TESTING){    //only send questions to my server
                if(guild.name !== "Asher" && guild.name !== "Asher's server 2"){
                    return;
                }
            }
            // sendQuestionToServer(guild.id);
            // console.log("question sent");
            // let iv = setInterval(() => { sendQuestionToServer(guild.id) }, 2 * 1000);
            // console.log("---");
            // console.log(iv);
            let iv = setInterval(() => { sendQuestionToServer(guild.id) }, (SEC_IN_HOUR * 1000) * intervalManager.getTimeBetween(guild.id));
            intervalManager.setIv(guild.id, iv);
        });
    });

    // in 13 hours from startup, clear all intervals and 
    // set 11 hour timer to start up again
    // setTimeout(() => {
    //     intervalManager.clearAll();
    //     setTimeout(startUp, 5 * 1000);
    // }, 10 * 1000);
    // setTimeout(() => {
    //     day = false;
    //     intervalManager.clearAll();
    //     setTimeout(startUp, (SEC_IN_HOUR * 11) * 1000);
    // }, (SEC_IN_HOUR * 13) * 1000);
}

async function sendQuestionToAllServers(){
    await bot.guilds.fetch()
    .then(guilds => {
        guilds.forEach(async (guild) => {
            if(TESTING){    //only send questions to my server
                if(guild.name !== "Asher"){
                    return;
                }
            }
            await getRandomQuestion()
            .then(question => {
                let prevQuestion = questionManager.getQuestion(guild.id);
                let prevQuestionInfo = "";
                
                if(prevQuestion !== null){
                    prevQuestionInfo = `Answer: "${prevQuestion.answer}"\n\n`;
                }

                questionManager.setQuestion(guild.id, question);

                // get role @Jeopardy
                let g = bot.guilds.cache.get(guild.id);
                let role = g.roles.cache.find(role => role.name === "Jeopardy");
                console.log(`setting role for ${guild.id}: ${role}`)
                channelManager.setJRole(guild.id, role);

                let channel = channelManager.getChannel(guild.id);
                if(channel === null){
                    // guild doesn't have channel set yet
                    // search cache for a guilds "general" channel
                    // if none, use first occuring text channel
                    let textChannels = bot.channels.cache.filter(channel => channel.guild.id === guild.id && channel.type === "GUILD_TEXT");
                    let gen = textChannels.find(channel => channel.name === "general");

                    if(gen === undefined){
                        channel = textChannels.at(0);
                    } else {
                        channel = gen;
                    }

                    // set in channel manager
                    channelManager.setChannel(guild.id, {"id": channel.id, "name": channel.name, "jRoleId": (role === undefined) ? undefined : role.id});

                    // add to database
                    const db = client.db("GuildsDB");
                    const collection = db.collection("guild");
                    collection.insertOne({"guildId": guild.id, "channelId": channel.id, "name": channel.name, "jRoleId": (role === undefined) ? undefined : role.id});
                }

                let ran = Math.floor(Math.random() * 100);
                if(ran <= DD_PROBABILITY){   //8% for daily double drop instead
                    // sendDailyDoubleToServer(guildId);
                    bot.channels.cache.get(channel.id).send(`${(role === undefined) ? "" : "<@&" + role.id + ">\n"}This is a daily double! First one to wager using !wager <number> will get one shot at the next question for their wager.`);
                    questionManager.setDailyDouble(guild.id, true);
                    
                    return;
                }

                // send question to channel
                bot.channels.cache.get(channel.id).send(`${(role === undefined) ? "" : "<@&" + role.id + ">\n"}${prevQuestionInfo}--- NEW QUESTION ---\n\nCategory: ${question.category}\nClue: ${question.clue}\nReward: ${question.reward}`);
                
                return;
            });
        });
        return;
    });
}

// async function sendDailyDoubleToServer(guildId){
//     console.log(`sending daily double to: ${guildId}`);
    
// }

async function sendQuestionToServer(guildId){
    console.log(`sending question to ${guildId}`);

    await getRandomQuestion()
    .then(question => {
        let prevQuestion = questionManager.getQuestion(guildId);
        let prevQuestionInfo = "";
        if(prevQuestion !== null){
            prevQuestionInfo = `Answer: "${prevQuestion.answer}"\n\n`;
        }

        questionManager.setQuestion(guildId, question);

        // get role @Jeopardy
        let g = bot.guilds.cache.get(guildId);
        console.log(`after g, ${guildId}`);
        let role = g.roles.cache.find(role => role.name === "Jeopardy");
        channelManager.setJRole(guildId, role);

        let channel = channelManager.getChannel(guildId);
        if(channel === null){
            // guild doesn't have channel set yet
            // search cache for a guilds "general" channel
            // if none, use first occuring text channel
            let textChannels = bot.channels.cache.filter(channel => channel.guild.id === guildId && channel.type === "GUILD_TEXT");
            let gen = textChannels.find(channel => channel.name === "general");

            if(gen === undefined){
                channel = textChannels.at(0);
            } else {
                channel = gen;
            }

            // set in channel manager
            channelManager.setChannel(guildId, {"id": channel.id, "name": channel.name, "jRoleId": (role === undefined) ? undefined : role.id});

            // add to database
            const db = client.db("GuildsDB");
            const collection = db.collection("guild");
            collection.insertOne({"guildId": guildId, "channelId": channel.id, "name": channel.name, "jRoleId": (role === undefined) ? undefined : role.id, "timeBetween": 14});
        }

        let ran = Math.floor(Math.random() * 100);
        if(ran <= DD_PROBABILITY){   //8% for daily double drop instead
            // sendDailyDoubleToServer(guildId);
            bot.channels.cache.get(channel.id).send(`${(role === undefined) ? "" : "<@&" + role.id + ">\n"}This is a daily double! First one to wager using !wager <number> will get one shot at the next question for their wager.`);
            questionManager.setDailyDouble(guildId, true);
            console.log(questionManager.getQuestion(guildId));
            return;
        }

        // send question to channel
        bot.channels.cache.get(channel.id).send(`${(role === undefined) ? "" : "<@&" + role.id + ">\n"}${prevQuestionInfo}--- NEW QUESTION ---\n\nCategory: ${question.category}\nClue: ${question.clue}\nReward: ${question.reward}`);
        
        return;
    });
}

const botLogin = process.env.JBL;
bot.login(botLogin);
