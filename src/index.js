/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

// "use strict";
import HootConnector from "./HootConnector";
import { Sender, Receiver } from "./HootConnector";
console.log("loaded js");
console.log(document.readyState);
const ready = async () => {
  console.log("loaded");
  const startButton = document.getElementById("startButton");
  const callButton = document.getElementById("callButton");
  const hangupButton = document.getElementById("hangupButton");
  const sendButton = document.getElementById("sendButton");

  callButton.disabled = true;
  hangupButton.disabled = true;
  sendButton.disabled = true;

  startButton.addEventListener("click", start);
  callButton.addEventListener("click", call);
  hangupButton.addEventListener("click", hangup);
  sendButton.addEventListener("click", send);

  let startTime;
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const blobbedVideo = document.getElementById("blobbedVideo");

  localVideo.addEventListener("loadedmetadata", function () {
    console.log(
      `Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
    );
  });

  remoteVideo.addEventListener("loadedmetadata", function () {
    console.log(
      `Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
    );
  });

  remoteVideo.addEventListener("resize", () => {
    console.log(
      `Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`
    );
    // We'll use the first onsize callback as an indication that video has started
    // playing out.
    if (startTime) {
      const elapsedTime = window.performance.now() - startTime;
      console.log("Setup time: " + elapsedTime.toFixed(3) + "ms");
      startTime = null;
    }
  });

  let localStream;
  let pc1;
  let pc2;
  let pc1DataChannel;
  let pc2DataChannel;
  const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  };

  function getName(pc) {
    return pc === pc1 ? "pc1" : "pc2";
  }

  function getOtherPc(pc) {
    return pc === pc1 ? pc2 : pc1;
  }
  async function start() {
    console.log("Requesting loscal stream");
    startButton.disabled = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      console.log("Received local stream", stream);
      localVideo.srcObject = stream;
      localStream = stream;
      callButton.disabled = false;
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
    }
  }

  function getSelectedSdpSemantics() {
    const sdpSemanticsSelect = document.querySelector("#sdpSemantics");
    const option = sdpSemanticsSelect.options[sdpSemanticsSelect.selectedIndex];
    return option.value === "" ? {} : { sdpSemantics: option.value };
  }

  async function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    sendButton.disabled = false;
    console.log("Starting call");
    startTime = window.performance.now();
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`);
    }
    const configuration = getSelectedSdpSemantics();
    console.log("RTCPeerConnection configuration:", configuration);
    pc1 = new RTCPeerConnection(configuration);
    console.log("Created local peer connection object pc1");
    pc1.addEventListener("icecandidate", (e) => onIceCandidate(pc1, e));
    pc2 = new RTCPeerConnection(configuration);
    console.log("Created remote peer connection object pc2");
    pc2.addEventListener("icecandidate", (e) => onIceCandidate(pc2, e));
    pc1.addEventListener("iceconnectionstatechange", (e) =>
      onIceStateChange(pc1, e)
    );
    pc2.addEventListener("iceconnectionstatechange", (e) =>
      onIceStateChange(pc2, e)
    );
    pc2.addEventListener("track", gotRemoteStream);
    opendata();

    localStream
      .getTracks()
      .forEach((track) => pc1.addTrack(track, localStream));
    console.log("Added local stream to pc1");

    try {
      console.log("pc1 createOffer start");
      const offer = await pc1.createOffer(offerOptions);
      await onCreateOfferSuccess(offer);
    } catch (e) {
      onCreateSessionDescriptionError(e);
    }
  }

  function onCreateSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}`);
  }

  async function onCreateOfferSuccess(desc) {
    console.log(`Offer from pc1\n${desc.sdp}`);
    console.log("pc1 setLocalDescription start");
    try {
      await pc1.setLocalDescription(desc);
      onSetLocalSuccess(pc1);
    } catch (e) {
      onSetSessionDescriptionError();
    }

    console.log("pc2 setRemoteDescription start");
    try {
      await pc2.setRemoteDescription(desc);
      onSetRemoteSuccess(pc2);
    } catch (e) {
      onSetSessionDescriptionError();
    }

    console.log("pc2 createAnswer start");
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    try {
      const answer = await pc2.createAnswer();
      await onCreateAnswerSuccess(answer);
    } catch (e) {
      onCreateSessionDescriptionError(e);
    }
  }

  function onSetLocalSuccess(pc) {
    console.log(`${getName(pc)} setLocalDescription complete`);
  }

  function onSetRemoteSuccess(pc) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
  }

  function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
  }

  function gotRemoteStream(e) {
    if (remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
      console.log("pc2 received remote stream");
    }
  }

  async function onCreateAnswerSuccess(desc) {
    console.log(`Answer from pc2:\n${desc.sdp}`);
    console.log("pc2 setLocalDescription start");
    try {
      await pc2.setLocalDescription(desc);
      onSetLocalSuccess(pc2);
    } catch (e) {
      onSetSessionDescriptionError(e);
    }
    console.log("pc1 setRemoteDescription start");
    try {
      await pc1.setRemoteDescription(desc);
      onSetRemoteSuccess(pc1);
    } catch (e) {
      onSetSessionDescriptionError(e);
    }
  }

  async function onIceCandidate(pc, event) {
    try {
      await getOtherPc(pc).addIceCandidate(event.candidate);
      onAddIceCandidateSuccess(pc);
    } catch (e) {
      onAddIceCandidateError(pc, e);
    }
    console.log(
      `${getName(pc)} ICE candidate:\n${
        event.candidate ? event.candidate.candidate : "(null)"
      }`
    );
  }

  function onAddIceCandidateSuccess(pc) {
    console.log(`${getName(pc)} addIceCandidate success`);
  }

  function onAddIceCandidateError(pc, error) {
    console.log(
      `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`
    );
  }

  function onIceStateChange(pc, event) {
    if (pc) {
      console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
      console.log("ICE state change event: ", event);
    }
  }

  function hangup() {
    console.log("Ending call");
    pc1.close();
    pc2.close();
    pc1 = null;
    pc2 = null;
    hangupButton.disabled = true;
    sendButton.disabled = true;
    callButton.disabled = false;
    sender.stop();
  }
  let hoot1,
    hoot2 = null;

  function send() {
    if (hoot1.sender) {
      hoot1.stopSender();
      return;
    }
    if (hoot1.send) {
      hoot1.send("sending data");
      hoot1.createSender(localStream, "name", 1, 4);
    } else {
      console.log("send is not set");
    }
  }
  function opendata() {
    hoot1 = new HootConnector(pc1, "Pc1");
    hoot2 = new HootConnector(pc2, "PC2");

    console.log("send set");
    return;
    // console.log("Open Data");
    // index++;
    // const CHANNEL_NAME = "my channel";
    // pc1DataChannel = pc1.createDataChannel(CHANNEL_NAME + index);
    // pc2DataChannel = pc2.createDataChannel(CHANNEL_NAME + index);
    // pc1.addEventListener("datachannel", (event) => {
    //   const dataChannel = event.channel;
    //   console.log("PC1 received a data channel notifiction");
    //   dataChannel.addEventListener("open", (event) => {
    //     console.log("PC1 Remote open");
    //     sendFunction = () => {
    //       pc1DataChannel.send("a message");
    //     };
    //   });

    //   // Disable input when closed
    //   dataChannel.addEventListener("close", (event) => {
    //     console.log("PC1 Remote close");
    //     sendFunction = null;
    //   });
    // });
    // pc2.addEventListener("datachannel", (event) => {
    //   const dataChannel = event.channel;
    //   console.log("PC2 received data channel note remote");
    //   console.log(dataChannel, dataChannel.label);
    //   dataChannel.addEventListener("open", (event) => {
    //     console.log("PC1 remote open");
    //     dataChannel.addEventListener("message", (event) => {
    //       console.log("received", event.data);
    //     });
    //   });
    //   // Disable input when closed
    //   dataChannel.addEventListener("close", (event) => {
    //     console.log("PC1 remote close");
    //   });
    // });
    // hangupButton.disabled = false;
    // callButton.disabled = true;
  }
  await start();
  await call();
  //   });
  // });
  // pc2.addEventListener("datachannel", (event) => {
  //   const dataChannel = event.channel;
  //   console.log("PC2 received data channel note remote");
  //   console.log(dataChannel, dataChannel.label);
  //   dataChannel.addEventListener("open", (event) => {
  //     console.log("PC1 remote open");
  //     dataChannel.addEventListener("message", (event) => {
  //       console.log("received", event.data);
  //     });
  //   });
  //   // Disable input when closed
  //   dataChannel.addEventListener("close", (event) => {
  //     console.log("PC1 remote close");
  //   });
  // });
  // hangupButton.disabled = false;
  // callButton.disabled = true;
};
// await start();
// await call();
ready();

// document.addEventListener("DOMContentLoaded", ready)
// const foo = () => {
//   console.log("foo")
// }
// if(document.readyState === "complete") foo()
