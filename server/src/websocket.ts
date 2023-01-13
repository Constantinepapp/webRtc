import WebSocket from 'ws';

const wsConnectionConfig: WebSocket.ServerOptions = { port: 5000, host: 'localhost' }


export default class WebSocketSrvServices {
    private wss: WebSocket.Server<WebSocket.WebSocket>;
    // waiting for socket configuration.. 
    public constructor(config : WebSocket.ServerOptions = wsConnectionConfig) {
        this.wss = new WebSocket.Server(wsConnectionConfig);             
        this.wss.on('connection', (ws: WebSocket) => {
            // handling client connection error
            ws.onerror = function () {
                console.log("Some Error occurred")
            }
        });
    }

    public BroadcastMessage = (message: string) => {
        try {
            this.wss.clients.forEach(function each(client: any) {
                console.log(client)
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        } catch (e) {
            console.log('error' + e)
        }

    }
}