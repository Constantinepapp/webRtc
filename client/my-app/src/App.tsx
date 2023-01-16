import logo from './logo.svg';
import './App.css';
import { useEffect, useRef, useState } from 'react'
import { CallModel, creatingAnswer, creatingOffer, webRtcStore } from './stores/webrts';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';

const App = observer(function App() {


  const [targetUser, setTargetUser] = useState(null)
  useEffect(() => {


    // fetch("/api").then(res => res.json())
    // .then(json=>console.log(json))
    // .catch(err => { console.error(err) });

  }, [])

  const incomingCall = false

  useEffect(() => {
    //console.log(webRtcStore.peerConnection)
    if (webRtcStore.peerConnection) {
      const peerConnection = webRtcStore.peerConnection
      const stream = webRtcStore.currentUserStream
      stream.getTracks().forEach(track => { console.log(track); webRtcStore.peerConnection?.addTrack(track, stream) })
    }
  }, [webRtcStore.peerConnection])


  const startCall = () => {
    creatingOffer(targetUser)
    //webRtcStore.sendMessage('connection-start',{ message: `i am user ${webRtcStore.userId} and i call ${targetUser}`, topic: 'connection-start', target: targetUser, origin: webRtcStore.userId })
  }

  const changeUserid = (id) => {
    webRtcStore.userId = id
  }
  return (
    <div className="App">
      <header className="App-header">
        <div style={{display:'flex',gap:'10vw'}}>
          <VideoStream />
          <VideoStreamPeer />
        </div>

        <div style={{ display: 'flex' }}>{Object.keys(webRtcStore.onlineUsers).map(key => (
          <h3>{key}</h3>
        ))}</div>
        <label>Origin</label>
        <input value={webRtcStore.userId} onChange={e => changeUserid(e.target.value)} />
        <label>Target</label>
        <input value={targetUser} onChange={e => setTargetUser(e.target.value)} />
        <button onClick={startCall}>Start Call</button>
        {Object.values(webRtcStore.incomingCall).map(call => (
          <>
            <IncomingCall call={call} />
          </>
        ))}

      </header>
    </div>
  );
})

const IncomingCall = ({ call }) => {
  console.log(toJS(webRtcStore.incomingCall))
  console.log(call)
  const answerCall = (call: CallModel) => {
    creatingAnswer(call.origin, call.callId)
  }
  return (
    <div style={{ backgroundColor: 'rgb(40,160,200)', display: 'flex', gap: '20px' }}>
      <label>{"Call from :"}{call.origin}</label>
      <button onClick={e => answerCall(call)}>Answer</button>
    </div>
  )
}

const VideoStreamPeer = observer(() => {

  const [remoteStream, setRemoteStream] = useState(null)
  useEffect(() => {
    //console.log(webRtcStore.peerConnection)
    if (webRtcStore.peerConnection) {
      webRtcStore.peerConnection.addEventListener('track', (e) => {
        if (remoteStream !== e.streams[0]) {
          setRemoteStream(e.streams[0])
        }
      });
    }
  }, [webRtcStore.peerConnection])

  const videoRefPeer = useRef(null)
  console.log("2")
  if (remoteStream && videoRefPeer.current) {
    console.log(remoteStream)
    videoRefPeer.current.srcObject = remoteStream
  }

  return (
    <div>
      <label>Peer</label>
      <video style={{ height: '300px', width: '300px', borderRadius: '10px', display: 'block' }}
        ref={videoRefPeer}
        autoPlay={true}
        className="playe2r"
      />
    </div>
  )
})

const VideoStream = () => {
  const videoRef = useRef(null);

  const mediaDevices = useRef(null)


  useEffect(() => {
    if (videoRef.current) {
      try{
        getVideo();
      }
      catch(e){
        console.log(e)
      }
      
    }
  }, [videoRef.current]);

  const getVideo = async () => {
    let mediaDevicesObj = navigator?.mediaDevices as any
    mediaDevicesObj
      ?.getUserMedia({
        video: {
          width: 500,
          facingMode: {
            exact: "user"
          }

        }
      }
      )
      .then(stream => {
        mediaDevices.current = stream
        let video = videoRef.current;
        //console.log(video)

        //console.log(stream)
        video.srcObject = stream;
        webRtcStore.currentUserStream = stream
      })
      .catch(err => {
        console.error("error:", err);
      });
  };

  return (
    <div>
      <div>
        <label>You</label>
        <video style={{ height: '300px', width: '300px', borderRadius: '10px', display: 'block' }}
          ref={videoRef}
          autoPlay={true}
          className="playe1r"
        />
      </div>
    </div>

  )
}

export default App;
