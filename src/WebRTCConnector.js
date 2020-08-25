import VideoStreamMerger from "./video-stream-merger";
import labeledStream from "./labeledStream";
import Blobber from "./Blobber";
import Restreamer from "./Restreamer";
const BLOB_CHANNEL = "BlobChannel";
const TEXT_CHANNEL = "TextChannel";
class WebRTCConnector {
  constructor(peer, name, mode) {
    this.name = name;
    this.textChannel = peer.createDataChannel(TEXT_CHANNEL);
    this.blobChannel = peer.createDataChannel(BLOB_CHANNEL);
    this.blobChannel.binaryType = "arraybuffer";

    //https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/binaryType
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
    if (event.channel.label === BLOB_CHANNEL) {
      this.blobHandler = new ChannelHandler(
        BLOB_CHANNEL,
        this.blobChannel,
        event.channel
      );
      this.sendBlob = this.blobHandler.sendBlob.bind(this.blobHandler);
    } else {
      this.textHandler = new ChannelHandler(
        TEXT_CHANNEL,
        this.textChannel,
        event.channel
      );
      this.sendText = this.textHandler.sendText.bind(this.textHandler);
    }
  }
  sendText(message) {
    this.textChannel.sendText(message);
  }
  sendBlob(message) {
    this.blogChannel.sendBlob(message);
  }
  onBlob(cb) {
    this.blobHandler.onMessage(cb);
  }
  onText(cb) {
    this.textHandler.onMessage(cb);
  }
}
class ChannelHandler {
  constructor(name, channel, dataChannel) {
    console.log("Set up datachannel", name, channel);
    this.name = name;
    this.channel = channel;
    this.dataChannel = dataChannel;
    if (name === BLOB_CHANNEL) {
      this.dataChannel.binaryType = "arraybuffer";
    }
    this.dataChannel.addEventListener("open", this.awaitOpen.bind(this));
    this.dataChannel.addEventListener("close", this.awaitClose.bind(this));
  }
  awaitClose(event) {
    console.log("PC1 Remote close");
    this.sendFunction = null;
  }
  awaitOpen(event) {
    console.log(this.name, "Remote open");
    this.channel.addEventListener("message", this.awaitMesage.bind(this));
    this.dataChannel.addEventListener("message", this.awaitDCMesage.bind(this));
  }
  sendText(message) {
    console.log("Send Text called");
    this.channel.send(message);
  }
  sendBlob(message) {
    console.log("Send Blob called");
    this.channel.send(message);
  }
  respond(message) {
    this.dataChannel.send("response: " + message);
  }
  awaitMesage(event) {
    console.log("received on channel", this.name, JSON.stringify(event.data));
    console.log(event.data);
  }
  onMessage(cb) {
    this.cb = cb;
  }
  awaitDCMesage(event) {
    console.log("received DC channel", this.name, JSON.stringify(event.data));
    if (this.cb) this.cb(event);
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
    console.error("Making sender");
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
    // console.log("loBlob", blob.size);
  }
  sendHiBlob(blob) {
    // console.log("hiBlob", blob.size);
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
export default WebRTCConnector;
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
