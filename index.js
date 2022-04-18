const Discord = require('discord.js');
const { MongoClient } = require("mongodb");


const DB_SIZE = 48358;

// connect to mongo database
const uri = `mongodb+srv://asher:HkpcuryhyhLazLj4@cluster0.u5pnm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

async function startDb(){
    await client.connect();
    getRandomQuestion();
}
    
startDb();
//-----------------------

async function getRandomQuestion(){
    const db = client.db("QuestionsDB");
    const collection = db.collection("question");

    let id = Math.floor(Math.random() * DB_SIZE);

    var question = await collection.findOne({identifier: id});
    console.log(question);
}


const bot = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES"] });

bot.on('messageCreate', async (msg) => {
    console.log("hi!");
    let guilds = await bot.guilds.fetch();
    // console.log(guilds);
    sendQuestionToAllServers();
});

async function sendQuestionToAllServers(){
    await bot.guilds.fetch()
    .then(guilds => {
        guilds.forEach(guild => {
            let question = await getRandomQuestion();
            
        });
    });
}


// getRandomQuestion();
// const botLogin = process.env.JeopardyBotLogin;
// console.log(`login: ${botLogin}`);
bot.login("OTY1NDAwNTIxNTEyOTgwNTAw.YlypTA.SrugXkWwX6JeVPOlVn6aAf-XPXQ");
