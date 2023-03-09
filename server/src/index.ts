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

const endCallTimeOuts: any = {}

const KEEP_CONNECTION_ALIVE_INTERVAL = 1000 * 60


app.ws('/:userId', async (ws: any, req: any) => {
    const userId = req.params.userId
    console.log("connect : ", userId)
    clientSockets[userId] = { ws, uid: userId, lastTimeOfCommunication: Date.now(), intervalID: null }

    // if (endCallTimeOuts[userId]) {
    //     clearTimeout(endCallTimeOuts[userId].timeout)
    // }

    startWebSocketInterval(userId)

    ws.on('message', (data: any) => {
        const msg = JSON.parse(data)

        //WEBSOCKET
        if (msg.topic == "ping") {
            const userId = msg.data.userId
            restartActivityInterval(userId)
        }

        //SIGNALING SERVER
        if (msg.topic == 'new_offer') {
            const callId = newCall(msg.data)
            handleNewOffer(clientSockets, msg.data, callId)
        }
        if (msg.topic == 'client_answer_to_offer') {
            callStateChange(msg.data.callId, 'OFFER_ACCEPTED')
            establishCall(clientSockets, msg.data)
        }
        if (msg.topic == "user-online") {
            refreshOnlineUsers()
        }
        if (msg.topic == "candidate") {
            handleCandidateChange(msg.data)
        }
        if (msg.topic == "ready") {
            callStateChange(msg.data.callId, "CALL_STARTED")
            handleCallStart(msg.data)
        }

        //CALL FUNCTIONS
        if (msg.topic == "end_call") {
            const callId = msg.data.callId
            const userId = msg.data.origin
            endCall(callId, userId)
            console.log(calls)
        }
    })

    ws.on('close', (ws: any) => {

        //createEndCallTimeoutOnUserDisconnection(userId)
        disconnectWS(clientSockets, userId, 'Socket close')
    });

    ws.on('error', (e: any) => {
        console.error(e);
        disconnectWS(clientSockets, userId, 'Error')
    })
})

const startWebSocketInterval = (userId: string) => {
    const clientSocket = clientSockets[userId]
    if (!clientSocket) {
        return
    }
    clientSocket.intervalID = setInterval(() => {
        const diff = Date.now() - clientSocket.lastTimeOfCommunication
        if (diff >= timeout) {
            disconnectWS(clientSockets, userId, 'Inactivity')
        }
    }, KEEP_CONNECTION_ALIVE_INTERVAL)
}

const clearUserInterval = (userId: string) => {
    const clientSocket = clientSockets[userId]
    if (clientSocket?.intervalID) {
        clearInterval(clientSocket.intervalID)
        clientSocket.intervalID = null
    }
}
const restartActivityInterval = (userId: string) => {
    clearUserInterval(userId)
    startWebSocketInterval(userId)
}



const newCall = (data: any) => {
    const callId = uuidv4()
    calls[callId] = {
        callId: callId,
        partitipants: [data.origin, data.target],
        origin: data.origin,
        target: data.target,
        state: 'INITIAL_OFFER'
    }
    return callId
}


const endCall = (callId: string, userId: string) => {
    const call = calls[callId]
    console.log(call)
    for (let partitipant of call?.partitipants) {
        if (call.state != 'CALL_ENDED') {
            const client = clientSockets[partitipant]
            const payload: WebsocketMessage = {
                topic: 'call_ended',
                data: {
                    callId: callId,
                    origin: userId
                }
            }
            client.ws.send(JSON.stringify(payload))
        }
    }
    callStateChange(callId, "CALL_ENDED")
}

const callStateChange = (callId: string, newState: string) => {
    calls[callId].state = newState
    if (newState == "CALL_STARTED") {
        calls[callId].call_start_timestamp = new Date().toISOString()
    }
    if (newState == "CALL_ENDED") {
        calls[callId].call_end_timestamp = new Date().toISOString()
    }
}

const handleCallStart = (data: any) => {
    const callToStart = calls[data.callId]
    //@ts-ignore
    callToStart.partitipants.map(partitipant => {
        const client = clientSockets[partitipant]
        const payload: WebsocketMessage = {
            topic: 'call_started',
            data: { call: calls[data.callId] }
        }
        client.ws.send(JSON.stringify(payload))
    })
}
const handleCandidateChange = (data: any) => {
    forEachClient(clientSockets, (client, i, arr) => {
        const payload: WebsocketMessage = {
            topic: 'server_candidate',
            data: {
                candidate: data.candidate
            }
        }
        client.ws.send(JSON.stringify(payload))
    })
}

///On users disconection starts a timeout that eventualy will end all user calls if users doesnt reconect to signaling server in time
const createEndCallTimeoutOnUserDisconnection = (userId: string) => {
    const endCallTimeOut = setTimeout(() => {
        const userCalls = getUserOngoingCalls(userId)
        userCalls.map(call => endCall(call.id, userId))
    }, 10000)
    endCallTimeOuts[userId] = { timeout: endCallTimeOut, callsToEnd: getUserOngoingCalls(userId)}
}
const getUserOngoingCalls = (userId: string) => {
    return Object.values(calls).filter(call => call.partitipants.includes(userId))
}

const forEachClient = (clientSockets: ClientSockets, cb: (value: ClientSocket, index: number, array: ClientSocket[]) => any) => Object.values(clientSockets).forEach(cb)

const handleNewOffer = (clientSockets: ClientSockets, data: any, callId: string) => {
    forEachClient(clientSockets, (client, i, arr) => {
        if (client.uid != data.target) return;
        data.callId = callId
        const newOffer = {
            callId: callId,
            origin: data.origin,
            target: data.target,
            offer: data.offer,
            time: new Date().toISOString(),
        }

        const payload: WebsocketMessage = {
            topic: 'incoming_offer',
            data: newOffer
        }
        client.ws.send(JSON.stringify(payload))
    })
}


const establishCall = (clientSockets: ClientSockets, data: any) => {
    forEachClient(clientSockets, (client, i, arr) => {

        // console.log(client.uid,data)
        if (client.uid != data.target) return;

        const newAnswer = {
            answer: data.answer,
            origin: data.origin,
            callId: data.callId
        }
        //console.log(newAnswer)
        const payload: WebsocketMessage = {
            topic: 'incoming_answer',
            data: newAnswer
        }
        client.ws.send(JSON.stringify(payload))
    })

    //console.log(`starting call between user ${call.origin} and ${call.target}`)
}

const refreshOnlineUsers = () => {
    forEachClient(clientSockets, (client, i, arr) => {
        const payload: WebsocketMessage = {
            topic: 'user-online',
            data: {
                onlineUsers: Object.keys(clientSockets)
            }
        }
        client.ws.send(JSON.stringify(payload))
    })
}

const timeout = 10 * 1000


const disconnectWS = (clientSockets: ClientSockets, id: string, cause: string) => {
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


type WebsocketMessage = {
    topic: string,
    data: any
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


