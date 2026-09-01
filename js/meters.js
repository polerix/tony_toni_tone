/* ==========================================================================
   LM3915 Dual VU Meter Calibration Bench - LM3915 Meter Emulation Engine
   ========================================================================== */

class LM3915MeterEngine {
  constructor() {
    this.mode = 'bar'; // 'bar' or 'dot'
    this.vref = 1.50;   // Full-scale 0 dB Vrms reference voltage

    // 10 LM3915 3 dB Step Threshold Definitions
    this.stepDefinitions = [
      { step: 1,  db: -27, color: 'green',  ratio: 0.0447, vrms: 0.067 },
      { step: 2,  db: -24, color: 'green',  ratio: 0.0631, vrms: 0.095 },
      { step: 3,  db: -21, color: 'green',  ratio: 0.0891, vrms: 0.134 },
      { step: 4,  db: -18, color: 'green',  ratio: 0.1259, vrms: 0.189 },
      { step: 5,  db: -15, color: 'green',  ratio: 0.1778, vrms: 0.267 },
      { step: 6,  db: -12, color: 'green',  ratio: 0.2512, vrms: 0.377 },
      { step: 7,  db: -9,  color: 'yellow', ratio: 0.3548, vrms: 0.532 },
      { step: 8,  db: -6,  color: 'yellow', ratio: 0.5012, vrms: 0.752 },
      { step: 9,  db: -3,  color: 'red',    ratio: 0.7079, vrms: 1.062 },
      { step: 10, db: 0,   color: 'red',    ratio: 1.0000, vrms: 1.500 }
    ];

    // Trimmer Resistance Simulation (default 100% sensitivity = 0 dB offset)
    this.leftTrimmerGain = 1.0;
    this.rightTrimmerGain = 1.0;
  }

  setMode(mode) {
    this.mode = mode.toLowerCase() === 'dot' ? 'dot' : 'bar';
  }

  calculateActiveSegments(vrmsInput, trimmerGain = 1.0) {
    // Calibrated voltage after multi-turn trimmer adjustment
    const calibratedVrms = vrmsInput * trimmerGain;
    
    let activeStep = 0;
    for (let i = 0; i < this.stepDefinitions.length; i++) {
      // 5% hysteresis threshold for LED activation
      if (calibratedVrms >= this.stepDefinitions[i].vrms * 0.95) {
        activeStep = i + 1;
      }
    }

    const segments = new Array(10).fill(false);
    if (activeStep === 0) return segments;

    if (this.mode === 'dot') {
      segments[activeStep - 1] = true;
    } else {
      for (let i = 0; i < activeStep; i++) {
        segments[i] = true;
      }
    }
    return segments;
  }

  renderMeterUI(meterElementId, readoutElementId, vrmsInput, trimmerGain = 1.0) {
    const container = document.getElementById(meterElementId);
    const readout = document.getElementById(readoutElementId);
    if (!container) return;

    const activeState = this.calculateActiveSegments(vrmsInput, trimmerGain);
    const segments = container.querySelectorAll('.led-segment');

    segments.forEach((seg, idx) => {
      // Note: segments in DOM are index 0 (bottom, LED 1) to index 9 (top, LED 10)
      if (activeState[idx]) {
        seg.classList.add('active');
      } else {
        seg.classList.remove('active');
      }
    });

    if (readout) {
      const calibratedVrms = vrmsInput * trimmerGain;
      let dbStr = '-∞';
      if (calibratedVrms > 0.001) {
        const db = 20 * Math.log10(calibratedVrms / this.vref);
        dbStr = (db >= 0 ? '+' : '') + db.toFixed(1);
      }
      readout.textContent = `${calibratedVrms.toFixed(3)} Vrms | ${dbStr} dB`;
    }
  }

  getTheoreticalTableHTML() {
    return `
      <table class="ref-table">
        <thead>
          <tr>
            <th>LED #</th>
            <th>Color</th>
            <th>Level (dB)</th>
            <th>Nominal Ratio</th>
            <th>Vrms (1.50V Ref)</th>
            <th>DC Pin 5 Output</th>
          </tr>
        </thead>
        <tbody>
          ${this.stepDefinitions.slice().reverse().map(def => `
            <tr>
              <td><strong>LED ${def.step}</strong></td>
              <td><span class="badge-${def.color}">${def.color.toUpperCase()}</span></td>
              <td>${def.db === 0 ? '0 dB (Peak)' : def.db + ' dB'}</td>
              <td>${def.ratio.toFixed(4)}</td>
              <td><strong>${def.vrms.toFixed(3)} V</strong></td>
              <td>${(def.vrms * Math.SQRT2).toFixed(3)} V peak</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

window.LM3915MeterEngine = LM3915MeterEngine;
