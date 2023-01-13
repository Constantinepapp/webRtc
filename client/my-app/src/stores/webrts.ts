
import { throws } from 'assert';
import { makeAutoObservable, makeObservable } from 'mobx'
import { toJS } from 'mobx';


export class WebRtc {
    ws: any = null
    isConnected: boolean = false;
    userId: string = null
    incomingCall: Record<string, CallModel> = {};
    onlineUsers: Record<string, boolean> = {}

    constructor() {
        makeAutoObservable(this);
        setInterval(() => {
            if (this.isConnected) {
                console.log("connected...")
            }
            else {
                console.log("checking if should connect...")
            }
            if (this.userId) {
                if (!this.isConnected) { this.initWebSocket(); console.log('Connection Lost: trying to connect to server... ') }
            }
        }, 3000);
    }
    initWebSocket = () => {
        try {

            if (!this.userId) {
                return
            }
            console.log(this.userId)
            const ws = new WebSocket('ws://' + 'localhost' + ':' + '5000/' + this.userId);

            ws.addEventListener('open', (event) => {
                this.isConnected = true;
                this.ws = ws
                this.sendMessage('user-online', { userId: this.userId })
            });
            ws.addEventListener('message', (event) => {
                try {
                    const parseData = JSON.parse(event.data)
                    if (parseData) {
                        if (parseData.topic == "connection-start") {
                            this.incomingCall[parseData.callId] = parseData.message
                        }
                        if (parseData.topic == "user-online") {
                            storeOnlineUsers(parseData.message.onlineUsers)
                        }
                    }
                } catch (error) {
                    //console.log(error);
                }
                console.log(toJS(this.incomingCall))
            });
            ws.addEventListener('error', (event) => {
                //console.log('WebSocket error: ', event);
                this.isConnected = false
            });
            ws.addEventListener('close', (event) => {
                console.log(event)
                if (event.code != 1000) {
                    this.isConnected = false
                    console.log('WebSocket closed: ', event);
                }
            });
        } catch (e) {
            this.isConnected = false
        }
    }

    sendMessage(topic: string, message) {
        const payload = JSON.stringify({ topic, message })
        this.ws.send(payload)
    }

    gotMessage(message: any) {
        console.log(message)
    }
}


const storeOnlineUsers = (users) => {
    const userIds = {}
    for (let user of users) {
        userIds[user] = true
        webRtcStore.onlineUsers[user] = true
    }

    for(let user of Object.keys(webRtcStore.onlineUsers)){
        if(!userIds[user]){
            delete webRtcStore.onlineUsers[user]
        }
    }
}

export const webRtcStore = new WebRtc()


export type CallModel = {
    callId: string,
    origin: string,
    target: string,
    time: string,
    onGoingCall: boolean,
    answerPending: boolean
}