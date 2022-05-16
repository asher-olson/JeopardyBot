export default class QuestionManager{
    constructor(){
        this.servers = {
            "<guild id>": {
                "category": "<category>",
                "clue": "<clue>",
                "answer": "<answer>",
                "reward": "<reward>",
                "answered": false,
                "dailyDouble": false,
                "playerId": -1,
                "wager": 0
            }
        };
    }

    setQuestion(guildId, question){
        this.servers[guildId] = {
            "category": question.category,
            "clue": question.clue,
            "answer": question.answer,
            "reward": question.reward,
            "answered": false,
            "dailyDouble": false,
            "playerId": -1,
            "wager": 0
        }
        // console.log(this.servers);
    }

    setAnswered(guildId, boo){
        this.servers[guildId]["answered"] = boo;
    }

    getQuestion(guildId){
        if(!(guildId in this.servers)){
            return null;
        }

        return this.servers[guildId];
    }

    setWager(guildId, wager){
        this.servers[guildId]["wager"] = wager;
    }

    getWager(guildId){
        return this.servers[guildId]["wager"];
    }

    setDailyDouble(guildId, boo){        // call this when daily double drops on server
        this.servers[guildId]["dailyDouble"] = boo;
    }

    getDailyDouble(guildId){
        if(this.servers[guildId]["dailyDouble"] === undefined){
            return false;
        }
        return this.servers[guildId]["dailyDouble"];
    }

    setPlayer(guildId, playerId){   // call this when first person wagers after a dd
        if(this.servers[guildId]["playerId"] === -1){
            this.servers[guildId]["playerId"] = playerId;
            return true;
        }
        return false;
        
    }

    getPlayer(guildId){
        return this.servers[guildId]["playerId"];
    }

    // score the answer based on similarity to the correct answer
    // if good enough return true else false
    answer(guildId, answer, playerId){
        let correctTokens = this.servers[guildId].answer.toLowerCase().split(" ");
        let answerTokens = answer.split(" ");
        var score = 0;
        var numNonPrep = 0;
        let preps = ["the", "a", "and", "&", "an"];    //add more?
        correctTokens.forEach(token => {
            // TODO: remove "." from both answer and correct for abbreviations
            // replace '\', '(', ')', ", " to avoid bullshit
            let removeRegex = /\(|\)|\\|"|"/g;
            token = token.replace(removeRegex, '');
            console.log(token);
            if(preps.includes(token)){  //dont count prepositions
                return;
            }

            numNonPrep++;

            if((answerTokens.includes(token))){
                score++;
            }
        });

        console.log(answerTokens);
        // console.log(correctTokens);
        console.log(`score: ${score}\ntotal: ${numNonPrep}`);
        if(score / numNonPrep > 0.5){
            this.servers[guildId].answered = true;
            return parseInt(this.servers[guildId].reward);
        }
        return 0;
    }
}

