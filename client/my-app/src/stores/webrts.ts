
import { throws } from 'assert';
import { makeAutoObservable, makeObservable } from 'mobx'
import { toJS } from 'mobx';


export class WebRtc {
    ws: any = null
    isConnected: boolean = false;

    incomingOffer: any = null

    peerConnection: RTCPeerConnection = null

    Send_dataChannel: any = null
    Receive_dataChannel: any = null
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
                createWebrtcIntialConnection()
            });
            ws.addEventListener('message', (event) => {
                try {
                    const parseData = JSON.parse(event.data)
                    if (parseData) {
                        if (parseData.topic == "incoming_offer") {
                            console.log(parseData.message)
                            this.incomingCall[parseData.callId] = parseData.message
                            onOffer(parseData.message)
                        }
                        if (parseData.topic == "user-online") {
                            storeOnlineUsers(parseData.message.onlineUsers)
                        }
                        if (parseData.topic == 'incoming_answer') {
                            console.log("i am here")
                            onAnswer(parseData.message)
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


function createWebrtcIntialConnection() {
    //ICE server
    var configuration = {
        "iceServers": [
            {
                "urls": "stun:stun.1.google.com:19302"
            },
            {
                urls: 'turn:192.158.29.39:3478?transport=tcp',
                credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
                username: '28224511:1379330808'
            }
        ]
    };
    //navigator.mediaDevices.getUserMedia({audio: true, video: true});
    webRtcStore.peerConnection = new RTCPeerConnection(configuration);
    //when the browser finds an ice candidate we send it to another peer 
    webRtcStore.peerConnection.onicecandidate = (e) => icecandidateAdded(e, webRtcStore.userId);
    webRtcStore.peerConnection.oniceconnectionstatechange = handlestatechangeCallback;
    webRtcStore.peerConnection.onnegotiationneeded = handleonnegotiatioCallback;

}

export async function creatingOffer(targetId) {
    try {
        const offer = await webRtcStore.peerConnection.createOffer({ iceRestart: true });
        await webRtcStore.peerConnection.setLocalDescription(offer);

        console.log("creating offer ---");
        console.log("offer = " + webRtcStore.peerConnection.localDescription);
        webRtcStore.sendMessage('new_offer', {
            origin: webRtcStore.userId,
            target: targetId,
            offer: offer
        });

    } catch (e) {
        alert("Failed to create offer:" + e);
    }
}


function onOffer(offer) {

    console.log("somebody wants to call us  => offer = " + offer);
    webRtcStore.incomingOffer = offer;
    /*create a popup to accept/reject room request*/
}

export function creatingAnswer(originalCaller, callId) {
    console.log(webRtcStore.incomingOffer)
    //create RTC peer connection from receive end
    createWebrtcIntialConnection()
    //create a data channel bind
    webRtcStore.peerConnection.ondatachannel = receiveChannelCallback;
    console.log(webRtcStore.incomingOffer.offer)
    webRtcStore.peerConnection.setRemoteDescription(new RTCSessionDescription(webRtcStore.incomingOffer.offer))
        .then(() => webRtcStore.peerConnection.createAnswer())
        .then(function (answer) {
            console.log(answer)
            webRtcStore.peerConnection.setLocalDescription(answer);
            console.log("creating answer  => answer = " + webRtcStore.peerConnection.localDescription);
            webRtcStore.sendMessage('client_answer_to_offer', {
                target: originalCaller,
                origin: webRtcStore.userId,
                callId: callId,
                answer: answer
            });
        })
        .catch(function (err) {
            console.log(err.name + ': ' + err.message, " failed");
        });
}

function onAnswer(answer) {
    console.log("when another user answers to  offer => answer = " + answer);
    webRtcStore.peerConnection.setRemoteDescription(new RTCSessionDescription(answer.answer));
    webRtcStore.sendMessage('ready',{});

    console.log(toJS(webRtcStore.peerConnection))
}

var receiveChannelCallback = function (event) {
    webRtcStore.Receive_dataChannel = event.channel;
    webRtcStore.Receive_dataChannel.onopen = onReceive_ChannelOpenState;
    webRtcStore.Receive_dataChannel.onmessage = onReceive_ChannelMessageCallback;
    webRtcStore.Receive_dataChannel.onerror = onReceive_ChannelErrorState;
    webRtcStore.Receive_dataChannel.onclose = onReceive_ChannelCloseStateChange;
};

const storeOnlineUsers = (users) => {
    const userIds = {}
    for (let user of users) {
        userIds[user] = true
        webRtcStore.onlineUsers[user] = true
    }

    for (let user of Object.keys(webRtcStore.onlineUsers)) {
        if (!userIds[user]) {
            delete webRtcStore.onlineUsers[user]
        }
    }
}

export const webRtcStore = new WebRtc()





function icecandidateAdded(ev, userId) {
    console.log("ICE candidate = " + ev.candidate);
    if (ev.candidate) {
        webRtcStore.sendMessage("candidate", {
            message: {
                origin: userId,
                candidate: ev.candidate
            }
        });
    }
};
var handlestatechangeCallback = function (event) {
    /* if you want , use this function for webrtc state change event  */
    const state = webRtcStore.peerConnection.iceConnectionState;
    if (state === "failed" || state === "closed") {
        /* handle state failed , closed */
    } else if (state === "disconnected") {
        /* handle state disconnected */
    }
};
var handleonnegotiatioCallback = function (event) {
    /* if you want , use this function for handleonnegotiatioCallback  */
};


export type CallModel = {
    callId: string,
    origin: string,
    target: string,
    time: string,
    onGoingCall: boolean,
    answerPending: boolean
}




var onReceive_ChannelOpenState = function (event) {

    console.log("dataChannel.OnOpen", event);

    if (webRtcStore.Receive_dataChannel?.readyState == "open") {
        /* */
    }
};
/**
 * This function will handle the data channel message callback.
 */
var onReceive_ChannelMessageCallback = function (event) {
    console.log("dataChannel.OnMessage:", event);
    //UpdateChatMessages(event.data, false);
};
/**
 * This function will handle the data channel error callback.
 */
var onReceive_ChannelErrorState = function (error) {
    console.log("dataChannel.OnError:", error);
};
/**
 * This function will handle the data channel close callback.
 */
var onReceive_ChannelCloseStateChange = function (event) {
    console.log("dataChannel.OnClose", event);
};