/* 
Blobber turns a stream into a series of blobs
const blobber = new StreamBlobber(strream)
blobber.onBlob(cb) //callback functoin for each blob
blobber.start(interval) //start the process
blobber.stop() // stop capturing blobs

*/

class Blobber {
  constructor(stream) {
    this.stats = {
      constructed: null,
      created: null,
      started: null,
      firstBlob: null
    };
    this.getStat("constructed");

    this.stream = stream;
    this.nBlobs = 0;
    this.blobs = [];
    this.boundStop = this.recorderStop.bind(this);
    this.boundDataAvailable = this.handleDataAvailable.bind(this);
    this.createRecorder();
    this.index = 0;
  }
  displayStats() {
    console.log("BLOBBER STATS");
    let base = this.stats.constructed;
    let blobBase = this.stats.started;
    for (let key in this.stats) {
      if (key.match(/^blob/)) {
        // console.log(key  + "X", Math.round((this.stats[key] - blobBase) * 10) / 10);
        blobBase = this.stats[key];
      } else {
        if (key !== "started" && !key.match("blob"))
          console.log(key, Math.round((this.stats[key] - base) * 10) / 10);
        if (key === "started" && this.stats.started) base = this.stats.started;
      }
    }
  }
  getStat(id) {
    if (!this.stats[id]) this.stats[id] = performance.now();
  }
  onBlob(cb) {
    this.onblob = cb;
  }
  recorderStop(event) {
    console.log("Recorder stopped: ", event);
    console.log("Recorded Blobs: ", this.blobs);
  }
  async handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      this.getStat("firstBlob");
      this.index++;
      if (this.index < 20) this.getStat("blob-" + this.index);
      const blob = await event.data;
      // console.log("BLOB", blob.size);
      this.blobs.push(blob);
      if (this.onblob) this.onblob(blob, this.blobs);
      // if (this.nBlobs++ < 5) console.log("BLOB", this.nBlobs);
    }
  }
  createRecorder() {
    let options = { mimeType: "video/webm;codecs=opus,vp9" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not supported`);
      options = { mimeType: "video/webm;codecs=vp8,opus" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        options = { mimeType: "video/webm" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.error(`${options.mimeType} is not supported`);
          options = { mimeType: "" };
        }
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.mediaRecorder.onstop = this.boundStop();
      this.mediaRecorder.ondataavailable = this.boundDataAvailable;
    } catch (e) {
      console.error("Exception while creating MediaRecorder:", e);
      // setError(`Exception while creating MediaRecorder: ${JSON.stringify(e)}`);
      return;
    }
    this.getStat("created");
  }
  start(interval) {
    this.getStat("started");

    console.log("Started blobber", interval, "ms");
    try {
      this.mediaRecorder.start(interval);
      // console.log("MediaRecorder started", mediaRecorder);
    } catch (e) {
      console.log(Error, e.toString());
    }
  }
  stop() {
    this.displayStats();
    this.onblob = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive")
      this.mediaRecorder.stop();
  }
}

export default Blobber;
