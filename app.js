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
  return minDist < 50 ? closest : null;
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
  else if (mode === 'bass') drawNoteOnBass(svg, note, color);
  else drawNoteOnBothStaves(svg, note, color);
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
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.03) return -1; // higher threshold — only respond to clear piano sound

  // Find a good starting point and ending point by trimming silence
  const threshold = 0.2;
  let start = 0;
  let end = buffer.length - 1;
  while (start < buffer.length / 2 && Math.abs(buffer[start]) < threshold) start++;
  while (end > buffer.length / 2 && Math.abs(buffer[end]) < threshold) end--;

  if (end - start < 100) return -1;

  const len = end - start;
  const corr = new Float32Array(len);

  for (let lag = 0; lag < len; lag++) {
    let sum = 0;
    for (let i = 0; i < len - lag; i++) {
      sum += buffer[start + i] * buffer[start + i + lag];
    }
    corr[lag] = sum;
  }

  // Walk past the initial positive region
  let d = 0;
  while (d < len - 1 && corr[d] > corr[d + 1]) d++;

  // Find the highest peak after that
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < len; i++) {
    if (corr[i] > maxVal) {
      maxVal = corr[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0) return -1;

  // Parabolic interpolation
  if (maxPos > 0 && maxPos < len - 1) {
    const a = corr[maxPos - 1];
    const b = corr[maxPos];
    const c = corr[maxPos + 1];
    const denom = 2 * (a - 2 * b + c);
    if (denom !== 0) {
      maxPos += (a - c) / denom;
    }
  }

  return sampleRate / maxPos;
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
const defaultLow = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 4);
const defaultHigh = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 6);
rangeLowEl.value = defaultLow >= 0 ? defaultLow : 0;
rangeHighEl.value = defaultHigh >= 0 ? defaultHigh : PLAYABLE_NOTES.length - 1;

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
let state = 'IDLE';
let targetNote = null;
let score = 0;
let matchCount = 0;
let wrongCount = 0;
const REQUIRED_MATCHES = 5;
const WIN_SCORE = 10;

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
  matchCount = 0;
  wrongCount = 0;
}

function handleDetected(freq) {
  if (state !== 'LISTENING') return;

  const detected = frequencyToNote(freq);
  if (!detected) return;

  if (detected.name === targetNote.name && detected.octave === targetNote.octave) {
    wrongCount = 0;
    matchCount++;
    if (matchCount >= REQUIRED_MATCHES) {
      state = 'CORRECT';
      score++;
      scoreEl.textContent = `てんすう: ${score}`;
      renderStaff(targetNote, null, true);
      if (score >= WIN_SCORE) {
        feedbackEl.textContent = 'やったね！かち！';
        feedbackEl.classList.add('correct');
        setTimeout(() => stopListening(), 1500);
      } else {
        feedbackEl.textContent = 'すごい！';
        feedbackEl.classList.add('correct');
        setTimeout(() => {
          state = 'LISTENING';
          pickRandomNote();
        }, 800);
      }
    }
  } else {
    matchCount = 0;
    wrongCount++;
    // Deduct once after a few frames of sustained wrong note
    if (wrongCount === REQUIRED_MATCHES) {
      score = Math.max(0, score - 1);
      scoreEl.textContent = `てんすう: ${score}`;
    }
    // Show wrong note in red
    if (!detected.name.includes('#')) {
      renderStaff(targetNote, detected, false);
    }
  }
}

function detectLoop() {
  analyser.getFloatTimeDomainData(dataBuffer);
  const freq = autoCorrelate(dataBuffer, audioCtx.sampleRate);
  if (freq > 0) {
    handleDetected(freq);
  }
  animFrameId = requestAnimationFrame(detectLoop);
}

async function startListening() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    await audioCtx.resume();

    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 8192; // larger buffer for accurate piano pitch detection
    source.connect(analyser);

    dataBuffer = new Float32Array(analyser.fftSize);

    state = 'LISTENING';
    score = 0;
    scoreEl.textContent = `てんすう: ${score}`;
    startBtn.textContent = 'やめる';
    startBtn.classList.add('listening');
    pickRandomNote();
    detectLoop();
  } catch (err) {
    feedbackEl.textContent = 'マイクがつかえません。きょかしてね。';
    console.error(err);
  }
}

function stopListening() {
  state = 'IDLE';
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (audioCtx) audioCtx.close();
  audioCtx = null;
  startBtn.textContent = 'はじめる';
  startBtn.classList.remove('listening');
  feedbackEl.textContent = 'ボタンをおしてね';
  feedbackEl.classList.remove('correct');
  renderStaff(null, null, false);
}

startBtn.addEventListener('click', () => {
  if (state === 'IDLE') {
    startListening();
  } else {
    stopListening();
  }
});

// ============================================================
// Init
// ============================================================
renderStaff(null, null, false);

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
