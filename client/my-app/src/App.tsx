import logo from './logo.svg';
import './App.css';
import { useEffect, useRef, useState } from 'react'
import { CallModel, creatingAnswer, creatingOffer, webRtcStore } from './stores/webrts';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { Stream } from 'stream';


// try{
//   console.log("replacing track")
//   webRtcStore.connectionSender.replaceTrack(stream.getVideoTracks()[0])
// }
// catch(e){
//   console.error(e)
// }


const App = observer(function App() {


  const [targetUser, setTargetUser] = useState(null)
  useEffect(() => {


    // fetch("/api").then(res => res.json())
    // .then(json=>console.log(json))
    // .catch(err => { console.error(err) });

  }, [])



  useEffect(() => {
    if (webRtcStore.peerConnection && webRtcStore.currentUserStream) {
      const stream = webRtcStore.currentUserStream

      if (webRtcStore.connectionSenderVideo) {
        try {
          console.log("replacing track video")
          console.log(stream.getVideoTracks())
          webRtcStore.connectionSenderVideo.replaceTrack(stream.getVideoTracks()[0])
        }
        catch (e) {
          console.error(e)
        }

      }
      else {
        stream.getTracks().forEach(track => {
          //console.log(track);
          if (track.kind == "video") {
            webRtcStore.connectionSenderVideo = webRtcStore.peerConnection?.addTrack(track, stream)
          }
          else {
            webRtcStore.peerConnection?.addTrack(track, stream)
          }
        })
      }

      console.log(toJS(webRtcStore.connectionSenderVideo))

    }
  }, [webRtcStore.peerConnection, webRtcStore.currentUserStream])


  const startCall = () => {
    creatingOffer(targetUser)
    //webRtcStore.sendMessage('connection-start',{ message: `i am user ${webRtcStore.userId} and i call ${targetUser}`, topic: 'connection-start', target: targetUser, origin: webRtcStore.userId })
  }

  const changeUserid = (id) => {
    webRtcStore.userId = id
  }

  // console.log(webRtcStore.incomingCalls)
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

    if (webRtcStore.peerConnection) {
      webRtcStore.peerConnection.addEventListener('track', (e) => {
        // console.log(e.streams)
        // console.log("incoming stream length : ",e.streams?.length)
        if (remoteStream !== e.streams[0]) {
          setRemoteStream(e.streams[0])
        }
      });
    }
    else{
      setRemoteStream(null)
    }
  }, [webRtcStore.peerConnection])



  const videoRefPeer = useRef(null)
  if (videoRefPeer.current) {
    videoRefPeer.current.srcObject = remoteStream
  }

  return (
    <div>
      <label>Peer</label>
      <video style={{ height: '600px', width: '600px', borderRadius: '10px', display: 'block' }}
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

  const [callState, setCallState] = useState({ audio: true, video: true, video_origin: 'user' })


  const startStopTrack = async (trackType: "audio" | "video") => {
    const stream =trackType == "audio" ? webRtcStore.currentUsermicrophoneAudioStream : webRtcStore.currentUserStream
    let newState
    stream.getTracks().forEach(function (track) {
      if (track.kind == trackType) {
        track.enabled = !track.enabled
        newState = track.enabled
        //console.log(track)
      }
    })
    setCallState({ ...callState, [trackType]: newState })
  }


  useEffect(() => {
    if (videoRef.current) {
      try {
        if (callState.video_origin == "user") {
          getVideoAudio();
        }
        if (callState.video_origin == "screen") {
          captureScreen(callState.audio)
        }
      }
      catch (e) {
        console.log(e)
      }

    }
  }, [videoRef.current, callState.video_origin]);

  async function captureScreen(audio: boolean) {
    let videoStream = null
    let microphoneAudioStream = null
    let outputStream = null
    try {
      videoStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          //@ts-ignore
          cursor: "always"
        },
        audio: false
      });
      if(!webRtcStore.currentUsermicrophoneAudioStream){
        //console.log("changed")
        webRtcStore.currentUsermicrophoneAudioStream = await navigator?.mediaDevices?.getUserMedia({
          audio: true,
          video: false
        })
      }
    
      outputStream = new MediaStream([...videoStream.getTracks(), ...webRtcStore.currentUsermicrophoneAudioStream.getAudioTracks()]);
      videoRef.current.srcObject = videoStream
      let video = videoRef.current;
      webRtcStore.currentUserStream = outputStream
    } catch (ex) {
      console.log("Error occurred", ex);
    }
  }

  const getVideoAudio = async () => {
    let videoStream = null
    let microphoneAudioStream = null
    let outputStream = null
    try {
      videoStream = await navigator?.mediaDevices?.getUserMedia({
        audio: false,
        video: {
          width: 500,
          facingMode: {
            exact: "user"
          }

        }
      })
      if(!webRtcStore.currentUsermicrophoneAudioStream){
        //console.log("changed")
        webRtcStore.currentUsermicrophoneAudioStream = await navigator?.mediaDevices?.getUserMedia({
          audio: true,
          video: false
        })
      }
    
      outputStream = new MediaStream([...videoStream.getTracks(), ...webRtcStore.currentUsermicrophoneAudioStream.getAudioTracks()]);
      videoRef.current.srcObject = videoStream
      webRtcStore.currentUserStream = outputStream

    } catch (ex) {
      console.log("Error occurred", ex);
    }
  };


  return (
    <div>
      <div>
        <label>You</label>
        <video style={{ height: '600px', width: '600px', borderRadius: '10px', display: 'block' }}
          ref={videoRef}
          autoPlay={true}
          className="playe1r"
        />
        <button onClick={e => setCallState({ ...callState, video_origin: callState.video_origin == "user" ? 'screen' : 'user' })}>{callState.video_origin == "user" ? 'Share screen' : 'Stop sharing screen'}</button>
        <button onClick={e => startStopTrack('audio')}>{callState.audio ? 'Mute' : 'UnMute'}</button>
        <button onClick={e => startStopTrack('video')}>{callState.video ? 'Stop' : 'Start'}</button>
      </div>
    </div>

  )
}

export default App;
