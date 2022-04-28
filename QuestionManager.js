export default class QuestionManager{
    constructor(){
        this.servers = {
            "<guild id>": {
                "clue": "<clue>",
                "answer": "<answer>",
                "reward": "<reward>",
                "answered": false
            }
        };
    }

    setQuestion(guildId, question){
        console.log("adding this:");
        console.log(question);
        this.servers[guildId] = {
            "clue": question.clue,
            "answer": question.answer,
            "reward": question.reward,
            "answered": false
        }
        console.log(this.servers);
    }

    getQuestion(guildId){
        if(!(guildId in this.servers)){
            return null;
        }

        return this.servers[guildId];
    }

    // score the answer based on similarity to the correct answer
    // if good enough return true else false
    answer(guildId, answer){
        let correctTokens = this.servers[guildId].answer.toLowerCase().split(" ");
        let answerTokens = answer.split(" ");
        var score = 0;
        var numNonPrep = 0;
        let preps = ["the", "a", "and", "&"];    //add more?
        correctTokens.forEach(token => {
            if(preps.includes(token)){  //dont count prepositions
                return;
            }

            numNonPrep++;

            if((answerTokens.includes(token))){
                score++;
            }
        });

        console.log(answerTokens);
        console.log(correctTokens);
        console.log(`score: ${score}\ntotal: ${numNonPrep}`);
        if(score / numNonPrep > 0.5){
            this.servers[guildId].answered = true;
            return parseInt(this.servers[guildId].reward);
        }
        return 0;
    }
}

