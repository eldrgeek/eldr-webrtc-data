/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

// "use strict";
import WebRTCConnector from "./WebRTCConnector";
import Restreamer from "./Restreamer";
const diags = { progress: true, bandwidth: false };
if (diags.progress) console.log("loaded js");
const ready = async () => {
  if (diags.loaded) console.log("loaded");
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
  const sentVideo = document.getElementById("sentVideo");

  localVideo.addEventListener("loadedmetadata", function () {
    if (diags.bandwidth)
      console.log(
        `Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
      );
  });

  remoteVideo.addEventListener("loadedmetadata", function () {
    if (diags.bandwidth)
      console.log(
        `Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`
      );
  });

  remoteVideo.addEventListener("resize", () => {
    if (diags.bandwidth)
      console.log(
        `Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`
      );
    // We'll use the first onsize callback as an indication that video has started
    // playing out.
    if (startTime) {
      const elapsedTime = window.performance.now() - startTime;
      if (diags.timing)
        console.log("Setup time: " + elapsedTime.toFixed(3) + "ms");
      startTime = null;
    }
  });

  let localStream;
  let pc1;
  let pc2;
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
    if (diags.progress) console.log("Requesting loscal stream");
    startButton.disabled = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      if (diags.progress) console.log("Received local stream", stream);
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
    if (diags.progress) console.log("Starting call");
    startTime = window.performance.now();
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      if (diags.progress)
        console.log(`Using video device: ${videoTracks[0].label}`);
    }
    if (audioTracks.length > 0) {
      if (diags.progress)
        console.log(`Using audio device: ${audioTracks[0].label}`);
    }
    const configuration = getSelectedSdpSemantics();
    if (diags.peer)
      console.log("RTCPeerConnection configuration:", configuration);
    pc1 = new RTCPeerConnection(configuration);
    if (diags.peer) console.log("Created local peer connection object pc1");
    pc1.addEventListener("icecandidate", (e) => onIceCandidate(pc1, e));
    pc2 = new RTCPeerConnection(configuration);
    if (diags.peer) console.log("Created remote peer connection object pc2");
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
    if (diags.peer) console.log("Added local stream to pc1");

    try {
      if (diags.peer) console.log("pc1 createOffer start");
      const offer = await pc1.createOffer(offerOptions);
      await onCreateOfferSuccess(offer);
    } catch (e) {
      onCreateSessionDescriptionError(e);
    }
  }

  function onCreateSessionDescriptionError(error) {
    if (diags.errors)
      console.log(`Failed to create session description: ${error.toString()}`);
  }

  async function onCreateOfferSuccess(desc) {
    if (diags.peer) console.log(`Offer from pc1\n${desc.sdp}`);
    if (diags.peer) console.log("pc1 setLocalDescription start");
    try {
      await pc1.setLocalDescription(desc);
      onSetLocalSuccess(pc1);
    } catch (e) {
      onSetSessionDescriptionError();
    }

    if (diags.peer) console.log("pc2 setRemoteDescription start");
    try {
      await pc2.setRemoteDescription(desc);
      onSetRemoteSuccess(pc2);
    } catch (e) {
      onSetSessionDescriptionError();
    }

    if (diags.peer) console.log("pc2 createAnswer start");
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
    if (diags.peer) console.log(`${getName(pc)} setLocalDescription complete`);
  }

  function onSetRemoteSuccess(pc) {
    if (diags.peer) console.log(`${getName(pc)} setRemoteDescription complete`);
  }

  function onSetSessionDescriptionError(error) {
    if (diags.error)
      console.log(`Failed to set session description: ${error.toString()}`);
  }

  function gotRemoteStream(e) {
    if (remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
      if (diags.peer) console.log("pc2 received remote stream");
    }
  }

  async function onCreateAnswerSuccess(desc) {
    if (diags.peer) console.log(`Answer from pc2:\n${desc.sdp}`);
    if (diags.peer) console.log("pc2 setLocalDescription start");
    try {
      await pc2.setLocalDescription(desc);
      onSetLocalSuccess(pc2);
    } catch (e) {
      onSetSessionDescriptionError(e);
    }
    if (diags.peer) console.log("pc1 setRemoteDescription start");
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
    if (diags.peer)
      console.log(
        `${getName(pc)} ICE candidate:\n${
          event.candidate ? event.candidate.candidate : "(null)"
        }`
      );
  }

  function onAddIceCandidateSuccess(pc) {
    if (diags.peer) console.log(`${getName(pc)} addIceCandidate success`);
  }

  function onAddIceCandidateError(pc, error) {
    if (diags.peer)
      console.log(
        `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`
      );
  }

  function onIceStateChange(pc, event) {
    if (diags.iceState)
      if (pc) {
        console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
        console.log("ICE state change event: ", event);
      }
  }

  function hangup() {
    if (diags.progress) console.log("Ending call");
    pc1.close();
    pc2.close();
    pc1 = null;
    pc2 = null;
    hangupButton.disabled = true;
    sendButton.disabled = true;
    callButton.disabled = false;
    sourceConnector.sender.stop();
  }
  let sourceConnector,
    destConnector = null;
  let restreamer = null;

  function send() {
    if (sourceConnector.sender) {
      sourceConnector.stopSender();
      return;
    }
    console.clear();
    destConnector.onText((data) => {
      console.log("Text Data ", data);
    });
    // destConnector.onBlob(async (blob) => {
    //   console.log("Got Blob ", blob.constructor.name, blob.size);
    //   // restreamer.addBlob(blob); // console.log("Blob text", await blob.text());
    // });
    if (sourceConnector.sendText) {
      sourceConnector.sendText("sending data");
      const blob = new Blob(["this is the contents of a blob"]);
      console.log("SIZE OF CONSTRUCTED BLOB", blob.size);
      // sourceConnector.sendBlob(blob);
      sourceConnector.createSender(localStream, "name", 1, 4);
      console.log("LOW STREAM", sourceConnector.sender.lorezStream);
      blobbedVideo.srcObject = sourceConnector.sender.lorezStream;
      destConnector.createRestreamer(sentVideo);
      // restreamer = new Restreamer(sentVideo);
      // restreamer.start();
    } else {
      console.log("send is not set");
    }
  }
  function opendata() {
    sourceConnector = new WebRTCConnector(pc1, "Pc1");
    destConnector = new WebRTCConnector(pc2, "PC2");

    return;
  }
  await start();
  await call();
};
ready();
