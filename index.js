import * as Discord from "discord.js";
import { MongoClient } from "mongodb";
import QuestionManager from "./QuestionManager.js";
import ChannelManager from "./ChannelManager.js";


const DB_SIZE = 48358;
const SEC_IN_DAY = 86400;
const TESTING = true;

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

async function getRandomQuestion(){
    const db = client.db("QuestionsDB");
    const collection = db.collection("question");

    let id = Math.floor(Math.random() * DB_SIZE);

    var question = await collection.findOne({identifier: id});

    question.reward = question.reward.split(".")[0];

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
            list = list + `🥇 <@${scores[i].userId}>:  ${scores[i].score}\n`;
        }
        else if(i === 1){
            list = list + `🥈 <@${scores[i].userId}>:  ${scores[i].score}\n`;
        }
        else if(i === 2){
            list = list + `🥉 <@${scores[i].userId}>:  ${scores[i].score}\n`;
        } else {
            list = list + ` ${i+1}. <@${scores[i].userId}>:  ${scores[i].score}\n`;
        }
        
    }

    channel.send(`---Leaderboard---\n\n${list}`);
}

async function addScore(guildId, userId, userName, score){
    const db = client.db("ScoresDB");
    const collection = db.collection("scores");

    let obj = await collection.findOne({"userId": userId, "guildId": guildId});

    if(obj === null){   // user not in db yet with this guild
        await collection.insertOne({"guildId": guildId, "userId": userId, "userName": userName, "score": score});
    } else {    //update existing user
        await collection.updateOne({"guildId": guildId, "userId": userId}, {$set:{"score": obj.score + score}});
    }

    return;
    // console.log(obj);
}


const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES"] });

bot.once('ready', async () => {
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
    });

    sendQuestionToAllServers();
    const iv = setInterval(sendQuestionToAllServers, SEC_IN_DAY * (1000 / (24 * 2)));
    return;
});


bot.on('messageCreate', async (msg) => {
    // console.log(msg);
    if(msg.author.id === "965400521512980500"){
        // message from self
        return;
    }

    let content = msg.content;
    
    // message endpoints
    let answerRegex = /^!(what|who|where) (is|are) /;
    if(content.match(answerRegex)){
        // limit length
        if(content.length > 60){
            msg.channel.send("make your answer shorter stupid bitch");
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
            msg.channel.send(`<@${msg.author.id}> Correct!`);
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
        // console.log(matches.at(0));
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

    let leaderboardRegex = /^!leaderboard/;
    if(content.match(leaderboardRegex)){
        sendScoreSummaryToServer(msg.channel);
        return;
    }
    
    let useRegex = /^!use/;
    if(content.match(useRegex)){
        console.log("use");
        let response = "Daily Jeopardy use:\n\n!setChannel <text channel name> : sets the servers text channel for questions to be asked in\n\n" +
            "!leaderboard : displays the servers leaderboard\n\n" +
            "ANSWERING :\n    ex: !who are the isley brothers\n    ex: !what is the berlin wall\n" + 
            "    Invoking the command can be done with !<who, what or where><space><is or are>, no combination has an effect on the answer";
        msg.channel.send(response);
        return;
    }
});

async function sendQuestionToAllServers(){
    await bot.guilds.fetch()
    .then(guilds => {
        guilds.forEach(async (guild) => {
            // console.log(guild);
            if(TESTING){
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

                
                // console.log(role.id);
                // send question to channel
                bot.channels.cache.get(channel.id).send(`${(role === undefined) ? "" : "<@&" + role.id + ">\n"}${prevQuestionInfo}--- NEW QUESTION ---\n\nCategory: ${question.category}\nClue: ${question.clue}\nReward: ${question.reward}`);
                // const st = "(hello what the fuck)";
                // st.replace("(", "");
                // st.replace("hello", "");
                // console.log(st);
                return;
            });
        });
        return;
    });
}

const botLogin = process.env.JBL;
bot.login(botLogin);
