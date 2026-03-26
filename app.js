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
// SVG Staff rendering
// ============================================================
const SVG_NS = 'http://www.w3.org/2000/svg';
const STAFF_LINE_SPACING = 10;
const STEP = STAFF_LINE_SPACING / 2; // 5px per diatonic step

// Y positions: Treble staff top line (F5) to bottom line (E4)
// Bass staff top line (A3) to bottom line (G2)
const TREBLE_TOP = 50;   // top line of treble staff (F5)
const BASS_TOP = 170;    // top line of bass staff (A3)
const MIDDLE_C_Y = 145;  // C4 ledger line position (between the staves)

// Staff position: number of diatonic steps above C4
// C4=0, D4=1, E4=2, F4=3, G4=4, A4=5, B4=6, C5=7, ...
const DIATONIC = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

function noteToStaffPos(note) {
  return DIATONIC[note.name] + (note.octave - 4) * 7;
}

function staffPosToY(pos) {
  return MIDDLE_C_Y - pos * STEP;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function drawStaffLines(svg) {
  // Treble: lines at E4, G4, B4, D5, F5 → staff positions 2,4,6,8,10
  const treblePositions = [2, 4, 6, 8, 10];
  // Bass: lines at G2, B2, D3, F3, A3 → staff positions -7,-5,-3,-1,1  (wait, let me recalculate)
  // G2 = DIATONIC.G + (2-4)*7 = 4 - 14 = -10
  // B2 = 6 - 14 = -8
  // D3 = 1 - 7 = -6
  // F3 = 3 - 7 = -4
  // A3 = 5 - 7 = -2
  const bassPositions = [-10, -8, -6, -4, -2];

  const allPositions = [...treblePositions, ...bassPositions];
  for (const pos of allPositions) {
    const y = staffPosToY(pos);
    svg.appendChild(svgEl('line', {
      x1: 60, y1: y, x2: 360, y2: y,
      stroke: '#333', 'stroke-width': 1
    }));
  }

  // Left barlines (separate for each staff)
  const trebleTop = staffPosToY(10);
  const trebleBottom = staffPosToY(2);
  svg.appendChild(svgEl('line', {
    x1: 60, y1: trebleTop, x2: 60, y2: trebleBottom,
    stroke: '#333', 'stroke-width': 2
  }));
  const bassTop = staffPosToY(-2);
  const bassBottom = staffPosToY(-10);
  svg.appendChild(svgEl('line', {
    x1: 60, y1: bassTop, x2: 60, y2: bassBottom,
    stroke: '#333', 'stroke-width': 2
  }));
}

function drawClefs(svg) {
  // Treble clef - the curl wraps around the G4 line
  const trebleG = staffPosToY(4);
  const treble = svgEl('text', {
    x: 62, y: trebleG + 10,
    'font-size': '72',
    fill: '#333',
    'font-family': 'serif'
  });
  treble.textContent = '\u{1D11E}';
  svg.appendChild(treble);

  // Bass clef - positioned on F3 line (staff pos -4)
  const bassF = staffPosToY(-4);
  const bass = svgEl('text', {
    x: 62, y: bassF + 18,
    'font-size': '40',
    fill: '#333',
    'font-family': 'serif'
  });
  bass.textContent = '\u{1D122}';
  svg.appendChild(bass);
}

function drawLedgerLines(svg, pos, x) {
  // Ledger lines above treble staff
  if (pos > 10) {
    for (let p = 12; p <= pos; p += 2) {
      const ly = staffPosToY(p);
      svg.appendChild(svgEl('line', {
        x1: x - 15, y1: ly, x2: x + 15, y2: ly,
        stroke: '#333', 'stroke-width': 1
      }));
    }
  }
  // Ledger lines below bass staff
  if (pos < -10) {
    for (let p = -12; p >= pos; p -= 2) {
      const ly = staffPosToY(p);
      svg.appendChild(svgEl('line', {
        x1: x - 15, y1: ly, x2: x + 15, y2: ly,
        stroke: '#333', 'stroke-width': 1
      }));
    }
  }
  // Middle C ledger line
  if (pos === 0) {
    const y = staffPosToY(0);
    svg.appendChild(svgEl('line', {
      x1: x - 15, y1: y, x2: x + 15, y2: y,
      stroke: '#333', 'stroke-width': 1
    }));
  }
}

function drawNoteHead(svg, note, x, color) {
  const pos = noteToStaffPos(note);
  const y = staffPosToY(pos);
  drawLedgerLines(svg, pos, x);
  const noteHead = svgEl('ellipse', {
    cx: x, cy: y, rx: 8, ry: 5.5,
    transform: `rotate(-15, ${x}, ${y})`,
    fill: color
  });
  svg.appendChild(noteHead);
}

function renderStaff(target, wrongNote, isCorrect) {
  const svg = document.getElementById('staff');
  svg.innerHTML = '';
  drawStaffLines(svg);
  drawClefs(svg);
  if (target) {
    const targetColor = isCorrect ? '#27ae60' : '#000';
    drawNoteHead(svg, target, 210, targetColor);
  }
  if (wrongNote) {
    drawNoteHead(svg, wrongNote, 210, '#e74c3c');
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
const defaultLow = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 3);
const defaultHigh = PLAYABLE_NOTES.findIndex((n) => n.name === 'C' && n.octave === 5);
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
