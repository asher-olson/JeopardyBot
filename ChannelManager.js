
// each guild will have an active text channel to send questions to
export default class ChannelManager{
    constructor(){
        this.channels = {
            // "<guildId>": { 
            //     "id": "<channelId>",
            //     "name": "<channelName>",
            //     "jRoleId": "<Jeopardy Role Id>"
            // }
        }
    }

    setChannel(guildId, channelObj){
        this.channels[guildId] = channelObj;
    }

    getChannel(guildId){
        if(!(guildId in this.channels)){
            return null;
        }
        return this.channels[guildId];
    }

    setJRole(guildId, jrole){
        this.channels[guildId]["jRoleId"] = jrole;
        // console.log(`channels: ${this.channels}`);
    }

    getJRole(guildId){
        // if(!(guildId in this.channels) || !(["jRoleId"] in this.channels[guildId])){
        //     return null;
        // }
        return this.channels[guildId]["jRoleId"];
    }
}