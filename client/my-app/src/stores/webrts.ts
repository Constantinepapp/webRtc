
import { throws } from 'assert';
import { makeAutoObservable, makeObservable } from 'mobx'
import { toJS } from 'mobx';


export class WebRtc {
    ws: any = null
    isConnected: boolean = false;

    incomingCalls: Record<string, any> = {}
    onGoingCall:any = null

    peerConnection: RTCPeerConnection = null

    currentUserStream: any = null
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
        }, 3000);
    }
    initWebSocket = () => {
        try {

            if (!this.userId) {
                return
            }
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
                        if (parseData.topic == "incoming_offer") {
                
                            onOffer(parseData.message)
                        }
                        if (parseData.topic == "user-online") {
                            storeOnlineUsers(parseData.message.onlineUsers)
                        }
                        if (parseData.topic == 'incoming_answer') {
                            onAnswer(parseData.message)
                        }
                        if (parseData.topic == "server_candidate") {
                            onCandidate(parseData.candidate)
                        }
                        if(parseData.topic == "call_started"){
                            console.log(parseData)
                            this.onGoingCall = parseData.call
                            console.log(this.onGoingCall)
                        }
                        if(parseData.topic == "call_ended"){
                            if(this.onGoingCall.callId == parseData.callId){
                                this.onGoingCall = null
                            }
                        
                            this.peerConnection.close()
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

    sendMessage(topic: string, message) {
        const payload = JSON.stringify({ topic, message })
        this.ws.send(payload)
    }

    gotMessage(message: any) {
        //console.log(message)
    }



    endOngoingCall(){
        webRtcStore.sendMessage('end_call', {
            origin: webRtcStore.userId,
            callId:webRtcStore.onGoingCall.callId
        });
    }
}

async function onCandidate(candidate) {
    console.log("-- new received candidate ")
    try {
        const peerConnection = webRtcStore.peerConnection
        await (peerConnection.addIceCandidate(candidate));
        onAddIceCandidateSuccess(peerConnection);
    } catch (e) {
        onAddIceCandidateError(webRtcStore.peerConnection, e);
    }
}
function onAddIceCandidateSuccess(pc) {
    console.log(`-- IceCandidate added successfully..`);
}
function onAddIceCandidateError(pc, error) {
    console.log(`-- Failed to add ICE Candidate: ${error.toString()}`);
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

const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};


export async function creatingOffer(targetId) {
    try {
        createWebrtcIntialConnection()
        //@ts-ignore
        const offer = await webRtcStore.peerConnection.createOffer(offerOptions);
        await webRtcStore.peerConnection.setLocalDescription(offer);

        console.log("-- creating offer");
        //console.log("offer = " + webRtcStore.peerConnection.localDescription);
        webRtcStore.sendMessage('new_offer', {
            origin: webRtcStore.userId,
            target: targetId,
            offer: offer
        });

    } catch (e) {
        alert("Failed to create offer:" + e);
    }
}

// function hasRTCPeerConnection() {
//     window.RTCPeerConnection = window.RTCPeerConnection || window.RTCPeerConnection || window.RTCPeerConnection;
//     window.RTCSessionDescription = window.RTCSessionDescription || window.RTCSessionDescription || window.RTCSessionDescription;
//     window.RTCIceCandidate = window.RTCIceCandidate || window.RTCIceCandidate || window.RTCIceCandidate;

//     return !!window.RTCPeerConnection;
// };

function onOffer(offer) {

    console.log("--somebody wants to call us");
    webRtcStore.incomingCalls[offer.callId] = offer;
    /*create a popup to accept/reject room request*/
}

export function creatingAnswer(originalCaller, callId) {
    //console.log(webRtcStore.incomingCalls)
    //create RTC peer connection from receive end
    createWebrtcIntialConnection()
    //create a data channel bind
    webRtcStore.peerConnection.ondatachannel = receiveChannelCallback;
    //console.log(webRtcStore.incomingCalls,callId)
    webRtcStore.peerConnection.setRemoteDescription(webRtcStore.incomingCalls[callId].offer)
        .then(() => webRtcStore.peerConnection.createAnswer())
        .then(function (answer) {
            //console.log(answer)
            webRtcStore.peerConnection.setLocalDescription(answer);
            //console.log("creating answer  => answer = " + webRtcStore.peerConnection.localDescription);
            webRtcStore.sendMessage('client_answer_to_offer', {
                target: originalCaller,
                origin: webRtcStore.userId,
                callId: callId,
                answer: answer
            });
        })
        .catch(function (err) {
            console.log(err.name + ': ' + err.message, " failed");
        }).finally( ()=>
            delete webRtcStore.incomingCalls[callId]
        )
}

function onAnswer(answer) {
    console.log("--user answered")
    webRtcStore.peerConnection.setRemoteDescription(answer.answer);
    webRtcStore.sendMessage('ready', {callId:answer.callId,user:webRtcStore.userId,state:'ENTERING_CALL'});

    //console.log(toJS(webRtcStore.peerConnection))
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
    console.log("-- new ICE candidate");
    if (ev.candidate) {
        webRtcStore.sendMessage("candidate", {
            origin: userId,
            candidate: ev.candidate
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