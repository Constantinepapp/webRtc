
import { Router } from "express"
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from "ws";
import { json } from "body-parser";

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
let checkConnectionInterval:any = null

type CallModel = {
    callId: string,
    origin: string,
    target: string,
    time: string,
    onGoingCall: boolean,
    answerPending: boolean
}

app.ws('/:userId', async (ws: any, req: any) => {
    const userId = req.params.userId
    console.log("connect : ",userId)
    clientSockets[userId] = { ws, uid: userId, lastTimeOfCommunication: Date.now(), intervalID: null }
    
   
    // const clientSocket = clientSockets[userId]
    // clientSocket.intervalID = setInterval(() => {
    //     const diff = Date.now() - clientSocket.lastTimeOfCommunication
    //     if (diff >= timeout) {
    //         disconnectWS(clientSockets,userId)
    //     }
    // }, 1000 * 10)

    ws.on('message', (data: any) => {
        const msg = JSON.parse(data)
        // if (msg.topic == "connection-start") {
        //     sendOffer(clientSockets,msg.message)
        // }
        if(msg.topic == 'new_offer'){
            handleNewOffer(clientSockets,msg.message)
        }
        if (msg.topic == 'client_answer_to_offer') {
            console.log(msg)
            establishCall(clientSockets,msg.message)
        }
        if(msg.topic == "user-online"){
            refreshOnlineUsers()
        }
        if(msg.topic == "candidate"){
            handleCandidateChange(msg.message)
        }
        
        
    })

    ws.on('close', (ws: any) => {
        disconnectWS(clientSockets, userId)
    });

    ws.on('error', (e: any) => {
        console.error(e);
        disconnectWS(clientSockets, userId)
    })
})

const handleCandidateChange = (message:any) =>{
    forEachClient(clientSockets, (client, i, arr) => {
        client.ws.send(JSON.stringify({topic:'server_candidate',candidate:message.candidate}))
    })
}

const forEachClient = (clientSockets: ClientSockets, cb: (value: ClientSocket, index: number, array: ClientSocket[]) => any) => Object.values(clientSockets).forEach(cb)

const handleNewOffer = (clientSockets: ClientSockets, message: any) => {
    forEachClient(clientSockets, (client, i, arr) => {
        
        console.log(message)
        console.log(message.target)
        if (client.uid != message.target) return;
        const callId = uuidv4()
        message.callId = callId
        const newOffer = {
            callId:uuidv4(),
            origin: message.origin,
            target: message.target,
            offer:message.offer,
            time: new Date().toISOString(),
        }
        calls[callId] = {
            callId:callId
        }
        console.log(newOffer)
        client.ws.send(JSON.stringify({topic:'incoming_offer',message:newOffer}))
    })
}


const iceCandidate = (clientSockets:ClientSockets,message:any) =>{

}

const establishCall = (clientSockets:ClientSockets,message:any) => {
    forEachClient(clientSockets, (client, i, arr) => {
        
        console.log(client.uid,message)
        if (client.uid != message.target) return;
       
        const newAnswer = {
            answer:message.answer,
            origin:message.origin
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


const disconnectWS = (clientSockets: ClientSockets, id: string) => {
    const clientSocket = clientSockets[id]
    console.log("disconect : ",id)
    if (clientSocket) {
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