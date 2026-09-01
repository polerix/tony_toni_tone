/* ==========================================================================
   LM3915 Dual VU Meter Calibration Bench - 1960s Dual-Trace CRT Oscilloscope
   ========================================================================== */

class CRTOscilloscope {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    // Display Mode: 'dual', 'ch1', 'ch2', 'xy'
    this.displayMode = 'dual';
    
    // Oscilloscope Settings
    this.timebaseMs = 1.0;     // Time/Div (0.1ms to 10ms)
    this.voltsPerDiv = 0.5;    // Volts/Div (0.1V to 2.0V)
    this.triggerLevel = 0.0;   // Trigger Threshold (-1.0 to +1.0)
    this.intensity = 0.85;     // Phosphor Intensity
    this.focus = 2.0;          // Line Width / Sharpness
    
    this.isAnimRunning = false;
    this.animFrameId = null;
  }

  start() {
    if (this.isAnimRunning) return;
    this.isAnimRunning = true;
    this.renderLoop();
  }

  stop() {
    this.isAnimRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.clearScreen();
  }

  clearScreen() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#050e09';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGraticuleGrid();
  }

  drawGraticuleGrid() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cols = 10;
    const rows = 8;
    const dx = w / cols;
    const dy = h / rows;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.18)';
    this.ctx.lineWidth = 1;

    // Major grid lines
    for (let c = 1; c < cols; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * dx, 0);
      this.ctx.lineTo(c * dx, h);
      this.ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * dy);
      this.ctx.lineTo(w, r * dy);
      this.ctx.stroke();
    }

    // Center crosshairs with tick marks
    this.ctx.strokeStyle = 'rgba(0, 255, 102, 0.4)';
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2, 0);
    this.ctx.lineTo(w / 2, h);
    this.ctx.moveTo(0, h / 2);
    this.ctx.lineTo(w, h / 2);
    this.ctx.stroke();

    // Ticks on center lines
    const tickLen = 4;
    for (let c = 0; c <= cols * 5; c++) {
      const x = c * (dx / 5);
      this.ctx.beginPath();
      this.ctx.moveTo(x, h / 2 - tickLen / 2);
      this.ctx.lineTo(x, h / 2 + tickLen / 2);
      this.ctx.stroke();
    }
    for (let r = 0; r <= rows * 5; r++) {
      const y = r * (dy / 5);
      this.ctx.beginPath();
      this.ctx.moveTo(w / 2 - tickLen / 2, y);
      this.ctx.lineTo(w / 2 + tickLen / 2, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // Zero-Crossing Trigger Algorithm to stabilize wave
  findTriggerOffset(dataArray, triggerThreshold = 0) {
    for (let i = 0; i < dataArray.length - 1; i++) {
      if (dataArray[i] <= triggerThreshold && dataArray[i + 1] > triggerThreshold) {
        return i;
      }
    }
    return 0;
  }

  renderLoop() {
    if (!this.isAnimRunning) return;

    if (this.canvas && this.ctx) {
      // Phosphor decay trail effect (slight opacity clear)
      this.ctx.fillStyle = `rgba(5, 14, 9, ${1.1 - this.intensity * 0.5})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.drawGraticuleGrid();

      if (window.benchAudio && window.benchAudio.isPoweredOn) {
        const leftAnalyser = window.benchAudio.leftAnalyser;
        const rightAnalyser = window.benchAudio.rightAnalyser;

        if (leftAnalyser && rightAnalyser) {
          const bufLen = leftAnalyser.frequencyBinCount;
          const leftData = new Float32Array(bufLen);
          const rightData = new Float32Array(bufLen);

          leftAnalyser.getFloatTimeDomainData(leftData);
          rightAnalyser.getFloatTimeDomainData(rightData);

          if (this.displayMode === 'xy') {
            this.drawLissajousXY(leftData, rightData);
          } else {
            if (this.displayMode === 'dual' || this.displayMode === 'ch1') {
              const ch1Offset = this.findTriggerOffset(leftData, this.triggerLevel);
              this.drawTrace(leftData, ch1Offset, '#00FF66', 'rgba(0, 255, 102, 0.4)');
            }
            if (this.displayMode === 'dual' || this.displayMode === 'ch2') {
              const ch2Offset = this.findTriggerOffset(rightData, this.triggerLevel);
              this.drawTrace(rightData, ch2Offset, '#FFB000', 'rgba(255, 176, 0, 0.4)');
            }
          }
        }
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  drawTrace(dataArray, triggerOffset, colorHex, glowColor) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const centerY = h / 2;

    this.ctx.save();
    this.ctx.strokeStyle = colorHex;
    this.ctx.lineWidth = this.focus;
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = 10 * this.intensity;

    this.ctx.beginPath();

    const sampleStep = Math.max(1, Math.floor(10 / this.timebaseMs));
    let x = 0;
    const dx = w / ((dataArray.length - triggerOffset) / sampleStep);

    for (let i = triggerOffset; i < dataArray.length; i += sampleStep) {
      const val = dataArray[i]; // -1.0 to 1.0
      // Scale by Volts/Div setting
      const y = centerY - (val / this.voltsPerDiv) * (h / 8);

      if (x === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += dx;
      if (x > w) break;
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  drawLissajousXY(ch1Data, ch2Data) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    this.ctx.save();
    this.ctx.strokeStyle = '#00FF66';
    this.ctx.lineWidth = this.focus;
    this.ctx.shadowColor = 'rgba(0, 255, 102, 0.6)';
    this.ctx.shadowBlur = 12 * this.intensity;

    this.ctx.beginPath();

    const len = Math.min(ch1Data.length, ch2Data.length);
    for (let i = 0; i < len; i += 2) {
      const xVal = ch1Data[i]; // CH1 on X axis
      const yVal = ch2Data[i]; // CH2 on Y axis

      const x = centerX + (xVal / this.voltsPerDiv) * (w / 10);
      const y = centerY - (yVal / this.voltsPerDiv) * (h / 8);

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.stroke();
    this.ctx.restore();
  }
}

window.CRTOscilloscope = CRTOscilloscope;
