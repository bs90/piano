// ============================================================
// Note data
// ============================================================
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const JP_NAMES = { C: 'ド', D: 'レ', E: 'ミ', F: 'ファ', G: 'ソ', A: 'ラ', B: 'シ' };

const NOTES = [];
for (let midi = 36; midi <= 84; midi++) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  NOTES.push({ midi, name, octave, freq, label: name + octave });
}

// Only natural notes for the game
const PLAYABLE_NOTES = NOTES.filter((n) => !n.name.includes('#'));

function frequencyToNote(freq) {
  let minDist = Infinity;
  let closest = null;
  for (const note of NOTES) {
    const cents = Math.abs(1200 * Math.log2(freq / note.freq));
    if (cents < minDist) {
      minDist = cents;
      closest = note;
    }
  }
  return minDist < 40 ? closest : null; // tighter tolerance: 40 cents
}

// ============================================================
// SVG Staff rendering — two separate staves side by side
// ============================================================
const SVG_NS = 'http://www.w3.org/2000/svg';
const STEP = 6; // px per diatonic step
const DIATONIC = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Treble staff: 5 lines = E4, G4, B4, D5, F5
// Reference: B4 (middle line) = diatonic step 6 from C4
// Bass staff: 5 lines = G2, B2, D3, F3, A3
// Reference: D3 (middle line) = diatonic step -5 from C4

// Layout: two staves side by side
// Left staff (treble): x range 10..380
// Right staff (bass):  x range 420..790
const TREBLE_X1 = 50;
const TREBLE_X2 = 370;
const BASS_X1 = 450;
const BASS_X2 = 770;
const STAFF_CENTER_Y = 80; // vertical center of each 5-line staff

// Treble lines relative positions from center (B4=0): F5=+4, D5=+2, B4=0, G4=-2, E4=-4
// Bass lines relative positions from center (D3=0): A3=+2, F3=+1...
// Actually let me use absolute diatonic positions from C4

function noteToStaffPos(note) {
  return DIATONIC[note.name] + (note.octave - 4) * 7;
}

// Treble: lines at positions 2(E4), 4(G4), 6(B4), 8(D5), 10(F5)
// Center of treble = position 6 (B4)
const TREBLE_CENTER_POS = 6;
const TREBLE_LINE_POSITIONS = [2, 4, 6, 8, 10];

// Bass: lines at positions -10(G2), -8(B2), -6(D3), -4(F3), -2(A3)
// Center of bass = position -6 (D3)
const BASS_CENTER_POS = -6;
const BASS_LINE_POSITIONS = [-10, -8, -6, -4, -2];

function treblePosToY(pos) {
  return STAFF_CENTER_Y - (pos - TREBLE_CENTER_POS) * STEP;
}

function bassPosToY(pos) {
  return STAFF_CENTER_Y - (pos - BASS_CENTER_POS) * STEP;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function drawOneStaff(svg, x1, x2, linePositions, posToY) {
  for (const pos of linePositions) {
    const y = posToY(pos);
    svg.appendChild(svgEl('line', {
      x1, y1: y, x2, y2: y,
      stroke: '#333', 'stroke-width': 1
    }));
  }
  // Left barline
  const top = posToY(linePositions[linePositions.length - 1]);
  const bottom = posToY(linePositions[0]);
  svg.appendChild(svgEl('line', {
    x1, y1: top, x2: x1, y2: bottom,
    stroke: '#333', 'stroke-width': 2
  }));
}

function getBassXOffset() {
  return getClefMode() === 'bass' ? TREBLE_X1 - BASS_X1 : 0;
}

function drawClefs(svg) {
  const mode = getClefMode();
  if (mode === 'treble' || mode === 'both') {
    const gY = treblePosToY(4);
    const treble = svgEl('text', {
      x: TREBLE_X1 + 2, y: gY + 10,
      'font-size': '72',
      fill: '#333',
      'font-family': 'serif'
    });
    treble.textContent = '\u{1D11E}';
    svg.appendChild(treble);
  }
  if (mode === 'bass' || mode === 'both') {
    const off = getBassXOffset();
    const fY = bassPosToY(-4);
    const bass = svgEl('text', {
      x: BASS_X1 + off + 2, y: fY + 18,
      'font-size': '40',
      fill: '#333',
      'font-family': 'serif'
    });
    bass.textContent = '\u{1D122}';
    svg.appendChild(bass);
  }
}

function drawLedgerLinesForStaff(svg, pos, x, linePositions, posToY) {
  const topLine = linePositions[linePositions.length - 1];
  const bottomLine = linePositions[0];
  // Above staff
  if (pos > topLine) {
    for (let p = topLine + 2; p <= pos; p += 2) {
      const ly = posToY(p);
      svg.appendChild(svgEl('line', {
        x1: x - 15, y1: ly, x2: x + 15, y2: ly,
        stroke: '#333', 'stroke-width': 1
      }));
    }
  }
  // Below staff
  if (pos < bottomLine) {
    for (let p = bottomLine - 2; p >= pos; p -= 2) {
      const ly = posToY(p);
      svg.appendChild(svgEl('line', {
        x1: x - 15, y1: ly, x2: x + 15, y2: ly,
        stroke: '#333', 'stroke-width': 1
      }));
    }
  }
  // On a ledger line position (even pos outside staff)
  if (pos % 2 === 0 && pos > bottomLine && pos < topLine) {
    // inside staff, no ledger needed
  }
}

function drawNoteOnTreble(svg, note, color) {
  const pos = noteToStaffPos(note);
  const y = treblePosToY(pos);
  const x = (TREBLE_X1 + TREBLE_X2) / 2 + 20;
  drawLedgerLinesForStaff(svg, pos, x, TREBLE_LINE_POSITIONS, treblePosToY);
  svg.appendChild(svgEl('ellipse', {
    cx: x, cy: y, rx: 8, ry: 5.5,
    transform: `rotate(-15, ${x}, ${y})`,
    fill: color
  }));
}

function drawNoteOnBass(svg, note, color) {
  const pos = noteToStaffPos(note);
  const y = bassPosToY(pos);
  const off = getBassXOffset();
  const x = (BASS_X1 + BASS_X2) / 2 + 20 + off;
  drawLedgerLinesForStaff(svg, pos, x, BASS_LINE_POSITIONS, bassPosToY);
  svg.appendChild(svgEl('ellipse', {
    cx: x, cy: y, rx: 8, ry: 5.5,
    transform: `rotate(-15, ${x}, ${y})`,
    fill: color
  }));
}

function drawNoteOnBothStaves(svg, note, color) {
  drawNoteOnTreble(svg, note, color);
  drawNoteOnBass(svg, note, color);
}

function getClefMode() {
  return document.getElementById('clef-select').value;
}

function drawNoteForMode(svg, note, color) {
  const mode = getClefMode();
  if (mode === 'treble') drawNoteOnTreble(svg, note, color);
  else drawNoteOnBass(svg, note, color);
}

function renderStaff(target, wrongNote, isCorrect) {
  const svg = document.getElementById('staff');
  svg.innerHTML = '';
  const mode = getClefMode();
  // Adjust viewBox for single vs both staves
  if (mode === 'both') {
    svg.setAttribute('viewBox', '0 0 800 160');
  } else {
    svg.setAttribute('viewBox', '0 0 400 160');
  }
  if (mode === 'treble' || mode === 'both') {
    drawOneStaff(svg, TREBLE_X1, TREBLE_X2, TREBLE_LINE_POSITIONS, treblePosToY);
  }
  if (mode === 'bass' || mode === 'both') {
    const off = getBassXOffset();
    drawOneStaff(svg, BASS_X1 + off, BASS_X2 + off, BASS_LINE_POSITIONS, bassPosToY);
  }
  drawClefs(svg);
  if (target) {
    const targetColor = isCorrect ? '#27ae60' : '#000';
    drawNoteForMode(svg, target, targetColor);
  }
  if (wrongNote) {
    drawNoteForMode(svg, wrongNote, '#e74c3c');
  }
}

// ============================================================
// Pitch Detection (Autocorrelation)
// ============================================================
function autoCorrelate(buffer, sampleRate) {
  const len = buffer.length;

  // 1. Check signal level
  let rms = 0;
  for (let i = 0; i < len; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / len);
  if (rms < 0.02) return -1;

  // 2. Normalized Square Difference Function (NSDF)
  // More robust than raw autocorrelation — less prone to octave errors
  const nsdf = new Float32Array(len);
  for (let tau = 0; tau < len; tau++) {
    let acf = 0;
    let divisor = 0;
    for (let i = 0; i < len - tau; i++) {
      acf += buffer[i] * buffer[i + tau];
      divisor += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
    }
    nsdf[tau] = divisor > 0 ? 2 * acf / divisor : 0;
  }

  // 3. Find peaks in NSDF using zero-crossing method
  // Look for positive regions after first zero crossing
  const peaks = [];
  let posStart = -1;

  // Skip initial positive region (tau=0 is always 1.0)
  let tau = 1;
  while (tau < len && nsdf[tau] > 0) tau++;

  // Now find peaks in subsequent positive regions
  for (; tau < len - 1; tau++) {
    if (nsdf[tau] > 0 && posStart < 0) {
      posStart = tau;
    }
    if (nsdf[tau] <= 0 && posStart >= 0) {
      // End of positive region — find max in this region
      let bestVal = -1;
      let bestPos = posStart;
      for (let j = posStart; j < tau; j++) {
        if (nsdf[j] > bestVal) {
          bestVal = nsdf[j];
          bestPos = j;
        }
      }
      peaks.push({ pos: bestPos, val: bestVal });
      posStart = -1;
    }
  }
  // Handle last positive region
  if (posStart >= 0) {
    let bestVal = -1;
    let bestPos = posStart;
    for (let j = posStart; j < len; j++) {
      if (nsdf[j] > bestVal) {
        bestVal = nsdf[j];
        bestPos = j;
      }
    }
    peaks.push({ pos: bestPos, val: bestVal });
  }

  if (peaks.length === 0) return -1;

  // 4. Pick the first peak above a confidence threshold
  // (key insight: first strong peak = fundamental, avoids octave errors)
  const highestVal = Math.max(...peaks.map((p) => p.val));
  const threshold = highestVal * 0.8;
  let chosen = null;
  for (const p of peaks) {
    if (p.val >= threshold) {
      chosen = p;
      break;
    }
  }

  if (!chosen || chosen.val < 0.3) return -1; // low confidence

  // 5. Parabolic interpolation for sub-sample accuracy
  let bestPos = chosen.pos;
  if (bestPos > 0 && bestPos < len - 1) {
    const a = nsdf[bestPos - 1];
    const b = nsdf[bestPos];
    const c = nsdf[bestPos + 1];
    const denom = 2 * (a - 2 * b + c);
    if (denom !== 0) {
      bestPos += (a - c) / denom;
    }
  }

  const freq = sampleRate / bestPos;

  // 6. Sanity check: piano range 27.5 Hz (A0) to 4186 Hz (C8)
  if (freq < 27 || freq > 4200) return -1;

  return freq;
}

// ============================================================
// Range Selection
// ============================================================
const rangeLowEl = document.getElementById('range-low');
const rangeHighEl = document.getElementById('range-high');

// Populate dropdowns with playable notes
PLAYABLE_NOTES.forEach((note, i) => {
  const jp = JP_NAMES[note.name];
  const label = `${jp}${note.octave} (${note.name}${note.octave})`;
  const optLow = new Option(label, i);
  const optHigh = new Option(label, i);
  rangeLowEl.appendChild(optLow);
  rangeHighEl.appendChild(optHigh);
});

// Default: C3 to C5
function setDefaultRange() {
  const mode = getClefMode();
  let lo, hi;
  if (mode === 'bass') {
    lo = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 3);
    hi = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 4);
  } else {
    lo = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 4);
    hi = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 5);
  }
  rangeLowEl.value = lo >= 0 ? lo : 0;
  rangeHighEl.value = hi >= 0 ? hi : PLAYABLE_NOTES.length - 1;
}

setDefaultRange();

document.getElementById('clef-select').addEventListener('change', () => {
  setDefaultRange();
  renderStaff(null, null, false);
});

function getPlayableRange() {
  const lo = parseInt(rangeLowEl.value);
  const hi = parseInt(rangeHighEl.value);
  const low = Math.min(lo, hi);
  const high = Math.max(lo, hi);
  return PLAYABLE_NOTES.slice(low, high + 1);
}

// ============================================================
// Game State
// ============================================================
let state = 'IDLE'; // IDLE (mic on, no game), LISTENING, CORRECT
let targetNote = null;
let activeClef = 'treble';
let score = 0;
const HOLD_TIME = 2000; // 2 seconds sustained note required
const WIN_SCORE = 10;

let currentDetected = null;  // currently sustained note
let sustainStart = 0;        // timestamp when current note started
let wrongDeducted = false;   // already deducted for this wrong note

let audioCtx = null;
let analyser = null;
let dataBuffer = null;
let animFrameId = null;

const startBtn = document.getElementById('start-btn');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');

function pickRandomNote() {
  const range = getPlayableRange();
  const idx = Math.floor(Math.random() * range.length);
  targetNote = range[idx];
  renderStaff(targetNote, null, false);
  feedbackEl.textContent = 'きいているよ...';
  feedbackEl.classList.remove('correct');
  currentDetected = null;
  sustainStart = 0;
  wrongDeducted = false;
}

function handleDetected(freq) {
  const detected = frequencyToNote(freq);
  if (!detected) {
    currentDetected = null;
    sustainStart = 0;
    return;
  }

  const now = performance.now();
  const jp = JP_NAMES[detected.name] || detected.name;

  // Show detected note in IDLE mode (before game starts)
  if (state === 'IDLE') {
    feedbackEl.textContent = `${jp}${detected.octave}`;
    return;
  }

  if (state !== 'LISTENING') return;

  // Check if same note as before
  const sameNote = currentDetected &&
    currentDetected.name === detected.name &&
    currentDetected.octave === detected.octave;

  if (!sameNote) {
    currentDetected = detected;
    sustainStart = now;
    wrongDeducted = false;
  }

  const held = now - sustainStart;

  // Show detected note on staff
  const isCorrect = detected.name === targetNote.name && detected.octave === targetNote.octave;

  if (isCorrect) {
    if (!detected.name.includes('#')) {
      renderStaff(targetNote, null, false);
    }
    if (held >= HOLD_TIME) {
      state = 'CORRECT';
      score++;
      scoreEl.textContent = `てんすう: ${score}`;
      renderStaff(targetNote, null, true);
      if (score >= WIN_SCORE) {
        feedbackEl.textContent = 'やったね！かち！';
        feedbackEl.classList.add('correct');
        setTimeout(() => stopGame(), 1500);
      } else {
        feedbackEl.textContent = 'すごい！';
        feedbackEl.classList.add('correct');
        setTimeout(() => {
          state = 'LISTENING';
          pickRandomNote();
        }, 800);
      }
    } else {
      // Show progress
      const pct = Math.floor(held / HOLD_TIME * 100);
      feedbackEl.textContent = `${jp}${detected.octave}... ${pct}%`;
    }
  } else {
    // Wrong note
    if (!detected.name.includes('#')) {
      renderStaff(targetNote, detected, false);
    }
    if (held >= HOLD_TIME && !wrongDeducted) {
      wrongDeducted = true;
      score = Math.max(0, score - 1);
      scoreEl.textContent = `てんすう: ${score}`;
    }
    const pct = Math.floor(Math.min(held, HOLD_TIME) / HOLD_TIME * 100);
    feedbackEl.textContent = `${jp}${detected.octave}... ${pct}%`;
  }
}

function detectLoop() {
  analyser.getFloatTimeDomainData(dataBuffer);
  const freq = autoCorrelate(dataBuffer, audioCtx.sampleRate);
  if (freq > 0) {
    handleDetected(freq);
  } else {
    currentDetected = null;
    sustainStart = 0;
    if (state === 'IDLE') {
      feedbackEl.textContent = 'ボタンをおしてね';
    }
  }
  animFrameId = requestAnimationFrame(detectLoop);
}

// Start mic immediately on page load
async function initMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    await audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 8192;
    source.connect(analyser);
    dataBuffer = new Float32Array(analyser.fftSize);
    detectLoop();
  } catch (err) {
    feedbackEl.textContent = 'マイクがつかえません。きょかしてね。';
    console.error(err);
  }
}

function startGame() {
  state = 'LISTENING';
  score = 0;
  scoreEl.textContent = `てんすう: ${score}`;
  startBtn.textContent = 'やめる';
  startBtn.classList.add('listening');
  pickRandomNote();
}

function stopGame() {
  state = 'IDLE';
  startBtn.textContent = 'はじめる';
  startBtn.classList.remove('listening');
  feedbackEl.textContent = 'ボタンをおしてね';
  feedbackEl.classList.remove('correct');
  targetNote = null;
  renderStaff(null, null, false);
}

startBtn.addEventListener('click', () => {
  if (state === 'IDLE') {
    // Init mic on first click if not yet
    if (!audioCtx) {
      initMic().then(() => startGame());
    } else {
      startGame();
    }
  } else {
    stopGame();
  }
});

// ============================================================
// Init
// ============================================================
renderStaff(null, null, false);
initMic();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
