/* ==========================================================================
   LM3915 Dual VU Meter Calibration Bench - Main Application Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const audio = window.benchAudio;
  const metersEngine = new window.LM3915MeterEngine();
  const scope = new window.CRTOscilloscope('scopeCanvas');

  // DOM Elements
  const powerToggleBtn = document.getElementById('powerToggleBtn');
  const powerJewel = document.getElementById('powerJewel');
  
  const freqKnob = document.getElementById('freqKnob');
  const freqBadge = document.getElementById('freqBadge');
  
  const multKnob = document.getElementById('multKnob');
  const multBadge = document.getElementById('multBadge');

  const masterKnob = document.getElementById('masterKnob');
  const masterBadge = document.getElementById('masterBadge');

  const balanceKnob = document.getElementById('balanceKnob');
  const balanceBadge = document.getElementById('balanceBadge');

  const dcDetectorVal = document.getElementById('dcDetectorVal');
  const sweepToggleBtn = document.getElementById('sweepToggleBtn');
  
  const guideDrawerBtn = document.getElementById('guideDrawerBtn');
  const guideDrawerContent = document.getElementById('guideDrawerContent');
  const refTableContainer = document.getElementById('refTableContainer');

  // Render theoretical reference table inside drawer
  if (refTableContainer) {
    refTableContainer.innerHTML = metersEngine.getTheoreticalTableHTML();
  }

  // Handle Power Switch Toggle
  let isPowered = false;
  powerToggleBtn.addEventListener('click', () => {
    isPowered = !isPowered;
    powerToggleBtn.classList.toggle('active', isPowered);
    powerJewel.classList.toggle('active', isPowered);

    if (isPowered) {
      audio.powerOn();
      scope.start();
    } else {
      audio.powerOff();
      scope.stop();
    }
  });

  // Handle Waveform Selector Buttons
  document.querySelectorAll('.wave-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.wave-btn').forEach(b => b.classList.remove('active'));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('active');
      const waveType = targetBtn.dataset.wave;
      audio.setWaveform(waveType);
      audio.playSwitchClickSound();
    });
  });

  // Handle Frequency Calibration Presets (60 Hz, 440 Hz, 1 kHz, 5 kHz)
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
      const targetPill = e.currentTarget;
      targetPill.classList.add('active');
      const freq = parseFloat(targetPill.dataset.freq);
      
      audio.setFrequency(freq, 1.0);
      updateKnobAngle(freqKnob, freqToAngle(freq));
      freqBadge.textContent = `${freq} Hz`;
      audio.playSwitchClickSound();
    });
  });

  // Handle Auto Frequency Sweep Toggle
  sweepToggleBtn.addEventListener('click', () => {
    const isSweeping = audio.toggleSweep((currentFreq) => {
      freqBadge.textContent = `${currentFreq} Hz`;
      updateKnobAngle(freqKnob, freqToAngle(currentFreq));
    });
    sweepToggleBtn.classList.toggle('active', isSweeping);
    sweepToggleBtn.querySelector('span').textContent = isSweeping ? 'SWEEPING...' : 'AUTO FREQ SWEEP';
    audio.playSwitchClickSound();
  });

  // Handle Input Source Toggle (Gen vs Mic)
  const sourceToggleBtn = document.getElementById('sourceToggleBtn');
  let isMicSource = false;
  if (sourceToggleBtn) {
    sourceToggleBtn.addEventListener('click', () => {
      isMicSource = !isMicSource;
      sourceToggleBtn.classList.toggle('mic', isMicSource);
      sourceToggleBtn.textContent = isMicSource ? 'SOURCE: USB MIC/LINE' : 'SOURCE: TONE GENERATOR';
      audio.toggleMicrophoneInput(isMicSource);
      audio.playSwitchClickSound();
    });
  }

  // Handle Channel SOLO & MUTE Buttons
  const soloLBtn = document.getElementById('soloLBtn');
  const muteLBtn = document.getElementById('muteLBtn');
  const soloRBtn = document.getElementById('soloRBtn');
  const muteRBtn = document.getElementById('muteRBtn');

  let soloL = false, muteL = false, soloR = false, muteR = false;

  soloLBtn.addEventListener('click', () => {
    soloL = !soloL;
    soloLBtn.classList.toggle('active', soloL);
    audio.setChannelState('left', soloL, muteL);
    audio.playSwitchClickSound();
  });

  muteLBtn.addEventListener('click', () => {
    muteL = !muteL;
    muteLBtn.classList.toggle('active', muteL);
    audio.setChannelState('left', soloL, muteL);
    audio.playSwitchClickSound();
  });

  soloRBtn.addEventListener('click', () => {
    soloR = !soloR;
    soloRBtn.classList.toggle('active', soloR);
    audio.setChannelState('right', soloR, muteR);
    audio.playSwitchClickSound();
  });

  muteRBtn.addEventListener('click', () => {
    muteR = !muteR;
    muteRBtn.classList.toggle('active', muteR);
    audio.setChannelState('right', soloR, muteR);
    audio.playSwitchClickSound();
  });

  // Handle Meter Mode Toggle (Bar vs Dot)
  const modeBarBtn = document.getElementById('modeBarBtn');
  const modeDotBtn = document.getElementById('modeDotBtn');

  modeBarBtn.addEventListener('click', () => {
    modeBarBtn.classList.add('active');
    modeDotBtn.classList.remove('active');
    metersEngine.setMode('bar');
    audio.playSwitchClickSound();
  });

  modeDotBtn.addEventListener('click', () => {
    modeDotBtn.classList.add('active');
    modeBarBtn.classList.remove('active');
    metersEngine.setMode('dot');
    audio.playSwitchClickSound();
  });

  // Handle CRT Scope Mode Buttons (Dual, CH1, CH2, X-Y)
  document.querySelectorAll('[data-scopemode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-scopemode]').forEach(b => b.classList.remove('active'));
      const targetBtn = e.currentTarget;
      targetBtn.classList.add('active');
      scope.displayMode = targetBtn.dataset.scopemode;
      audio.playSwitchClickSound();
    });
  });

  // Handle 9-Band EQ Reset Flat Button
  const btnFlatEq = document.getElementById('btnFlatEq');
  if (btnFlatEq) {
    btnFlatEq.addEventListener('click', () => {
      audio.resetEqFlat();
      document.querySelectorAll('.eq-slider-col').forEach(col => {
        const thumb = col.querySelector('.eq-slider-thumb');
        const label = col.querySelector('.eq-db-label');
        if (thumb) thumb.style.top = '50%';
        if (label) label.textContent = '0dB';
      });
      audio.playSwitchClickSound();
    });
  }

  // Handle Guide Drawer Open/Close
  guideDrawerBtn.addEventListener('click', () => {
    const isOpen = guideDrawerContent.classList.toggle('open');
    guideDrawerBtn.querySelector('span:last-child').textContent = isOpen ? '▲ CLOSE' : '▼ OPEN';
  });

  // Handle Interactive Trimmer Calculator Slider
  const leftTrimSlider = document.getElementById('leftTrimSlider');
  const rightTrimSlider = document.getElementById('rightTrimSlider');
  const leftTrimLabel = document.getElementById('leftTrimLabel');
  const rightTrimLabel = document.getElementById('rightTrimLabel');

  if (leftTrimSlider) {
    leftTrimSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      metersEngine.leftTrimmerGain = val;
      leftTrimLabel.textContent = `${Math.round(val * 100)}%`;
    });
  }

  if (rightTrimSlider) {
    rightTrimSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      metersEngine.rightTrimmerGain = val;
      rightTrimLabel.textContent = `${Math.round(val * 100)}%`;
    });
  }

  /* ==========================================================================
     Rotary Knob Interaction Engine (Mouse Drag & Touch)
     ========================================================================== */

  function setupKnobDrag(knobEl, onChange) {
    let isDragging = false;
    let startY = 0;
    let currentAngle = 0; // -135 to +135 deg

    knobEl.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      document.body.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      startY = e.clientY;
      currentAngle = Math.max(-135, Math.min(135, currentAngle + deltaY * 1.5));
      updateKnobAngle(knobEl, currentAngle);
      
      const normalizedVal = (currentAngle + 135) / 270; // 0.0 to 1.0
      onChange(normalizedVal, currentAngle);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
      }
    });
  }

  function updateKnobAngle(knobEl, angle) {
    const dial = knobEl.querySelector('.knob-dial');
    if (dial) {
      dial.style.transform = `rotate(${angle}deg)`;
    }
  }

  function freqToAngle(freq) {
    // Log scale 20 Hz to 20,000 Hz mapped to -135..+135 deg
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const valLog = Math.log10(Math.max(20, Math.min(20000, freq)));
    const norm = (valLog - minLog) / (maxLog - minLog);
    return -135 + norm * 270;
  }

  // Setup Knobs
  setupKnobDrag(freqKnob, (norm) => {
    const minLog = Math.log10(20);
    const maxLog = Math.log10(20000);
    const freq = Math.round(Math.pow(10, minLog + norm * (maxLog - minLog)));
    audio.setFrequency(freq, audio.multiplier);
    freqBadge.textContent = `${freq} Hz`;
  });

  setupKnobDrag(multKnob, (norm) => {
    let mult = 1.0;
    if (norm < 0.33) mult = 0.1;
    else if (norm < 0.66) mult = 1.0;
    else mult = 10.0;
    
    audio.setFrequency(audio.coarseFreq, mult);
    multBadge.textContent = `×${mult.toFixed(1)}`;
  });

  setupKnobDrag(masterKnob, (norm) => {
    const vrms = parseFloat((norm * 1.50).toFixed(2));
    audio.setMasterVrms(vrms);
    masterBadge.textContent = `${vrms.toFixed(2)} Vrms`;

    // DC Pin 5 Detector output voltage calculation
    const vPeak = vrms * Math.SQRT2;
    dcDetectorVal.textContent = `${vPeak.toFixed(2)} V DC`;
  });

  setupKnobDrag(balanceKnob, (norm) => {
    const pan = parseFloat((norm * 2 - 1).toFixed(2)); // -1.0 to +1.0
    audio.setBalance(pan);
    
    let label = 'CENTER';
    if (pan < -0.1) label = `L ${Math.abs(pan).toFixed(2)}`;
    else if (pan > 0.1) label = `R ${pan.toFixed(2)}`;
    balanceBadge.textContent = label;
  });

  // Setup 9-Band EQ Dragging
  document.querySelectorAll('.eq-slider-col').forEach((col, idx) => {
    const track = col.querySelector('.eq-slider-track');
    const thumb = col.querySelector('.eq-slider-thumb');
    const dbLabel = col.querySelector('.eq-db-label');

    let isEqDragging = false;

    col.addEventListener('mousedown', (e) => {
      isEqDragging = true;
      updateEqFromMouse(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isEqDragging) updateEqFromMouse(e);
    });

    window.addEventListener('mouseup', () => {
      isEqDragging = false;
    });

    function updateEqFromMouse(e) {
      const rect = track.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const norm = 1 - (relativeY / rect.height); // 0 (bottom, -12dB) to 1 (top, +12dB)
      const dbGain = Math.round(norm * 24 - 12); // -12 dB to +12 dB

      thumb.style.top = `${(1 - norm) * 100}%`;
      dbLabel.textContent = `${dbGain >= 0 ? '+' : ''}${dbGain}dB`;

      audio.setEqBandGain(idx, dbGain);
    }
  });

  // Main UI Animation Loop for VU Meter Updates
  function mainMeterLoop() {
    if (audio.isPoweredOn && audio.leftAnalyser && audio.rightAnalyser) {
      const leftRMS = audio.getChannelRMS(audio.leftAnalyser);
      const rightRMS = audio.getChannelRMS(audio.rightAnalyser);

      metersEngine.renderMeterUI(
        'leftLedBar',
        'leftReadout',
        leftRMS.vrms,
        metersEngine.leftTrimmerGain
      );

      metersEngine.renderMeterUI(
        'rightLedBar',
        'rightReadout',
        rightRMS.vrms,
        metersEngine.rightTrimmerGain
      );
    } else {
      metersEngine.renderMeterUI('leftLedBar', 'leftReadout', 0, 1.0);
      metersEngine.renderMeterUI('rightLedBar', 'rightReadout', 0, 1.0);
    }
    requestAnimationFrame(mainMeterLoop);
  }

  mainMeterLoop();
});
