import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from "ws";

require('dotenv').config()

const express = require("express")
const app = express()
const cors = require("cors")
require('express-ws')(app);



app.use(cors())
app.use(express.json());




///ROUTES//
app.get("/api", (req: any, res: any) => {
    res.json({ message: "Hello from server!" });
});


///////////SOCKET

var clientSockets = {} as ClientSockets
// const clientToClientCalls = {} as Record<Calls>
var calls = {} as Record<string, any>

const KEEP_CONNECTION_ALIVE_INTERVAL = 1000 * 60


app.ws('/:userId', async (ws: any, req: any) => {
    const userId = req.params.userId
    console.log("connect : ",userId)
    clientSockets[userId] = { ws, uid: userId, lastTimeOfCommunication: Date.now(), intervalID: null }
    
    startWebSocketInterval(userId)

    ws.on('message', (data: any) => {
        const msg = JSON.parse(data)

        //WEBSOCKET
        if(msg.topic == "ping"){
            const userId = msg.message.userId
            restartActivityInterval(userId)
        }
        
        //SIGNALING SERVER
        if(msg.topic == 'new_offer'){
            const callId = newCall(msg.message)
            handleNewOffer(clientSockets,msg.message,callId)
        }
        if (msg.topic == 'client_answer_to_offer') {
            callStateChange(msg.message.callId,'OFFER_ACCEPTED')
            establishCall(clientSockets,msg.message)
        }
        if(msg.topic == "user-online"){
            refreshOnlineUsers()
        }
        if(msg.topic == "candidate"){
            handleCandidateChange(msg.message)
        }
        if(msg.topic == "ready"){
            callStateChange(msg.message.callId,"CALL_STARTED")
            handleCallStart(msg.message)
        }
        
        //CALL FUNCTIONS
        if(msg.topic == "end_call"){
            const callId = msg.message.callId
            const userId = msg.message.origin
            endCall(callId,userId)
        }
    })

    ws.on('close', (ws: any) => {
        disconnectWS(clientSockets, userId,'Socket close')
    });

    ws.on('error', (e: any) => {
        console.error(e);
        disconnectWS(clientSockets, userId,'Error')
    })
})

const startWebSocketInterval = (userId:string) =>{
    const clientSocket = clientSockets[userId]
    clientSocket.intervalID = setInterval(() => {
        const diff = Date.now() - clientSocket.lastTimeOfCommunication
        if (diff >= timeout) {
            disconnectWS(clientSockets,userId,'Inactivity')
        }
    }, KEEP_CONNECTION_ALIVE_INTERVAL)
}

const clearUserInterval = (userId:string) =>{
    const clientSocket = clientSockets[userId]
    if(clientSocket?.intervalID){
        clearInterval(clientSocket.intervalID)
        clientSocket.intervalID = null
    }
}
const restartActivityInterval = (userId:string) =>{
    clearUserInterval(userId)
    startWebSocketInterval(userId)
}



const newCall = (message:any) =>{
    const callId = uuidv4()
    calls[callId] = {
        callId:callId,
        partitipants:[message.origin,message.target],
        origin:message.originm,
        target:message.target,
        state:'INITIAL_OFFER'
    }
    return callId
}


const endCall = (callId:string,userId:string) =>{
    const call = calls[callId]
    for(let partitipant of call.partitipants){
        if(call.state != 'CALL_ENDED'){
            const client = clientSockets[partitipant]
            client.ws.send(JSON.stringify({topic:'call_ended',callId:callId,origin:userId}))
        }
    }
    callStateChange(callId,"CALL_ENDED")
}

const callStateChange = (callId:string,newState:string) =>{
    calls[callId].state = newState
    if(newState=="CALL_STARTED"){
        calls[callId].call_start_timestamp = new Date().toISOString()
    }
    if(newState == "CALL_ENDED"){
        calls[callId].call_end_timestamp = new Date().toISOString()
    }
}

const handleCallStart = (message:any) =>{
    const callToStart = calls[message.callId]
    //@ts-ignore
    callToStart.partitipants.map(partitipant =>{
        const client = clientSockets[partitipant]
        client.ws.send(JSON.stringify({topic:'call_started',call:calls[message.callId]}))
    })
}
const handleCandidateChange = (message:any) =>{
    forEachClient(clientSockets, (client, i, arr) => {
        client.ws.send(JSON.stringify({topic:'server_candidate',candidate:message.candidate}))
    })
}

const forEachClient = (clientSockets: ClientSockets, cb: (value: ClientSocket, index: number, array: ClientSocket[]) => any) => Object.values(clientSockets).forEach(cb)

const handleNewOffer = (clientSockets: ClientSockets, message: any,callId:string) => {
    forEachClient(clientSockets, (client, i, arr) => {
        if (client.uid != message.target) return;
        message.callId = callId
        const newOffer = {
            callId:callId,
            origin: message.origin,
            target: message.target,
            offer:message.offer,
            time: new Date().toISOString(),
        }
        client.ws.send(JSON.stringify({topic:'incoming_offer',message:newOffer}))
    })
}


const establishCall = (clientSockets:ClientSockets,message:any) => {
    forEachClient(clientSockets, (client, i, arr) => {
        
        // console.log(client.uid,message)
        if (client.uid != message.target) return;
       
        const newAnswer = {
            answer:message.answer,
            origin:message.origin,
            callId:message.callId
        }
        //console.log(newAnswer)
        client.ws.send(JSON.stringify({topic:'incoming_answer',message:newAnswer}))
    })
 
    //console.log(`starting call between user ${call.origin} and ${call.target}`)
}

const refreshOnlineUsers = () =>{
    forEachClient(clientSockets, (client, i, arr) => {
        client.ws.send(JSON.stringify({
            topic:'user-online',
            message:{
                onlineUsers:Object.keys(clientSockets)
            }
        }))
    })
}

const timeout = 10 * 1000


const disconnectWS = (clientSockets: ClientSockets, id: string,cause:string) => {
    const clientSocket = clientSockets[id]
    console.log(`disconect : ${id} (${cause})`,)
    if (clientSocket) {
        clientSocket.ws.close()
        clearInterval(clientSockets[id].intervalID)
        delete clientSockets[id]
    }
    refreshOnlineUsers()
}

type ClientSocket = { ws: WebSocket, uid: string, lastTimeOfCommunication: number, intervalID: any }
type ClientSockets = Record<string, ClientSocket>

type UniqueUsers = Record<number, { userid: number, name: string, treepath: string, extNumber: string, inCall: boolean }>


type Calls = {
    origin: string,
    target: string,

}
//////////END SOCKET





app.listen(process.env.PORT || 5000, () => {
    console.log("server started")
})




////
//1. user 1 request signaling server
//2. server requests metadata from user 1
//3. server informs user 2 about the call
//4. user 2 accepts
//5. server requests from user 2 metadata
//6. user 2 sends metadata


