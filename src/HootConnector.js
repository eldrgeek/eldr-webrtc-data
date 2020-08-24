import VideoStreamMerger from "./video-stream-merger";
import labeledStream from "./labeledStream";
import Blobber from "./Blobber";
import Restreamer from "./Restreamer";
class HootConnector {
  constructor(peer, name, create = true) {
    const CHANNEL_NAME = "my channel";
    let index = 0;
    this.name = name;
    if (create) {
      this.channel = peer.createDataChannel(CHANNEL_NAME + index);
      this.channel.binary = true;
    }
    this.peer = peer;
    this.peer.addEventListener("datachannel", this.awaitDataChannel.bind(this));
  }
  createSender(stream, name, seq, nCascade) {
    this.sender = new Sender(stream, name, seq, nCascade);
    this.sender.start();
  }
  stopSender() {
    this.sender.stop();
    this.sender = null;
  }
  awaitDataChannel(event) {
    console.log(this.name, "received a data channel notifiction");
    this.dataChannel = event.channel;
    this.dataChannel.binary = true;
    this.dataChannel.addEventListener("open", this.awaitOpen.bind(this));
    this.dataChannel.addEventListener("close", this.awaitClose.bind(this));
  }
  awaitClose(event) {
    console.log("PC1 Remote close");
    this.sendFunction = null;
  }
  awaitOpen(event) {
    console.log(this.name, "Remote open");
    if (this.channel)
      this.channel.addEventListener("message", this.awaitMesage.bind(this));
    this.dataChannel.addEventListener("message", this.awaitDCMesage.bind(this));
  }
  send(message) {
    console.log("Send called");
    if (this.channel)
      this.channel.send({ name: this.name, type: "send", message });
  }
  respond(message) {
    if (this.dataChannel)
      this.dataChannel.send({ name: this.name, type: "reply", message });
  }
  awaitMesage(event) {
    console.log("received on channel", this.name, JSON.stringify(event.data));
    console.log(event.data);
  }
  awaitDCMesage(event) {
    console.log(
      "received on DataChannel",
      this.name,
      JSON.stringify(event.data)
    );
    this.respond("ack");
  }
}

class Receiver {
  constructor(video) {
    if (!video) {
      video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.srcObject = mediaStream;
      video.setAttribute(
        "style",
        "position:fixed; left: 0px; top:0px; pointer-events: none; opacity:0;"
      );
      document.body.appendChild(video);
    }
    this.video = video;
    this.restreamer = new Restreamer(video);
    this.getMessage = this.getMessage.bind(this);
  }
  setChannel(dataChannel) {
    this.channel = dataChannel;
  }
  getMessage(event) {
    const message = event.data;
    if (message.type === "blob") {
      this.restreamer.addBlob(message.payload);
    }
  }
  start() {
    this.channel.addEventListener("message", this.getMessage);
  }
  stop() {
    this.channel.removeEventListener("message", this.getMessage);
  }
}
class Sender {
  constructor(stream, name, iPos, nCascade) {
    console.error("Making sendiner");
    if (!stream || !name || iPos === undefined || !nCascade) {
      console.log("Missing arguments to Hootconnector");
    }
    this.localStream = stream;
    this.merger = labeledStream(stream, name, iPos, nCascade);
    this.lorezStream = this.merger.result;
    console.error(this.lorezStream);
    this.lorezBlobber = new Blobber(this.lorezStream);
    this.lorezBlobber.onBlob(this.sendLoBlob.bind(this));
    this.hirezBlobber = new Blobber(this.localStream);
    this.hirezBlobber.onBlob(this.sendHiBlob.bind(this));
  }
  connectToCascade() {}
  sendLoBlob(blob) {
    console.log("loBlob", blob.size);
  }
  sendHiBlob(blob) {
    console.log("hiBlob", blob.size);
  }
  start() {
    console.error("starting");
    this.lorezBlobber.start(100);
    this.hirezBlobber.start(100);
  }
  stop() {
    this.lorezBlobber.stop();
    this.hirezBlobber.stop();
  }
  addStream(src) {
    this.merger.addStream(src, {
      index: -1,
      x: 0, // position of the topleft corner
      y: 0,
      width: this.merger.width,
      height: this.merger.height
    });
  }
}
export default HootConnector;
export { Sender, Receiver };

/*
const blb    = new Blob(["Lorem ipsum sit"], {type: "text/plain"});
const reader = new FileReader();

// This fires after the blob has been read/loaded.
reader.addEventListener('loadend', (e) => {
  const text = e.srcElement.result;
  console.log(text);
});

// Start reading the blob as text.
reader.readAsText(blb);
*/
