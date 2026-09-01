/* ==========================================================================
   LM3915 Dual VU Meter Calibration Bench - Web Audio API Synthesis Engine
   ========================================================================== */

class BenchAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPoweredOn = false;
    
    // Nodes
    this.oscillator = null;
    this.noiseNode = null;
    this.micStreamNode = null;
    
    // Master Gain & Panner
    this.masterGain = null;
    this.balancePanner = null;
    
    // 9-Band EQ Biquad Filters
    this.eqFrequencies = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    this.eqFilters = [];
    
    // Channel Routing (Left & Right Analysers + Gains)
    this.splitter = null;
    this.merger = null;
    
    this.leftGain = null;
    this.rightGain = null;
    
    this.leftAnalyser = null;
    this.rightAnalyser = null;
    
    // Settings
    this.currentWaveform = 'sine';
    this.coarseFreq = 440;
    this.multiplier = 1.0;
    this.vrmsLevel = 1.50; // 0 to 1.50 Vrms
    this.balance = 0; // -1 (Left) to +1 (Right)
    
    // Channel Mute & Solo States
    this.soloLeft = false;
    this.soloRight = false;
    this.muteLeft = false;
    this.muteRight = false;
    
    // Auto Sweep State
    this.isSweeping = false;
    this.sweepInterval = null;
    this.sweepFreq = 20;
    
    // Source: 'gen' or 'mic'
    this.audioSource = 'gen';
  }

  init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Gain (Calibrated for 1.50 Vrms max output)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.vrmsToGain(this.vrmsLevel), this.ctx.currentTime);
    
    // Balance Panner
    if (this.ctx.createStereoPanner) {
      this.balancePanner = this.ctx.createStereoPanner();
      this.balancePanner.pan.setValueAtTime(this.balance, this.ctx.currentTime);
    } else {
      this.balancePanner = this.ctx.createGain();
    }

    // Build 9-Band Graphic EQ Chain
    let prevNode = this.masterGain;
    this.eqFilters = this.eqFrequencies.map(freq => {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.4; // Standard 1-octave Q factor
      filter.gain.value = 0; // Flat (0 dB)
      
      prevNode.connect(filter);
      prevNode = filter;
      return filter;
    });

    // Channel Splitter & Analysers
    this.splitter = this.ctx.createChannelSplitter(2);
    this.merger = this.ctx.createChannelMerger(2);
    
    this.leftGain = this.ctx.createGain();
    this.rightGain = this.ctx.createGain();
    
    this.leftAnalyser = this.ctx.createAnalyser();
    this.rightAnalyser = this.ctx.createAnalyser();
    
    this.leftAnalyser.fftSize = 1024;
    this.rightAnalyser.fftSize = 1024;

    // Routing: Last EQ Filter -> Balance Panner -> Channel Splitter
    prevNode.connect(this.balancePanner);
    this.balancePanner.connect(this.splitter);

    // Split Left (0) and Right (1)
    this.splitter.connect(this.leftGain, 0);
    this.splitter.connect(this.rightGain, 1);

    this.leftGain.connect(this.leftAnalyser);
    this.rightGain.connect(this.rightAnalyser);

    this.leftAnalyser.connect(this.merger, 0, 0);
    this.rightAnalyser.connect(this.merger, 0, 1);

    this.merger.connect(this.ctx.destination);

    // Start Generator Source
    this.updateGeneratorSource();
    this.updateChannelRouting();
  }

  powerOn() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isPoweredOn = true;
    this.playSwitchClickSound();
  }

  powerOff() {
    this.isPoweredOn = false;
    this.stopSweep();
    if (this.oscillator) {
      try { this.oscillator.stop(); } catch(e){}
      this.oscillator = null;
    }
    if (this.noiseNode) {
      try { this.noiseNode.stop(); } catch(e){}
      this.noiseNode = null;
    }
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  vrmsToGain(vrms) {
    // 1.50 Vrms maps to 1.0 (0 dB FS Web Audio output)
    return Math.max(0, Math.min(1.5, vrms)) / 1.50;
  }

  setWaveform(type) {
    this.currentWaveform = type;
    if (this.isPoweredOn) {
      this.updateGeneratorSource();
    }
  }

  setFrequency(freq, mult = 1.0) {
    this.coarseFreq = freq;
    this.multiplier = mult;
    const targetFreq = Math.min(20000, Math.max(20, this.coarseFreq * this.multiplier));
    
    if (this.oscillator && this.ctx) {
      this.oscillator.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.01);
    }
  }

  setMasterVrms(vrms) {
    this.vrmsLevel = vrms;
    if (this.masterGain && this.ctx && this.isPoweredOn) {
      this.masterGain.gain.setTargetAtTime(this.vrmsToGain(vrms), this.ctx.currentTime, 0.01);
    }
  }

  setBalance(bal) {
    this.balance = bal;
    if (this.balancePanner && this.ctx && this.balancePanner.pan) {
      this.balancePanner.pan.setTargetAtTime(bal, this.ctx.currentTime, 0.01);
    }
  }

  setEqBandGain(index, gainDb) {
    if (this.eqFilters[index] && this.ctx) {
      this.eqFilters[index].gain.setTargetAtTime(gainDb, this.ctx.currentTime, 0.02);
    }
  }

  resetEqFlat() {
    this.eqFilters.forEach(filter => {
      if (filter && this.ctx) {
        filter.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      }
    });
  }

  setChannelState(ch, solo, mute) {
    if (ch === 'left') {
      this.soloLeft = solo;
      this.muteLeft = mute;
    } else {
      this.soloRight = solo;
      this.muteRight = mute;
    }
    this.updateChannelRouting();
  }

  updateChannelRouting() {
    if (!this.leftGain || !this.rightGain || !this.ctx) return;

    let leftActive = !this.muteLeft;
    let rightActive = !this.muteRight;

    if (this.soloLeft || this.soloRight) {
      leftActive = this.soloLeft && !this.muteLeft;
      rightActive = this.soloRight && !this.muteRight;
    }

    const t = this.ctx.currentTime;
    this.leftGain.gain.setTargetAtTime(leftActive ? 1.0 : 0.0, t, 0.01);
    this.rightGain.gain.setTargetAtTime(rightActive ? 1.0 : 0.0, t, 0.01);
  }

  updateGeneratorSource() {
    if (!this.ctx) return;

    // Stop existing sources
    if (this.oscillator) {
      try { this.oscillator.stop(); } catch(e){}
      this.oscillator = null;
    }
    if (this.noiseNode) {
      try { this.noiseNode.stop(); } catch(e){}
      this.noiseNode = null;
    }

    if (!this.isPoweredOn || this.audioSource === 'mic') return;

    const targetFreq = Math.min(20000, Math.max(20, this.coarseFreq * this.multiplier));

    if (['sine', 'square', 'triangle', 'sawtooth'].includes(this.currentWaveform)) {
      this.oscillator = this.ctx.createOscillator();
      this.oscillator.type = this.currentWaveform;
      this.oscillator.frequency.setValueAtTime(targetFreq, this.ctx.currentTime);
      this.oscillator.connect(this.masterGain);
      this.oscillator.start();
    } else if (this.currentWaveform === 'white' || this.currentWaveform === 'pink') {
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (this.currentWaveform === 'white') {
          output[i] = white * 0.5;
        } else {
          // Paul Kellet's Pink Noise algorithm
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;
      this.noiseNode.connect(this.masterGain);
      this.noiseNode.start();
    }
  }

  toggleSweep(callback) {
    this.isSweeping = !this.isSweeping;
    if (this.isSweeping) {
      this.sweepFreq = 20;
      this.sweepInterval = setInterval(() => {
        if (!this.isPoweredOn) {
          this.stopSweep();
          return;
        }
        this.sweepFreq *= 1.04; // Exponential sweep from 20 Hz to 10,000 Hz
        if (this.sweepFreq >= 10000) {
          this.sweepFreq = 20;
        }
        this.setFrequency(this.sweepFreq, 1.0);
        if (callback) callback(Math.round(this.sweepFreq));
      }, 50);
    } else {
      this.stopSweep();
    }
    return this.isSweeping;
  }

  stopSweep() {
    this.isSweeping = false;
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  toggleMicrophoneInput(enable) {
    if (enable) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          this.audioSource = 'mic';
          if (this.oscillator) try { this.oscillator.stop(); } catch(e){}
          if (this.noiseNode) try { this.noiseNode.stop(); } catch(e){}
          
          this.micStreamNode = this.ctx.createMediaStreamSource(stream);
          this.micStreamNode.connect(this.masterGain);
        })
        .catch(err => {
          console.error("Microphone input access failed: ", err);
          alert("Could not access microphone/USB audio input: " + err.message);
        });
    } else {
      this.audioSource = 'gen';
      if (this.micStreamNode) {
        this.micStreamNode.disconnect();
        this.micStreamNode = null;
      }
      this.updateGeneratorSource();
    }
  }

  playSwitchClickSound() {
    if (!this.ctx) return;
    try {
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(120, this.ctx.currentTime);
      clickOsc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.03);
      
      clickGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.03);
      
      clickOsc.connect(clickGain);
      clickGain.connect(this.ctx.destination);
      
      clickOsc.start();
      clickOsc.stop(this.ctx.currentTime + 0.035);
    } catch(e){}
  }

  getChannelRMS(analyserNode) {
    if (!analyserNode || !this.isPoweredOn) return { vrms: 0, db: -Infinity };
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyserNode.getFloatTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rmsRaw = Math.sqrt(sum / bufferLength); // 0.0 to 1.0 (Web Audio FS)
    
    // Scale raw Web Audio 1.0 FS to 1.50 Vrms
    const vrms = rmsRaw * 1.50;
    let db = -Infinity;
    if (vrms > 0.0001) {
      db = 20 * Math.log10(vrms / 1.50);
    }
    return { vrms, db };
  }
}

window.benchAudio = new BenchAudioEngine();
