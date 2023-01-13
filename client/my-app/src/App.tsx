import logo from './logo.svg';
import './App.css';
import { useEffect, useState } from 'react'
import { CallModel, creatingAnswer, creatingOffer, webRtcStore } from './stores/webrts';
import { observer } from 'mobx-react-lite';

const App = observer( function App() {

  const [targetUser, setTargetUser] = useState(null)
  useEffect(() => {


    // fetch("/api").then(res => res.json())
    // .then(json=>console.log(json))
    // .catch(err => { console.error(err) });

  }, [])

  const incomingCall = false


  const startCall = () => {
    creatingOffer(targetUser)
    //webRtcStore.sendMessage('connection-start',{ message: `i am user ${webRtcStore.userId} and i call ${targetUser}`, topic: 'connection-start', target: targetUser, origin: webRtcStore.userId })
  }
  const answerCall = (call:CallModel) =>{
    creatingAnswer(call.origin,call.callId)
  }
  const changeUserid = (id) =>{
    webRtcStore.userId = id
  }
  return (
    <div className="App">
      <header className="App-header">
        <h3>{Object.keys(webRtcStore.onlineUsers).map(key =>(
          <h3>{key}</h3>
        ))}</h3>
        <label>Origin</label>
        <input value={webRtcStore.userId} onChange={e => changeUserid(e.target.value)} />
        <label>Target</label>
        <input value={targetUser} onChange={e => setTargetUser(e.target.value)} />
        <button onClick={startCall}>Start Call</button>
        {Object.values(webRtcStore.incomingCall).map(call => (
          <>
            <label>{JSON.stringify(call)}</label>
            <button onClick={e=>answerCall(call)}>Answer</button>
          </>
        ))}
      </header>
    </div>
  );
})

export default App;
