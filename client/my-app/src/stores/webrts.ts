
import { throws } from 'assert';
import { makeAutoObservable, makeObservable } from 'mobx'
import { toJS } from 'mobx';


const KEEP_WS_ALIVE_INTERVAL = 20 * 1000
const CHECK_CONNECTION_INTERVAL = 10 * 1000
export class WebRtc {
    ws: WebSocket = null
    isConnected: boolean = false;  //for websocket

    incomingCalls: Record<string, any> = {}
    onGoingCall: any = null

    peerConnection: RTCPeerConnection = null
    currentUserStream: any = null
    currentUsermicrophoneAudioStream: any = null
    connectionSenderVideo: any = null

    Send_dataChannel: any = null
    Receive_dataChannel: any = null
    userId: string = null
    onlineUsers: Record<string, boolean> = {}
    receivingStream: any = null

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
        }, CHECK_CONNECTION_INTERVAL);
    }
    initWebSocket = () => {
        try {
            const flag = localStorage.getItem("flag")
            //console.log(flag)
            const remoteServer = flag == "remote" ? "192.168.101.143" : 'localhost'
            console.log(remoteServer)
            setInterval(() => {
                if (this.isConnected) {
                    this.sendMessage("ping", { userId: this.userId })
                }
            }, KEEP_WS_ALIVE_INTERVAL);

            if (!this.userId) {
                return
            }
            const ws = new WebSocket('ws://' + remoteServer + ':' + '5000/' + this.userId);

            ws.addEventListener('open', (event) => {
                this.isConnected = true;
                this.ws = ws
                this.sendMessage('user-online', { userId: this.userId })
            });
            ws.addEventListener('message', (event) => {
                try {
                    const parseData = JSON.parse(event.data)
                    if (parseData) {
                        if (parseData.topic == "incoming_offer") {

                            onOffer(parseData.data)
                        }
                        if (parseData.topic == "user-online") {
                            storeOnlineUsers(parseData.data.onlineUsers)
                        }
                        if (parseData.topic == 'incoming_answer') {
                            onAnswer(parseData.data)
                        }
                        if (parseData.topic == "server_candidate") {
                            onCandidate(parseData.data.candidate)
                        }
                        if (parseData.topic == "call_started") {
                            delete this.incomingCalls[parseData.data.call?.callId]
                            this.onGoingCall = parseData.data.call
                            // console.log(this.onGoingCall)
                        }
                        if (parseData.topic == "call_ended") {
                            console.log("stop call ***********")
                            if (this.onGoingCall.callId == parseData.data.callId) {
                                this.onGoingCall = null
                            }
                            this.peerConnection.close()
                            this.connectionSenderVideo = null
                            this.peerConnection = null
                        }

                    }
                } catch (error) {
                    //console.log(error);
                }
            });
            ws.addEventListener('error', (event) => {
                //console.log('WebSocket error: ', event);
                this.isConnected = false
            });
            ws.addEventListener('close', (event) => {
                if (event.code != 1000) {
                    this.isConnected = false
                    console.log('WebSocket closed: ', event);
                }
            });
        } catch (e) {
            this.isConnected = false
        }
    }

    sendMessage(topic: string, data) {
        const payload = JSON.stringify({ topic, data })
        this.ws.send(payload)
    }

    endOngoingCall() {
        this.sendMessage('end_call', {
            origin: this.userId,
            callId: this.onGoingCall.callId
        });
    }
}

async function onCandidate(candidate) {
    //console.log("-- new received candidate ")
    try {
        const peerConnection = webRtcStore.peerConnection
        await (peerConnection.addIceCandidate(candidate));
        onAddIceCandidateSuccess(peerConnection);
    } catch (e) {
        onAddIceCandidateError(webRtcStore.peerConnection, e);
    }
}
function onAddIceCandidateSuccess(pc) {
    //console.log(`-- IceCandidate added successfully..`);
}
function onAddIceCandidateError(pc, error) {
    //console.log(`-- Failed to add ICE Candidate: ${error.toString()}`);
}
async function createWebrtcIntialConnection() {
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

    webRtcStore.peerConnection = new RTCPeerConnection(configuration);
    //when the browser finds an ice candidate we send it to another peer 
    webRtcStore.peerConnection.onicecandidate = (e) => icecandidateAdded(e, webRtcStore.userId);
    webRtcStore.peerConnection.oniceconnectionstatechange = handlestatechangeCallback;
    webRtcStore.peerConnection.onnegotiationneeded = handleonnegotiatioCallback;

}

const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};


export async function creatingOffer(targetId) {
    try {
        await createWebrtcIntialConnection()
        //@ts-ignore
        const offer = await webRtcStore.peerConnection.createOffer(offerOptions);
        await webRtcStore.peerConnection.setLocalDescription(offer);

        console.log("-- creating offer");
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
    console.log("--somebody wants to call us");
    webRtcStore.incomingCalls[offer.callId] = offer;
    /*create a popup to accept/reject room request*/
}

export async function creatingAnswer(originalCaller, callId) {
    await createWebrtcIntialConnection()
    webRtcStore.peerConnection.ondatachannel = receiveChannelCallback;
    webRtcStore.peerConnection.setRemoteDescription(webRtcStore.incomingCalls[callId].offer)
        .then(() => webRtcStore.peerConnection.createAnswer())
        .then(function (answer) {
            webRtcStore.peerConnection.setLocalDescription(answer);
            webRtcStore.sendMessage('client_answer_to_offer', {
                target: originalCaller,
                origin: webRtcStore.userId,
                callId: callId,
                answer: answer
            });
        })
        .catch(function (err) {
            //console.log(err.name + ': ' + err.message, " failed");
        }).finally(() =>
            delete webRtcStore.incomingCalls[callId]
        )
}

function onAnswer(answer) {
    console.log("--user answered")
    webRtcStore.peerConnection.setRemoteDescription(answer.answer);
    webRtcStore.sendMessage('ready', { callId: answer.callId, user: webRtcStore.userId, state: 'ENTERING_CALL' });
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
    //console.log("-- new ICE candidate");
    if (ev.candidate) {
        webRtcStore.sendMessage("candidate", {
            origin: userId,
            candidate: ev.candidate
        });
    }
};
var handlestatechangeCallback = function (event) {
    const state = webRtcStore.peerConnection.iceConnectionState;
    if (state === "failed" || state === "closed") {

    } else if (state === "disconnected") {

    }
};
var handleonnegotiatioCallback = function (event) {

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

    //console.log("dataChannel.OnOpen");

    if (webRtcStore.Receive_dataChannel?.readyState == "open") {

    }
};

var onReceive_ChannelMessageCallback = function (event) {
    //console.log("dataChannel.OnMessage:");

};

var onReceive_ChannelErrorState = function (error) {
    //console.log("dataChannel.OnError:");
};

var onReceive_ChannelCloseStateChange = function (event) {
    //console.log("dataChannel.OnClose");
};