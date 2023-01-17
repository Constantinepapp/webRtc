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

  console.log(webRtcStore.onGoingCall)

  useEffect(() => {
    console.log(webRtcStore.currentUserStream)
    console.log(webRtcStore.peerConnection)
    if (webRtcStore.peerConnection) {
      console.log("2")
      const peerConnection = webRtcStore.peerConnection
      const stream = webRtcStore.currentUserStream
      stream.getTracks().forEach(track => { console.log("3"); webRtcStore.peerConnection?.addTrack(track, stream) })
    }
  }, [webRtcStore.peerConnection, webRtcStore.currentUserStream])


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
        <div style={{ display: 'flex', gap: '10vw' }}>
          <VideoStream />
          <VideoStreamPeer />
        </div>
        <p>Online Users :
          <div style={{ display: 'flex' }}>{Object.keys(webRtcStore.onlineUsers).map(key => (
            <>
              <p>User:{key}</p>
            </>

          ))}</div>
        </p>
        {webRtcStore.onGoingCall &&
          <CallInfo />
        }
        <label>Origin</label>
        <input value={webRtcStore.userId} onChange={e => changeUserid(e.target.value)} />
        <label>Target</label>
        <input value={targetUser} onChange={e => setTargetUser(e.target.value)} />
        <button onClick={startCall}>Start Call</button>
        {Object.values(webRtcStore.incomingCalls).map(call => (
          <>
            <IncomingCall call={call} />
          </>
        ))}

      </header>
    </div>
  );
})


const CallInfo = () => {

  const [timer, setTimer] = useState("0")
  const timerInterval = useRef(null)

  useEffect(() => {
    timerInterval.current = setInterval(() => {
      setTimer(((new Date().getTime() - new Date(webRtcStore.onGoingCall.call_start_timestamp).getTime()) / 1000).toFixed(0))
    }, 1000)

    return (() => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    })
  }, [])

  const endCall = () => {
    webRtcStore.endOngoingCall()
  }
  return (
    <>
      <label>On Call : {timer} secs</label>
      <button onClick={endCall}>End call</button>
    </>
  )
}

const IncomingCall = ({ call }) => {
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
    console.log("1")
    console.log(webRtcStore.peerConnection)
    if (webRtcStore.peerConnection) {
      console.log("2")
      webRtcStore.peerConnection.addEventListener('track', (e) => {
        console.log("3")
        console.log(e.streams)
        console.log(e.streams?.length)
        if (remoteStream !== e.streams[0]) {
          setRemoteStream(e.streams[0])
        }
      });
    }
  }, [webRtcStore.peerConnection])

  const videoRefPeer = useRef(null)
  if (remoteStream && videoRefPeer.current) {
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

  const [callState, setCallState] = useState({ audio: true, video: true })


  const startStopTrack = async (trackType: "audio" | "video") => {
    const stream = videoRef.current.srcObject
    let newState
    stream.getTracks().forEach(function (track) {
      if (track.kind == trackType) {
        track.enabled = !track.enabled
        newState = track.enabled
      }
    })
    setCallState({ ...callState, [trackType]: newState })
  }


  useEffect(() => {
    if (videoRef.current) {
      try {
        getVideo();
      }
      catch (e) {
        console.log(e)
      }

    }
  }, [videoRef.current]);

  const getVideo = async () => {
    let mediaDevicesObj = navigator?.mediaDevices as any
    mediaDevicesObj
      ?.getUserMedia({
        audio: true,
        video: {
          width: 500,
          facingMode: {
            exact: "user"
          }

        }
      }
      )
      .then(stream => {
        // console.log(stream)
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
        <button onClick={e => startStopTrack('audio')}>{callState.audio ? 'Mute' :'UnMute'}</button>
        <button onClick={e => startStopTrack('video')}>{callState.video ? 'Stop' :'Start'}</button>
      </div>
    </div>

  )
}

export default App;
