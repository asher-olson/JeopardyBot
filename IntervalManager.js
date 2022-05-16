export default class IntervalManager{
    constructor(){
        this.intervals = {
            // "<guildId>": { 
            //     "interval": "<interval>",
            //     "timeBetweenQuestions": "<time between>"
            // }
        }
    }

    setBoth(guildId, interval, timeBetween){
        this.intervals[guildId] = {"timeBetween": timeBetween, "interval": interval};
    }

    setTimeBetween(guildId, timeBetween){
        this.intervals[guildId] = {"timeBetween": timeBetween};
        // console.log(this.intervals);
    }

    // time between must be set already to use this alone
    setIv(guildId, interval){
        this.intervals[guildId]['interval'] = interval;
        // console.log(this.intervals);
    }

    getTimeBetween(guildId){
        return this.intervals[guildId]["timeBetween"];
    }

    clearAll(){
        for(const prop in this.intervals){
            // console.log(this.intervals[prop]['interval']);
            clearInterval(this.intervals[prop]['interval']);
        }
        console.log("all intervals cleared");
        // console.log(this.intervals);
    }

    clearOne(guildId){
        clearInterval(this.intervals[guildId]["interval"]);
    }
}