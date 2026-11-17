import { calculateMatch, parseOvers, prepareEvents, ballsToOvers, oversToBalls, deriveSecondOvers } from './engine.js';
import { evaluateReportReadiness, describeReportOutcome } from './report.js';
import { createMatchArchiveRecord } from './match-record.js';

const $ = (id) => document.getElementById(id);
let currentResult = null;
let currentInput = null;
let activeTable = 'overs';
let deferredInstallPrompt = null;
let previousMatchType = $('matchType').value || '';
let validationStarted = false;
let suspendAutoCalculation = false;
let uploadInProgress = false;

const MATCH_TYPES = {
  odi: { overs: 50, minOvers: 20, label: 'ODI regulations (50 overs/innings)' },
  t20: { overs: 20, minOvers: 55, label: 'Twenty20 (20 overs/innings)' },
  'other-50-10': { overs: 50, minOvers: 10, label: 'Other: 50 overs/innings' },
  'other-45-20': { overs: 45, minOvers: 20, label: 'Promotion League (45 overs/innings)' },
  'womens-35': { overs: 35, minOvers: null, label: "Women's League (35 overs/innings)" },
  'womens-t20': { overs: 20, minOvers: null, label: "Women's T20 (20 overs/innings)" },
  'other-40-10': { overs: 40, minOvers: 10, label: 'Other: 40 overs/innings' }
};

function setConnectionStatus() {
  const el = $('connectionState');
  const online = navigator.onLine;
  el.classList.toggle('online', online);
  el.classList.toggle('offline', !online);
  el.lastElementChild.textContent = online ? 'Online · offline-ready' : 'Offline · calculating locally';
}
window.addEventListener('online', () => { setConnectionStatus(); uploadPendingMatches({ automatic: true }); });
window.addEventListener('offline', setConnectionStatus);
setConnectionStatus();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('installButton').classList.remove('hidden');
});
$('installButton').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installButton').classList.add('hidden');
});

function formatOvers(value) {
  return ballsToOvers(oversToBalls(Number(value)));
}

function addEventRow(containerId, row = {}) {
  const container = $(containerId);
  const wrapper = document.createElement('div');
  wrapper.className = 'event-row';
  wrapper.innerHTML = `
    <label class="event-field"><span>Overs bowled at stoppage</span><input type="text" class="event-overs" inputmode="decimal" placeholder="e.g. 17.3" aria-label="Overs bowled at stoppage"><small class="field-error" aria-live="polite"></small></label>
    <label class="event-field"><span>Runs at stoppage <small>optional</small></span><input type="number" class="event-score" min="0" max="999" step="1" placeholder="e.g. 125" aria-label="Runs at stoppage"><small class="field-error" aria-live="polite"></small></label>
    <label class="event-field"><span>Wickets down</span><input type="number" class="event-wickets" min="0" max="10" step="1" placeholder="e.g. 3" aria-label="Wickets down at stoppage" value="0"><small class="field-error" aria-live="polite"></small></label>
    <label class="event-field"><span>Overs lost</span><input type="text" class="event-loss" inputmode="decimal" placeholder="e.g. 4.0 or A" aria-label="Overs lost at interruption"><small>Use A for all remaining overs.</small><small class="field-error" aria-live="polite"></small></label>
    <button class="remove-event" type="button" aria-label="Remove interruption">×</button>`;
  wrapper.querySelector('.event-overs').value = row.oversBowled ?? '';
  wrapper.querySelector('.event-score').value = row.scoreAtEvent ?? '';
  wrapper.querySelector('.event-wickets').value = row.wickets ?? 0;
  wrapper.querySelector('.event-loss').value = row.oversLost ?? '';
  wrapper.querySelector('.remove-event').addEventListener('click', () => {
    wrapper.remove();
    updateEmptyMessages();
    if (containerId === 'firstEvents') syncSecondOversFromFirst();
    handleCoreInputChange();
  });
  wrapper.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
    if (containerId === 'firstEvents') syncSecondOversFromFirst();
    handleCoreInputChange();
  }));
  container.appendChild(wrapper);
  updateEmptyMessages();
  if (containerId === 'firstEvents') syncSecondOversFromFirst();
  if (!suspendAutoCalculation) {
    validationStarted = true;
    handleCoreInputChange();
  }
}
function updateEmptyMessages() {
  $('firstEmpty').style.display = $('firstEvents').children.length ? 'none' : 'block';
  $('secondEmpty').style.display = $('secondEvents').children.length ? 'none' : 'block';
}
$('addFirstEvent').addEventListener('click', () => addEventRow('firstEvents'));
$('addSecondEvent').addEventListener('click', () => addEventRow('secondEvents'));

// Start a new match with one blank interruption row in each innings.
addEventRow('firstEvents');
addEventRow('secondEvents');

function readEventRows(containerId) {
  return [...$(containerId).querySelectorAll('.event-row')].map(row => ({
    oversBowled: row.querySelector('.event-overs').value.trim(),
    scoreAtEvent: row.querySelector('.event-score').value.trim(),
    wickets: row.querySelector('.event-wickets').value,
    oversLost: row.querySelector('.event-loss').value.trim()
  })).filter(row => !isBlankEventRow(row));
}

function isBlankEventRow(row) {
  return !row.oversBowled && !row.oversLost && !row.scoreAtEvent && (!row.wickets || row.wickets === '0');
}

function firstInningsAllocationPreview() {
  const scheduled = Number($('firstOvers').value);
  if (!Number.isInteger(scheduled) || scheduled < 1 || scheduled > 100) {
    return { valid: false, message: 'Enter valid first-innings scheduled overs to calculate the chase allocation.' };
  }
  const rows = readEventRows('firstEvents').filter(row => !isBlankEventRow(row));
  if (!rows.length) return { valid: true, totalLostBalls: 0, remainingOvers: `${scheduled}.0`, remainingBalls: scheduled * 6 };

  // Only use a fully entered first-innings event. An incomplete row must not
  // silently change the scheduled overs for the chasing side.
  const completeRows = [];
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].oversBowled || !rows[i].oversLost) {
      return { valid: false, message: `Complete interruption ${i + 1}: enter both overs bowled and overs lost.` };
    }
    completeRows.push(rows[i]);
  }
  try {
    const events = prepareEvents(completeRows, scheduled, 'First innings');
    const remainingOvers = deriveSecondOvers(scheduled, events);
    const remainingBalls = oversToBalls(parseOvers(remainingOvers));
    const totalLostBalls = scheduled * 6 - remainingBalls;
    return { valid: true, events, totalLostBalls, remainingOvers, remainingBalls };
  } catch (error) {
    return { valid: false, message: error?.message || 'Check the first-innings interruption entries.' };
  }
}

function syncSecondOversFromFirst() {
  // The chasing side starts with the first-innings allocation after all
  // first-innings interruption losses have been applied.
  const allocation = firstInningsAllocationPreview();
  $('secondOvers').value = allocation.valid ? allocation.remainingOvers : '';
  $('autoSecondOvers').checked = true;
}
$('autoSecondOvers').addEventListener('change', () => {
  syncSecondOversFromFirst();
  handleCoreInputChange();
});
$('firstOvers').addEventListener('input', () => {
  syncSecondOversFromFirst();
  handleCoreInputChange();
});
$('firstRuns').addEventListener('input', handleCoreInputChange);
$('secondOvers').addEventListener('input', handleCoreInputChange);
$('minOversPerSide').addEventListener('input', handleCoreInputChange);
$('penaltyRuns').addEventListener('input', handleCoreInputChange);
$('matchName').addEventListener('input', handleCoreInputChange);
$('reportCapturerFirstName').addEventListener('input', handleCoreInputChange);
$('reportCapturerSurname').addEventListener('input', handleCoreInputChange);

function applyMatchType(type, { presetOvers = true, preserveOtherMinimum = false } = {}) {
  const preset = MATCH_TYPES[type];
  const isFixedMinimum = type === 'odi' || type === 't20';
  const isOther = type.startsWith('other-') || type.startsWith('womens-') || type === 'custom';
  const selected = !!type;
  $('firstOvers').disabled = !selected;
  $('minOversPerSide').disabled = !selected;
  $('minOversPerSide').readOnly = isFixedMinimum;
  if (!selected) {
    $('firstOvers').value = '';
    $('minOversPerSide').value = '';
    $('minimumOversHelp').textContent = 'ODI defaults to 20; T20 defaults to 5.';
  } else if (preset) {
    if (presetOvers) $('firstOvers').value = String(preset.overs);
    if (preset.minOvers == null) {
      if (presetOvers) $('minOversPerSide').value = '';
    } else if (!preserveOtherMinimum || isFixedMinimum) {
      $('minOversPerSide').value = String(preset.minOvers);
    }
  } else if (type === 'custom') {
    if (presetOvers) {
      $('firstOvers').value = '';
      $('minOversPerSide').value = '';
      } else if (!preserveOtherMinimum && (!$('minOversPerSide').value || Number($('minOversPerSide').value) < 1)) {
      $('minOversPerSide').value = '';
    }
  }
  if (isFixedMinimum) {
    $('minimumOversHelp').textContent = type === 'odi'
      ? 'ODI default: 20 minimum overs per side.'
      : 'T20 default: 5 minimum overs per side.';
  } else if (isOther) {
    $('minimumOversHelp').textContent = 'Enter the minimum overs required for each side.'
  }
  syncSecondOversFromFirst();
}
$('matchType').addEventListener('change', () => {
  const nextType = $('matchType').value;
  // Blank default rows are not captured interruption data and never require
  // confirmation. Only warn when at least one row contains an entered value.
  const hasCapturedEvents =
    readEventRows('firstEvents').length > 0 ||
    readEventRows('secondEvents').length > 0;
  if (hasCapturedEvents && !confirm('Changing match type changes the innings allocation. Clear the interruption entries and continue?')) {
    $('matchType').value = previousMatchType;
    return;
  }

  // A match-type change always starts both innings with exactly one clean row.
  suspendAutoCalculation = true;
  $('firstEvents').replaceChildren();
  $('secondEvents').replaceChildren();
  addEventRow('firstEvents');
  addEventRow('secondEvents');
  suspendAutoCalculation = false;

  previousMatchType = nextType;
  applyMatchType(nextType);
  validationStarted = true;
  handleCoreInputChange();
});
function currentMatchTypeLabel() {
  const type = $('matchType').value;
  const min = Number($('minOversPerSide').value);
  const scheduled = Number($('firstOvers').value);
  if (type === 'custom') {
    return `Custom (${scheduled} overs/innings; minimum ${min} overs/side)`;
  }
  const preset = MATCH_TYPES[type];
  if (preset) return `${preset.label}; minimum ${min} overs/side`;
  return $('matchType').selectedOptions[0]?.textContent || 'Custom match type';
}

function setControlError(control, message) {
  const label = control.closest('.field, .event-field');
  if (!label) return;
  label.classList.toggle('is-invalid', !!message);
  control.setAttribute('aria-invalid', message ? 'true' : 'false');
  const messageNode = label.querySelector('.field-error');
  if (messageNode) messageNode.textContent = message || '';
}

function clearControlErrors() {
  document.querySelectorAll('#matchForm .field, #matchForm .event-field').forEach(label => {
    label.classList.remove('is-invalid');
    const control = label.querySelector('input, select');
    if (control) control.setAttribute('aria-invalid', 'false');
    const messageNode = label.querySelector('.field-error');
    if (messageNode) messageNode.textContent = '';
  });
}

function validateEventRows(containerId, scheduledOvers, label, firstRuns = null) {
  const errors = [];
  const wrappers = [...$(containerId).querySelectorAll('.event-row')];
  if (!wrappers.length || !Number.isFinite(scheduledOvers) || scheduledOvers <= 0) return errors;

  const scheduledBalls = oversToBalls(scheduledOvers);
  let previousOverBalls = -1;
  let previousLossBalls = 0;
  let previousWickets = 0;
  let previousScore = 0;

  wrappers.forEach((wrapper, index) => {
    const rowNo = index + 1;
    const oversControl = wrapper.querySelector('.event-overs');
    const scoreControl = wrapper.querySelector('.event-score');
    const wicketsControl = wrapper.querySelector('.event-wickets');
    const lossControl = wrapper.querySelector('.event-loss');
    if (!oversControl.value.trim() && !scoreControl.value.trim() && !lossControl.value.trim() &&
        (!wicketsControl.value.trim() || wicketsControl.value.trim() === '0')) return;
    let rowOverBalls = null;
    let rowLossBalls = null;
    let rowWickets = null;
    let rowScore = null;

    const oversText = oversControl.value.trim();
    if (!oversText) {
      errors.push({ control: oversControl, message: `${label} interruption ${rowNo}: overs bowled is required.` });
    } else {
      try {
        rowOverBalls = oversToBalls(parseOvers(oversText, 'Overs bowled'));
        if (rowOverBalls > scheduledBalls) throw new Error('cannot exceed the scheduled innings length');
        if (rowOverBalls < previousOverBalls) throw new Error('must be in chronological order');
        previousOverBalls = rowOverBalls;
      } catch (error) {
        errors.push({ control: oversControl, message: `${label} interruption ${rowNo}: ${error.message}` });
        rowOverBalls = null;
      }
    }

    const wicketsText = wicketsControl.value.trim();
    if (wicketsText === '') {
      errors.push({ control: wicketsControl, message: `${label} interruption ${rowNo}: wickets down is required (enter 0 if none).` });
    } else {
      rowWickets = Number(wicketsText);
      if (!Number.isInteger(rowWickets) || rowWickets < previousWickets || rowWickets > 10) {
        errors.push({ control: wicketsControl, message: `${label} interruption ${rowNo}: enter a whole number from ${previousWickets} to 10; wickets cannot decrease.` });
        rowWickets = null;
      } else {
        previousWickets = rowWickets;
      }
    }

    const scoreText = scoreControl.value.trim();
    if (scoreText !== '') {
      rowScore = Number(scoreText);
      if (!Number.isInteger(rowScore) || rowScore < previousScore || rowScore < 0 || rowScore > 999) {
        errors.push({ control: scoreControl, message: `${label} interruption ${rowNo}: runs must be a whole number from ${previousScore} to 999.` });
        rowScore = null;
      } else if (firstRuns != null && rowScore > firstRuns) {
        errors.push({ control: scoreControl, message: `${label} interruption ${rowNo}: runs at stoppage cannot exceed the final first-innings total (${firstRuns}).` });
        rowScore = null;
      } else {
        previousScore = rowScore;
      }
    }

    const lossText = lossControl.value.trim();
    if (!lossText) {
      errors.push({ control: lossControl, message: `${label} interruption ${rowNo}: overs lost is required.` });
    } else if (rowOverBalls != null) {
      const availableBalls = scheduledBalls - rowOverBalls - previousLossBalls;
      try {
        if (/^a$/i.test(lossText)) {
          rowLossBalls = Math.max(0, availableBalls);
        } else {
          rowLossBalls = oversToBalls(parseOvers(lossText, 'Overs lost'));
        }
        if (rowLossBalls < 0 || rowLossBalls > availableBalls) {
          throw new Error('cannot exceed the overs still available at this stoppage');
        }
        previousLossBalls += rowLossBalls;
      } catch (error) {
        errors.push({ control: lossControl, message: `${label} interruption ${rowNo}: ${error.message}` });
        rowLossBalls = null;
      }
    }
  });

  return errors;
}

function validateFormControls() {
  const errors = [];
  const add = (id, message) => errors.push({ control: $(id), message });
  const type = $('matchType').value;
  const hasType = !!type;
  if (!hasType) add('matchType', 'Select a match type before calculating.');

  let firstOvers = null;
  if (hasType) {
    const text = $('firstOvers').value.trim();
    const value = text === '' ? NaN : Number(text);
    if (!Number.isInteger(value) || value < 1 || value > 100) add('firstOvers', 'Enter scheduled overs as a whole number from 1 to 100.');
    else firstOvers = value;
  }

  const runsText = $('firstRuns').value.trim();
  const firstRuns = runsText === '' ? NaN : Number(runsText);
  if (!Number.isInteger(firstRuns) || firstRuns < 0 || firstRuns > 999) {
    add('firstRuns', 'Enter the first-innings total as a whole number from 0 to 999.');
  }

  if (hasType) {
    const minimumText = $('minOversPerSide').value.trim();
    const minimum = minimumText === '' ? NaN : Number(minimumText);
    if (!Number.isInteger(minimum) || minimum < 1 || minimum > 99) {
      add('minOversPerSide', 'Enter a minimum of 1 to 99 whole overs per side.');
    } else if (firstOvers != null && minimum > firstOvers) {
      add('minOversPerSide', 'Minimum overs cannot exceed the scheduled first-innings overs.');
    }
  }

  const penaltyText = $('penaltyRuns').value.trim();
  if (penaltyText !== '') {
    const penalty = Number(penaltyText);
    if (!Number.isInteger(penalty) || penalty < 0 || penalty > 999) {
      add('penaltyRuns', 'Penalty runs must be a whole number from 0 to 999.');
    }
  }
  const allocation = firstInningsAllocationPreview();
  const secondOvers = allocation.valid ? parseOvers(allocation.remainingOvers) : null;

  if (firstOvers != null) {
    errors.push(...validateEventRows('firstEvents', firstOvers, 'First innings', Number.isFinite(firstRuns) ? firstRuns : null));
  }
  if (secondOvers != null) {
    errors.push(...validateEventRows('secondEvents', secondOvers, 'Second innings'));
  }
  return errors;
}

function applyValidationErrors(errors) {
  clearControlErrors();
  errors.forEach(({ control, message }) => setControlError(control, message));
}

function collectInput() {
  if (!$('matchType').value) throw new Error('Select a match type before calculating.');
  const firstOvers = Number($('firstOvers').value);
  const firstRuns = Number($('firstRuns').value);
  const firstRows = readEventRows('firstEvents');
  const secondRows = readEventRows('secondEvents');
  const firstEvents = prepareEvents(firstRows, firstOvers, 'First innings');
  const allocation = firstInningsAllocationPreview();
  if (!allocation.valid) throw new Error(allocation.message);
  const secondOvers = parseOvers(allocation.remainingOvers);
  syncSecondOversFromFirst();
  const secondEvents = prepareEvents(secondRows, secondOvers, 'Second innings');
  const minOversPerSide = Number($('minOversPerSide').value);
  return {
    matchName: $('matchName').value.trim(),
    capturerFirstName: $('reportCapturerFirstName').value.trim() || 'Name',
    capturerSurname: $('reportCapturerSurname').value.trim() || 'Surname',
    capturedBy: `${$('reportCapturerFirstName').value.trim() || 'Name'} ${$('reportCapturerSurname').value.trim() || 'Surname'}`,
    matchType: $('matchType').value,
    matchTypeLabel: currentMatchTypeLabel(),
    minOversPerSide,
    autoSecondOvers: true,
    firstOvers,
    firstRuns,
    secondOvers,
    secondOversNotation: allocation.remainingOvers,
    penaltyRuns: Number($('penaltyRuns').value || 0),
    firstEvents,
    secondEvents,
    firstEventRows: firstRows,
    secondEventRows: secondRows
  };
}

function calculateAndDisplay({ scroll = false } = {}) {
  syncSecondOversFromFirst();
  const errors = validateFormControls();
  applyValidationErrors(errors);
  if (errors.length) {
    clearOutput();
    const firstError = errors[0].message;
    $('formError').textContent = validationStarted ? `Please correct the highlighted fields. ${firstError}` : firstError;
    $('autoCalcStatus').textContent = 'Complete the highlighted fields. DLS will calculate automatically when the inputs are valid.';
    return false;
  }
  try {
    const input = collectInput();
    const result = calculateMatch(input);
    displayResult(input, result, { scroll, resetReport: false });
    $('formError').textContent = '';
    $('autoCalcStatus').textContent = 'DLS updated automatically from the current match details.';
    return true;
  } catch (error) {
    clearOutput();
    $('formError').textContent = error?.message || 'Could not calculate this scenario.';
    $('autoCalcStatus').textContent = 'Check the highlighted or reported input before continuing.';
    return false;
  }
}

function handleCoreInputChange() {
  if (suspendAutoCalculation || !validationStarted) return;
  calculateAndDisplay({ scroll: false });
}
function prettyOvers(decimal) {
  const balls = Math.max(0, Math.round(decimal * 6));
  return ballsToOvers(balls);
}

function displayResult(input, result, { scroll = true, resetReport = false } = {}) {
  currentInput = input;
  currentResult = result;
  $('results').classList.remove('hidden');
  $('resultTitle').textContent = input.matchName || (result.noResult ? 'No result' : 'Revised target');
  $('resultSub').textContent = `${input.matchTypeLabel} · First innings: ${input.firstOvers} overs / ${input.firstRuns} runs · chasing allocation: ${formatOvers(input.secondOvers)} overs`;
  $('targetNumber').textContent = result.target.toLocaleString('en-ZA');
  const targetLabel = document.querySelector('.target-label');
  targetLabel.textContent = result.noResult ? 'PROVISIONAL DLS TARGET · NO RESULT' : 'SECOND INNINGS TARGET';
  const outcome = $('minimumOversOutcome');
  outcome.classList.toggle('hidden', !result.noResult);
  if (result.noResult) {
    outcome.textContent = `NO RESULT: ${result.noResultReason}`;
  }
  if (resetReport) {
    $('secondFinalRuns').value = '';
    $('secondFinalWickets').value = '';
    $('secondFinalOvers').value = '';
  }
  updateReportAvailability();
  $('lambdaValue').textContent = result.lambda.toFixed(4);
  $('adjustmentValue').textContent = result.adjustmentFactor.toFixed(9);
  $('revisedOvers').textContent = result.finalSecondOvers;
  $('calculatedSecondOvers').textContent = result.finalSecondOvers;
  $('resourceSummary').replaceChildren();
  const chips = [
    `First-innings overs lost: ${prettyOvers(result.firstResourcesLost)}`,
    `Second-innings overs lost: ${prettyOvers(result.secondResourcesLost)}`,
    `First-innings interruptions: ${input.firstEvents.length}`,
    `Second-innings interruptions: ${input.secondEvents.length}`,
    `Minimum overs per side: ${input.minOversPerSide}`,
    `Time per Over: ${input.timePerOver}`
  ];
  for (const label of chips) {
    const chip = document.createElement('span');
    chip.className = 'resource-chip';
    chip.textContent = label;
    $('resourceSummary').appendChild(chip);
  }
  renderTable(activeTable);
  if (scroll) $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTable(type) {
  if (!currentResult) return;
  activeTable = type;
  document.querySelectorAll('.tab').forEach(tab => {
    const active = tab.dataset.table === type;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  const rows = type === 'overs' ? currentResult.overRows : currentResult.ballRows;
  $('tableMeta').textContent = `${rows.length} ${type === 'overs' ? 'over' : 'ball'} positions · overs bowled ${rows[0]?.oversBowled ?? '—'} to ${rows.at(-1)?.oversBowled ?? '—'} · par score for 0–9 wickets`;
  const table = $('parTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.replaceChildren();
  tbody.replaceChildren();
  const headRow = document.createElement('tr');
  for (const label of [type === 'overs' ? 'Overs bowled' : 'Overs / balls bowled', 'Overs remaining', ...Array.from({ length: 10 }, (_, i) => `${i} wkts`)]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement('tr');
    const values = [row.oversBowled, row.oversRemaining, ...row.par];
    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value == null ? '--' : String(value);
      tr.appendChild(td);
    }
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
  $('exportCsv').dataset.table = type;
}

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => renderTable(tab.dataset.table)));
$('matchForm').addEventListener('submit', event => event.preventDefault());
function clearOutput() {
  currentInput = null;
  currentResult = null;
  $('calculatedSecondOvers').textContent = '—';
  $('results').classList.add('hidden');
  $('saveMessage').textContent = '';
  updateReportAvailability();
}
$('resetButton').addEventListener('click', () => {
  suspendAutoCalculation = true;
  validationStarted = false;
  $('matchName').value = '';
  $('reportCapturerFirstName').value = 'Name';
  $('reportCapturerSurname').value = 'Surname';
  $('matchType').value = '';
  previousMatchType = '';
  $('firstOvers').value = '';
  $('firstOvers').disabled = true;
  $('firstRuns').value = '';
  $('minOversPerSide').value = '';
  $('minOversPerSide').readOnly = true;
  $('minOversPerSide').disabled = true;
  $('minimumOversHelp').textContent = 'ODI defaults to 20; T20 defaults to 5.';
  $('autoSecondOvers').checked = true;
  $('secondOvers').value = '';
  $('secondOvers').disabled = true;
  $('penaltyRuns').value = '0';
  $('calculatedSecondOvers').textContent = '—';
  ['secondFinalRuns','secondFinalWickets','secondFinalOvers','reportCompetition','reportFirstTeam','reportSecondTeam','reportVenue'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('reportDate')) $('reportDate').value = new Date().toLocaleDateString('en-CA');
  $('firstEvents').replaceChildren();
  $('secondEvents').replaceChildren();
  addEventRow('firstEvents');
  addEventRow('secondEvents');
  updateEmptyMessages();
  clearOutput();
  clearControlErrors();
  $('formError').textContent = '';
  $('autoCalcStatus').textContent = 'Select a match type and enter the match details. Calculations update automatically.';
if (navigator.onLine) setTimeout(() => uploadPendingMatches({ automatic: true }), 900);
  syncSecondOversFromFirst();
  suspendAutoCalculation = false;
  $('matchType').focus();
});
function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeFilename(value) {
  return (value || 'dls-match').normalize('NFKD').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'dls-match';
}
function scenarioDocument() {
  if (!currentInput || !currentResult) throw new Error('Calculate a match first.');
  return { app: 'DLS 6.0 Umpire Calculator', appVersion: '0.5.3', exportedAt: new Date().toISOString(), input: currentInput, resultSummary: { target: currentResult.target, lambda: currentResult.lambda, adjustmentFactor: currentResult.adjustmentFactor, noResult: currentResult.noResult } };
}
function getReportReadiness() {
  return evaluateReportReadiness({
    result: currentResult,
    finalRunsRaw: $('secondFinalRuns').value,
    wicketsRaw: $('secondFinalWickets').value,
    oversRaw: $('secondFinalOvers').value,
    secondEvents: currentInput?.secondEvents || []
  });
}

function updateReportAvailability() {
  const button = $('createMatchReport');
  if (!button) return;
  const readiness = getReportReadiness();
  button.disabled = !readiness.eligible;
  const tag = $('reportGateTag');
  const status = $('reportAvailability');
  if (!currentResult) {
    tag.textContent = 'Calculate a match first';
  } else if (!readiness.eligible) {
    const tagLabels = {
      'missing-score': 'Final score required',
      'invalid-score': 'Invalid final score',
      'invalid-wickets': 'Invalid wicket total',
      'invalid-overs': 'Invalid finish overs',
      'score-before-event': 'Score details inconsistent',
      'wickets-before-event': 'Wicket details inconsistent',
      'overs-before-event': 'Overs details inconsistent',
      'overs-over-allocation': 'Overs exceed allocation'
    };
    tag.textContent = tagLabels[readiness.code] || 'Report details required';
  } else if (readiness.code === 'no-result') {
    tag.textContent = 'No Result · report ready';
  } else if (readiness.code === 'target-achieved') {
    tag.textContent = 'Target achieved · report ready';
  } else {
    tag.textContent = 'Report ready';
  }
  status.textContent = readiness.message;
}

$('secondFinalRuns').addEventListener('input', updateReportAvailability);
$('secondFinalWickets').addEventListener('input', updateReportAvailability);
$('secondFinalOvers').addEventListener('input', updateReportAvailability);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}
function reportEventRows(events) {
  if (!events.length) return '<tr><td colspan="5">No interruptions recorded.</td></tr>';
  return events.map((e, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(ballsToOvers(oversToBalls(e.oversBowled)))}</td><td>${e.scoreAtEvent == null ? '—' : e.scoreAtEvent}</td><td>${e.wickets}</td><td>${escapeHtml(ballsToOvers(oversToBalls(e.oversLost)))}</td></tr>`).join('');
}
function createReportHtml() {
  if (!currentInput || !currentResult) throw new Error('Calculate a match first.');
  const readiness = getReportReadiness();
  if (!readiness.eligible) throw new Error(readiness.message);
  const finalRuns = readiness.finalRuns;
  const wicketsLost = readiness.wicketsLost;
  const finalOvers = $('secondFinalOvers').value.trim();
  const competition = $('reportCompetition').value.trim() || '—';
  const team1 = $('reportFirstTeam').value.trim() || 'Team batting first';
  const team2 = $('reportSecondTeam').value.trim() || 'Team batting second';
  const venue = $('reportVenue').value.trim() || '—';
  const dateValue = $('reportDate').value;
  const matchDate = dateValue ? new Date(`${dateValue}T12:00:00`).toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' }) : new Date().toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' });
  const capturedBy = `${$('reportCapturerFirstName').value.trim() || 'Name'} ${$('reportCapturerSurname').value.trim() || 'Surname'}`;
  const resultText = describeReportOutcome({ result: currentResult, finalRuns, wicketsLost, chasingTeam: team2, defendingTeam: team1 });
  const matchTitle = currentInput.matchName || `${team1} vs ${team2}`;
  const firstTable = reportEventRows(currentInput.firstEvents);
  const secondTable = reportEventRows(currentInput.secondEvents);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DLS Match Report - ${escapeHtml(matchTitle)}</title><style>
    *{box-sizing:border-box}body{font:14px/1.5 Arial,sans-serif;color:#17263d;margin:0;background:#eef2f7}.page{max-width:900px;margin:24px auto;background:#fff;padding:38px 44px;box-shadow:0 8px 28px #12243a18}.top{border-bottom:3px solid #17395f;padding-bottom:18px;margin-bottom:22px}.eyebrow{font-size:11px;letter-spacing:.13em;color:#38649a;font-weight:bold;text-transform:uppercase}.top h1{font-size:27px;margin:5px 0;color:#132b49}.sub{color:#64748b}.meta,.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.tile{border:1px solid #dbe3ed;border-radius:8px;padding:11px}.tile small{display:block;color:#718096;font-size:10px;text-transform:uppercase;font-weight:bold}.tile strong{display:block;font-size:16px;margin-top:4px}.section{margin:22px 0}.section h2{font-size:16px;color:#18385f;border-bottom:1px solid #dbe3ed;padding-bottom:7px}.callout{background:#edf5ff;border-left:4px solid #2a65ac;padding:14px 16px;margin:16px 0}.callout strong{font-size:18px}.result{background:#edf8f1;border-left:4px solid #258354;padding:14px 16px;margin:16px 0}.result strong{color:#17603f}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}th,td{text-align:left;padding:8px;border:1px solid #dbe3ed}th{background:#f0f4f8;color:#354a66}.foot{border-top:1px solid #dbe3ed;margin-top:30px;padding-top:12px;font-size:10px;color:#77869a}.actions{display:flex;gap:10px;justify-content:flex-end;margin:0 auto 18px;max-width:900px}.actions button{background:#245ea9;color:#fff;border:0;border-radius:7px;padding:10px 15px;font-weight:bold;cursor:pointer}@media(max-width:620px){.page{margin:0;padding:22px 16px}.meta,.stats{grid-template-columns:1fr 1fr}.actions{padding:12px;justify-content:stretch}.actions button{flex:1}}@media print{body{background:#fff}.page{box-shadow:none;margin:0 auto;padding:10mm;max-width:none}.actions{display:none}.section,.callout,.result{break-inside:avoid}}
    </style></head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div><main class="page"><header class="top"><div class="eyebrow">DLS 6.0 · Match report</div><h1>${escapeHtml(matchTitle)}</h1><div class="sub">${escapeHtml(competition)} · ${escapeHtml(venue)} · ${escapeHtml(matchDate)}</div></header>
    <div class="meta"><div class="tile"><small>Captured by</small><strong>${escapeHtml(capturedBy)}</strong></div><div class="tile"><small>Match format</small><strong>${escapeHtml(currentInput.matchTypeLabel)}</strong></div><div class="tile"><small>Minimum overs per side</small><strong>${currentInput.minOversPerSide}</strong></div><div class="tile"><small>Overs at start</small><strong>${escapeHtml(formatOvers(currentInput.firstOvers))}</strong></div></div>
    <section class="section"><h2>First innings — ${escapeHtml(team1)}</h2><div class="stats"><div class="tile"><small>Final score</small><strong>${currentInput.firstRuns}</strong></div><div class="tile"><small>Scheduled overs</small><strong>${escapeHtml(formatOvers(currentInput.firstOvers))}</strong></div><div class="tile"><small>Overs lost</small><strong>${escapeHtml(prettyOvers(currentResult.firstResourcesLost))}</strong></div><div class="tile"><small>Overs available</small><strong>${escapeHtml(prettyOvers(currentResult.firstRemainingOvers))}</strong></div></div><h3>Interruption record</h3><table><thead><tr><th>#</th><th>Overs bowled</th><th>Score</th><th>Wickets</th><th>Overs lost</th></tr></thead><tbody>${firstTable}</tbody></table></section>
    <section class="section"><h2>Second innings — ${escapeHtml(team2)}</h2><div class="stats"><div class="tile"><small>Target</small><strong>${currentResult.target}</strong></div><div class="tile"><small>Final score</small><strong>${finalRuns}${wicketsLost == null ? '' : `/${wicketsLost}`}</strong></div><div class="tile"><small>Penalty runs awarded to ${escapeHtml(team1)} while ${escapeHtml(team2)} were batting</small><strong>${currentInput.penaltyRuns || 0}</strong></div><div class="tile"><small>Overs at finish</small><strong>${escapeHtml(finalOvers || 'Not entered')}</strong></div></div><p>Penalty runs awarded to ${escapeHtml(team1)} while ${escapeHtml(team2)} were batting are included in the DLS target. Overs allocated at start of chase: <strong>${escapeHtml(formatOvers(currentInput.secondOvers))}</strong>. Second-innings overs lost: <strong>${escapeHtml(prettyOvers(currentResult.secondResourcesLost))}</strong>. Revised chase length: <strong>${escapeHtml(currentResult.finalSecondOvers)}</strong>.</p><h3>Interruption record</h3><table><thead><tr><th>#</th><th>Overs bowled</th><th>Score</th><th>Wickets</th><th>Overs lost</th></tr></thead><tbody>${secondTable}</tbody></table></section>
    <div class="callout"><div>Revised DLS target</div><strong>${currentResult.target} runs</strong></div><div class="result"><strong>RESULT</strong><br>${escapeHtml(resultText)}</div>
    <footer class="foot">Generated locally by the private DLS 6.0 Umpire Calculator. This report is a user-generated calculation summary, not an ICC-issued or certified match report. Verify official match decisions against the authorised DLS application and applicable playing conditions.</footer></main></body></html>`;
}

$('createMatchReport').addEventListener('click', () => {
  try {
    const html = createReportHtml();
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      downloadBlob(`${safeFilename(currentInput?.matchName)}-dls-match-report.html`, html, 'text/html;charset=utf-8');
      $('reportAvailability').textContent = 'Popup blocked: the report HTML has been downloaded instead.';
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
  } catch (error) {
    $('reportAvailability').textContent = error?.message || 'Could not create the match report.';
  }
});

$('exportScenario').addEventListener('click', () => {
  try { downloadBlob(`${safeFilename(currentInput?.matchName)}.json`, JSON.stringify(scenarioDocument(), null, 2), 'application/json'); }
  catch (error) { $('saveMessage').textContent = error.message; }
});
$('exportCsv').addEventListener('click', () => {
  if (!currentResult) return;
  const rows = $('exportCsv').dataset.table === 'balls' ? currentResult.ballRows : currentResult.overRows;
  const header = ['Overs bowled', 'Overs remaining', ...Array.from({ length: 10 }, (_, i) => `${i} wickets`)];
  const lines = [header, ...rows.map(row => [row.oversBowled, row.oversRemaining, ...row.par])]
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','));
  downloadBlob(`${safeFilename(currentInput?.matchName)}-${$('exportCsv').dataset.table}-par-scores.csv`, lines.join('\r\n'), 'text/csv;charset=utf-8');
});

const STORAGE_KEY = 'dls60-umpire-saved-v1';
function getSaved() {
  try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(data) ? data : []; }
  catch { return []; }
}
function putSaved(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function renderSaved() {
  const container = $('savedList');
  container.replaceChildren();
  const saved = getSaved();
  if (!saved.length) {
    const empty = document.createElement('div'); empty.className = 'empty-events'; empty.textContent = 'No saved matches yet.'; container.appendChild(empty); return;
  }
  for (const item of saved) {
    const row = document.createElement('div'); row.className = 'saved-item';
    const info = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = item.input.matchName || 'Unnamed match';
    const detail = document.createElement('small');
    const capturer = item.input.capturerFirstName || item.input.capturerSurname ? `Captured by ${`${item.input.capturerFirstName || ''} ${item.input.capturerSurname || ''}`.trim()} · ` : 'Capturer name required · ';
    const uploadLabel = item.uploadStatus === 'uploaded' ? 'Uploaded' : item.uploadStatus === 'error' ? 'Upload failed — retry pending' : 'Pending upload';
    detail.textContent = `${capturer}${item.input.matchTypeLabel || item.input.matchType || 'Match'} · ${item.input.firstRuns} runs · ${item.summary.noResult ? 'No result' : `target ${item.summary.target}`} · ${uploadLabel} · ${new Date(item.savedAt).toLocaleString()}`;
    info.append(title, detail);
    const actions = document.createElement('div'); actions.className = 'saved-actions';
    const load = document.createElement('button'); load.className = 'button button-secondary'; load.type = 'button'; load.textContent = 'Load'; load.addEventListener('click', () => loadScenario(item.input));
    const remove = document.createElement('button'); remove.className = 'button button-quiet'; remove.type = 'button'; remove.textContent = 'Delete'; remove.addEventListener('click', () => { putSaved(getSaved().filter(x => x.id !== item.id)); renderSaved(); });
    actions.append(load, remove); row.append(info, actions); container.appendChild(row);
  }
}
// Development deployment: archive uploads deliberately disabled.
const UPLOAD_CONFIG = Object.freeze({ endpoint: '', accessCode: '' });
function getUploadConfig() { return UPLOAD_CONFIG; }
function updateUploadSummary(message = '') {
  const saved = getSaved();
  const pending = saved.filter(item => item.uploadStatus !== 'uploaded').length;
  const badge = $('uploadQueueBadge');
  if (badge) badge.textContent = `${pending} pending`;
  const status = $('uploadStatus');
  if (!status) return;
  if (message) status.textContent = message;
  else if (!getUploadConfig().endpoint) status.textContent = 'Archive upload is unavailable. Matches can still be saved locally.';
  else if (!pending) status.textContent = 'All saved matches have been uploaded.';
  else if (!navigator.onLine) status.textContent = `${pending} match(es) waiting for an internet connection.`;
  else status.textContent = `${pending} match(es) queued. They will upload automatically while online, or select Sync now.`;
}
async function uploadOneMatch(item, config) {
  const record = item.archiveRecord || archiveRecordFor(item);
  const response = await fetch(`${config.endpoint}/upload`, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.accessCode}` },
    body: JSON.stringify({ record })
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok || data.ok !== true) throw new Error(data.message || `Upload failed (HTTP ${response.status}).`);
  return data;
}
async function uploadPendingMatches({ automatic = false } = {}) {
  if (uploadInProgress) return;
  const config = getUploadConfig();
  if (!config.endpoint || !config.accessCode) {
    updateUploadSummary();
    return;
  }
  if (!navigator.onLine) {
    updateUploadSummary('Offline. Matches remain safely queued on this device.');
    return;
  }
  uploadInProgress = true;
  $('syncNow').disabled = true;
  const saved = getSaved();
  let uploaded = 0;
  let failed = 0;
  for (const item of saved) {
    if (item.uploadStatus === 'uploaded') continue;
    try {
      const result = await uploadOneMatch(item, config);
      item.uploadStatus = 'uploaded';
      item.uploadedAt = result.uploadedAt || new Date().toISOString();
      item.remotePath = result.path || '';
      item.remoteUrl = result.html_url || '';
      item.uploadError = '';
      uploaded++;
    } catch (error) {
      item.uploadStatus = 'error';
      item.uploadError = error?.message || 'Upload failed.';
      failed++;
    }
    putSaved(saved);
    renderSaved();
    updateUploadSummary(`Uploading matches… ${uploaded} uploaded, ${failed} failed.`);
  }
  uploadInProgress = false;
  $('syncNow').disabled = false;
  const pending = getSaved().filter(item => item.uploadStatus !== 'uploaded').length;
  if (!pending) updateUploadSummary(`Sync complete. ${uploaded} match(es) uploaded.`);
  else updateUploadSummary(`Sync finished. ${uploaded} uploaded; ${failed} failed. ${pending} remain pending.`);
  if (automatic && !uploaded && !failed) updateUploadSummary();
}
$('syncNow').addEventListener('click', () => uploadPendingMatches());

function inputFromUiRaw(input) {
  return {
    matchName: input.matchName || '',
    capturerFirstName: input.capturerFirstName || 'Name',
    capturerSurname: input.capturerSurname || 'Surname',
    capturedBy: input.capturedBy || `${input.capturerFirstName || 'Name'} ${input.capturerSurname || 'Surname'}`.trim(),
    matchType: input.matchType || 'odi',
    matchTypeLabel: input.matchTypeLabel || '',
    minOversPerSide: input.minOversPerSide ?? 20,
    autoSecondOvers: true,
    firstOvers: input.firstOvers,
    firstRuns: input.firstRuns,
    secondOvers: input.firstOvers,
    secondOversNotation: formatOvers(input.firstOvers),
    penaltyRuns: input.penaltyRuns || 0,
    firstEventRows: input.firstEventRows || [],
    secondEventRows: input.secondEventRows || []
  };
}
function loadScenario(input) {
  const matchType = input.matchType && (MATCH_TYPES[input.matchType] || input.matchType === 'custom') ? input.matchType : 'custom';
  suspendAutoCalculation = true;
  validationStarted = false;
  $('matchType').value = matchType;
  previousMatchType = $('matchType').value;
  applyMatchType(matchType, { presetOvers: false, preserveOtherMinimum: true });
  $('matchName').value = input.matchName || '';
  $('reportCapturerFirstName').value = input.capturerFirstName || 'Name';
  $('reportCapturerSurname').value = input.capturerSurname || 'Surname';
  $('firstOvers').value = input.firstOvers;
  $('firstRuns').value = input.firstRuns;
  $('minOversPerSide').value = input.minOversPerSide ?? (MATCH_TYPES[matchType]?.minOvers ?? '');
  $('autoSecondOvers').checked = true;
  $('secondOvers').value = String(input.firstOvers);
  $('penaltyRuns').value = input.penaltyRuns ?? 0;
  $('firstEvents').replaceChildren();
  $('secondEvents').replaceChildren();
  (input.firstEventRows || []).forEach(row => addEventRow('firstEvents', row));
  (input.secondEventRows || []).forEach(row => addEventRow('secondEvents', row));
  if (!$('firstEvents').children.length) addEventRow('firstEvents');
  if (!$('secondEvents').children.length) addEventRow('secondEvents');
  updateEmptyMessages();
  syncSecondOversFromFirst();
  suspendAutoCalculation = false;
  validationStarted = true;
  calculateAndDisplay({ scroll: true });
}function currentReportDetails() {
  return {
    finalRuns: $('secondFinalRuns').value.trim() === '' ? null : Number($('secondFinalRuns').value),
    finalWickets: $('secondFinalWickets').value.trim() === '' ? null : Number($('secondFinalWickets').value),
    finalOvers: $('secondFinalOvers').value.trim() || null,
    competition: $('reportCompetition').value.trim(),
    firstTeam: $('reportFirstTeam').value.trim(),
    secondTeam: $('reportSecondTeam').value.trim(),
    venue: $('reportVenue').value.trim(),
    matchDate: $('reportDate').value || null,
    capturerFirstName: $('reportCapturerFirstName').value.trim() || 'Name',
    capturerSurname: $('reportCapturerSurname').value.trim() || 'Surname',
    reportReady: getReportReadiness().eligible,
    reportOutcomeCode: getReportReadiness().code || null
  };
}
function archiveRecordFor(item) {
  return createMatchArchiveRecord({
    id: item.id,
    savedAt: item.savedAt,
    input: item.input,
    summary: item.summary,
    reportDetails: item.reportDetails || null,
    parScoreTables: item.parScoreTables || null
  });
}

$('saveScenario').addEventListener('click', () => {
  try {
    const doc = scenarioDocument();
    const saved = getSaved();
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const item = {
      id,
      savedAt: new Date().toISOString(),
      input: inputFromUiRaw(doc.input),
      summary: doc.resultSummary,
      reportDetails: currentReportDetails(),
      parScoreTables: { overByOver: currentResult.overRows, ballByBall: currentResult.ballRows },
      uploadStatus: 'pending'
    };
    item.archiveRecord = archiveRecordFor(item);
    saved.unshift(item);
    putSaved(saved.slice(0, 50));
    renderSaved();
    $('saveMessage').textContent = 'Match saved on this device and added to the upload queue.';
    updateUploadSummary();
    if (navigator.onLine && getUploadConfig().endpoint) uploadPendingMatches({ automatic: true });
  } catch (error) { $('saveMessage').textContent = error.message; }
});
$('clearSaved').addEventListener('click', () => {
  if (getSaved().length && confirm('Delete all saved matches from this device?')) { putSaved([]); renderSaved(); }
});
$('importScenario').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const input = data.input || data;
    if (!input || !input.firstOvers || !Array.isArray(input.firstEventRows || []) || !Array.isArray(input.secondEventRows || [])) throw new Error('This does not look like a DLS match export.');
    loadScenario(input);
    $('saveMessage').textContent = 'Match imported and recalculated on this device.';
  } catch (error) { $('saveMessage').textContent = `Import failed: ${error.message}`; }
  event.target.value = '';
});

renderSaved();
updateEmptyMessages();
if ($('reportDate')) $('reportDate').value = new Date().toLocaleDateString('en-CA');
clearControlErrors();
updateReportAvailability();
$('autoCalcStatus').textContent = 'Select a match type and enter the match details. Calculations update automatically.';
if (navigator.onLine) setTimeout(() => uploadPendingMatches({ automatic: true }), 900);



// Appendix A calculation worksheet. Inputs remain independent of the DLS calculator;
// switching tabs does not clear values. Derived cells are read-only and recalculate
// whenever any Appendix A input changes.
(() => {
  const fields = Object.fromEntries(
    Array.from(document.querySelectorAll('[data-calc]')).map(el => [el.dataset.calc, el])
  );
  const number = key => {
    const value = fields[key]?.value?.trim();
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const setNumber = (key, value, decimals = 0) => {
    const el = fields[key];
    if (!el) return;
    el.value = value == null || !Number.isFinite(value) ? '' :
      (decimals ? value.toFixed(decimals) : String(value));
  };
  const timeMinutes = key => {
    const value = fields[key]?.value;
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const setTime = (key, minutes) => {
    const el = fields[key];
    if (!el) return;
    if (minutes == null || !Number.isFinite(minutes)) { el.value = ''; return; }
    const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
    el.value = String(Math.floor(wrapped / 60)).padStart(2, '0') + ':' +
      String(wrapped % 60).padStart(2, '0');
  };
  const bowlingRestrictions = {"5":"2 × 2, 1 × 1","6":"3 × 2","7":"3 × 2, 1 × 1","8":"4 × 2","9":"4 × 2, 1 × 1","10":"5 × 2","11":"1 × 3, 4 × 2","12":"2 × 3, 3 × 2","13":"3 × 3, 2 × 2","14":"4 × 3, 1 × 2","15":"5 × 3","16":"1 × 4, 4 × 3","17":"2 × 4, 3 × 3","18":"3 × 4, 2 × 3","19":"4 × 4, 1 × 3","20":"5 × 4","21":"1 × 5, 4 × 4","22":"2 × 5, 3 × 4","23":"3 × 5, 2 × 4","24":"4 × 5, 1 × 4","25":"5 × 5","26":"1 × 6, 4 × 5","27":"2 × 6, 3 × 5","28":"3 × 6, 2 × 5","29":"4 × 6, 1 × 5","30":"5 × 6","31":"1 × 7, 4 × 6","32":"2 × 7, 3 × 6","33":"3 × 7, 2 × 6","34":"4 × 7, 1 × 6","35":"5 × 7","36":"1 × 8, 4 × 7","37":"2 × 8, 3 × 7","38":"3 × 8, 2 × 7","39":"4 × 8, 1 × 7","40":"5 × 8","41":"1 × 9, 4 × 8","42":"2 × 9, 3 × 8","43":"3 × 9, 2 × 8","44":"4 × 9, 1 × 8","45":"5 × 9","46":"1 × 10, 4 × 9","47":"2 × 10, 3 × 9","48":"3 × 10, 2 × 9","49":"4 × 10, 1 × 9","50":"5 × 10"};
  // Competition-specific Powerplay allocations. T20 fractional overs are
  // stored as balls and displayed in cricket notation (e.g. 1.3 = 1 over, 3 balls).
  const t20Powerplay1Balls = {
    5:9, 6:11, 7:13, 8:14, 9:16, 10:18, 11:20, 12:22,
    13:23, 14:25, 15:27, 16:29, 17:31, 18:32, 19:34, 20:36
  };
  const promotion45Powerplays = {
    20:[4,12,4],21:[4,13,4],22:[5,13,4],23:[5,14,4],24:[5,14,5],
    25:[5,15,5],26:[5,16,5],27:[6,16,5],28:[6,17,5],29:[6,17,6],
    30:[6,18,6],31:[6,19,6],32:[7,19,6],33:[7,20,6],34:[7,20,7],
    35:[7,21,7],36:[7,22,7],37:[8,22,7],38:[8,23,7],39:[8,23,8],
    40:[8,24,8],41:[8,25,8],42:[9,25,8],43:[9,26,8],44:[9,26,9],
    45:[9,27,9]
  };
  const mensPremierPowerplays = {
    20:[4,12,4],21:[4,13,4],22:[5,13,4],23:[5,14,4],24:[5,14,5],
    25:[5,15,5],26:[5,16,5],27:[6,16,5],28:[6,17,5],29:[6,17,6],
    30:[6,18,6],31:[6,19,6],32:[7,19,6],33:[7,20,6],34:[7,20,7],
    35:[7,21,7],36:[7,22,7],37:[8,22,7],38:[8,23,7],39:[8,23,8],
    40:[8,24,8],41:[8,25,8],42:[9,25,8],43:[9,26,8],44:[9,26,9],
    45:[9,27,9],46:[9,28,9],47:[10,28,9],48:[10,29,9],49:[10,29,10],
    50:[10,30,10]
  };
  const formatCricketOvers = balls => `${Math.floor(balls / 6)}.${balls % 6}`;
  const setPowerplay = (prefix, overs) => {
    const competition = competitionSelect?.value || '';
    const totalOvers = overs == null ? null : Math.trunc(overs);
    let values = null;
    let phases = 0;
    let description = 'Powerplay allocation not specified for this competition / innings length.';

    if (competition === 't20' || competition === 'womens-t20') {
      phases = 2;
      description = 'Powerplay allocation (PP1 + PP2)';
      if (totalOvers != null && t20Powerplay1Balls[totalOvers] != null) {
        const totalBalls = totalOvers * 6;
        const pp1Balls = t20Powerplay1Balls[totalOvers];
        values = [formatCricketOvers(pp1Balls), formatCricketOvers(totalBalls - pp1Balls), ''];
      }
    } else if (competition === 'womens-35') {
      description = 'No Powerplay applies';
    } else if (competition === 'promotion-45') {
      phases = 3;
      description = 'Powerplay allocation (PP1 + PP2 + PP3)';
      values = totalOvers == null ? null : promotion45Powerplays[totalOvers] || null;
    } else if (competition === 'mens-premier') {
      phases = 3;
      description = 'Powerplay allocation (PP1 + PP2 + PP3)';
      values = totalOvers == null ? null : mensPremierPowerplays[totalOvers] || null;
    }

    const row = fields[`${prefix}-pp1`]?.closest('tr');
    const label = row?.querySelector('[data-pp-label]');
    if (label) label.textContent = description;
    const keys = [`${prefix}-pp1`, `${prefix}-pp2`, `${prefix}-pp3`];
    keys.forEach((key, index) => {
      const field = fields[key];
      if (!field) return;
      field.value = values?.[index] == null ? '' : String(values[index]);
      field.hidden = index >= phases;
    });
    row?.querySelectorAll('[data-pp-plus]').forEach((separator, index) => {
      separator.hidden = index + 1 >= phases;
    });
  };
  // Display the lookup in the supplied order: bowlers × overs per bowler.
  const bowlingDescription = overs => {
    if (overs == null || !Number.isFinite(overs)) return '';
    const restriction = bowlingRestrictions[String(Math.trunc(overs))];
    if (!restriction) return 'Not specified';
    return restriction;
  };
  const setBowlingRestriction = (key, overs) => {
    const field = fields[key];
    if (field) field.value = bowlingDescription(overs);
  };
  const ceilOvers = value => Math.ceil(value - 1e-10);
  const ceilMinutes = value => Math.ceil(value - 1e-10);
  const competitionSelect = document.getElementById('overCalcCompetition');
  const timePerOverField = document.getElementById('timePerOver');
  const timePerOverHelp = document.getElementById('timePerOverHelp');
  const competitionRates = {
    't20': 4.25,
    'promotion-45': 3.75,
    'womens-35': 3.75,
    'womens-t20': 3.75,
    'mens-premier': 4.2
  };
  const selectedTimePerOver = () => {
    const value = Number(timePerOverField?.value);
    return timePerOverField?.value?.trim() && Number.isFinite(value) && value > 0 ? value : null;
  };
  const updateCompetitionGate = () => {
    const competition = competitionSelect?.value || '';
    const selected = !!competition;
    const customRate = Number(timePerOverField?.value);
    const ready = selected && (competition !== 'other' ||
      (timePerOverField?.value?.trim() && Number.isFinite(customRate) && customRate > 0));
    const gateHelp = document.getElementById('overCalcGateHelp');
    document.querySelectorAll('[data-calc]').forEach(field => {
      field.disabled = !ready;
    });
    const scenarioSourceField = document.getElementById('scenarioCessationSource');
    const scenarioEarliestField = document.getElementById('scenarioEarliestRestart');
    if (scenarioSourceField) scenarioSourceField.disabled = !ready;
    if (scenarioEarliestField) scenarioEarliestField.disabled = !ready;
    if (gateHelp) gateHelp.textContent = !selected
      ? 'Competition / match type selection is required before proceeding.'
      : ready
        ? 'Match type and time allowance confirmed. Worksheet inputs are now available.'
        : 'Enter a valid Time per Over above to unlock the worksheet.';
  };
  const updateCompetitionRate = () => {
    const competition = competitionSelect?.value || '';
    const isOther = competition === 'other';
    if (timePerOverField) {
      timePerOverField.readOnly = !isOther;
      if (Object.prototype.hasOwnProperty.call(competitionRates, competition)) {
        timePerOverField.value = String(competitionRates[competition]);
      } else {
        timePerOverField.value = '';
      }
      timePerOverField.placeholder = isOther ? 'Enter minutes per over' : 'Select a competition';
    }
    if (timePerOverHelp) {
      timePerOverHelp.textContent = isOther
        ? 'Enter the applicable time allowance in minutes per over. The worksheet unlocks once a valid value is entered.'
        : 'Automatically populated from the selected competition. Select Other to enter a value.';
    }
    updateCompetitionGate();
    update();
  };
  const update = () => {
    const timePerOver = selectedTimePerOver();
    // Table 1 — first-innings interruption.
    const a = number('a-a'), b = number('a-b'), c = number('a-c'), d = number('a-d'), e = number('a-e');
    const f = c == null || d == null || e == null ? null : c - (d + e);
    setNumber('a-f', f);
    const g = a == null || f == null ? null : a - f;
    setNumber('a-g', g);
    const h = g == null || timePerOver == null ? null : Number((g / timePerOver).toFixed(2));
    setNumber('a-h', h, 2);
    const i = h == null ? null : ceilOvers(h / 2);
    setNumber('a-i', i);
    setBowlingRestriction('a-bowler', i);
    setPowerplay('a', i);

    const j = timeMinutes('a-j'), m = number('a-m');
    const k = i == null || timePerOver == null ? null : ceilMinutes(i * timePerOver);
    setNumber('a-k', k);
    const l = j == null || k == null || b == null ? null : j + (k - b);
    setTime('a-l', l);
    const n = l == null || m == null ? null : l + m;
    setTime('a-n', n);
    const o = n == null || k == null ? null : n + k;
    setTime('a-o', o);

    // Table 2 — determine whether the first innings can resume.
    const p = timeMinutes('b-p'), q = timeMinutes('b-q');
    let r = null;
    if (p != null && q != null) r = ((q - p) + 1440) % 1440;
    setNumber('b-r', r);
    const s = r == null || timePerOver == null ? null : ceilOvers(r / timePerOver);
    setNumber('b-s', s);
    const t = number('b-t');
    const terminated = s != null && t != null && s <= t;
    const decision = fields['b-s']?.closest('tr');
    if (decision) decision.dataset.inningsDecision = s == null || t == null ? 'pending' : terminated ? 'terminated' : 'resume';
    document.querySelectorAll('[data-decision-option]').forEach(option => {
      option.classList.toggle('is-selected', s != null && t != null && option.dataset.decisionOption === (terminated ? 'terminated' : 'resume'));
    });

    // Table 3 — when Table 2 determines that the first innings is terminated.
    const a3 = terminated ? s : null;
    setNumber('c-a', a3);
    const b3 = a3 == null || timePerOver == null ? null : ceilMinutes(a3 * timePerOver);
    setNumber('c-b', b3);
    const c3 = timeMinutes('c-c');
    const d3 = c3 == null || b3 == null ? null : c3 + b3;
    setTime('c-d', d3);
    setBowlingRestriction('c-bowler', a3);
    setPowerplay('c', a3);

    // Table 4 — second-innings interruption.
    const da = timeMinutes('d-a'), db = timeMinutes('d-b'), dd = timeMinutes('d-d');
    const dc = da == null || db == null ? null : ((db - da) + 1440) % 1440;
    setNumber('d-c', dc);
    const restartField = fields['d-d'];
    const restartRow = restartField?.closest('tr');
    const restartError = document.getElementById('d-d-error');
    const invalidRestart = db != null && dd != null && dd < db;
    if (restartRow) restartRow.classList.toggle('is-invalid', invalidRestart);
    if (restartError) restartError.textContent = invalidRestart
      ? 'Restart time cannot be earlier than the interruption time. Correct D to continue Table 4.'
      : '';
    if (invalidRestart) {
      ['d-e','d-g','d-i','d-j','d-k'].forEach(key => setNumber(key, null));
      setTime('d-l', null);
      setBowlingRestriction('d-bowler', null);
      setPowerplay('d', null);
      updateScenarioTable();
      return;
    }
    const de = db == null || dd == null ? null : dd - db;
    setNumber('d-e', de);
    const df = number('d-f');
    const dg = de == null || df == null ? null : de - df;
    setNumber('d-g', dg);
    const dh = number('d-h');
    const di = dg == null || timePerOver == null ? null : Math.floor(dg / timePerOver + 1e-10);
    setNumber('d-i', di);
    const dj = dh == null || di == null ? null : dh - di;
    setNumber('d-j', dj);
    const dk = dj == null || timePerOver == null ? null : ceilMinutes(dj * timePerOver);
    setNumber('d-k', dk);
    const dl = dd == null || dk == null || dc == null ? null : dd + (dk - dc);
    setTime('d-l', dl);
    setBowlingRestriction('d-bowler', dj);
    setPowerplay('d', dj);
    updateScenarioTable();
  };
  if (competitionSelect) competitionSelect.addEventListener('change', updateCompetitionRate);
  if (timePerOverField) {
    timePerOverField.addEventListener('input', () => { updateCompetitionGate(); update(); });
    timePerOverField.addEventListener('change', () => { updateCompetitionGate(); update(); });
  }
  const scenarioSource = document.getElementById('scenarioCessationSource');
  const scenarioEarliest = document.getElementById('scenarioEarliestRestart');
  const scenarioSummary = document.getElementById('scenarioSummary');
  const scenarioRows = document.getElementById('scenarioRows');
  const formatScenarioTime = minutes => {
    const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return String(Math.floor(wrapped / 60)).padStart(2, '0') + ':' + String(wrapped % 60).padStart(2, '0');
  };
  const updateScenarioTable = () => {
    if (!scenarioSource || !scenarioEarliest || !scenarioRows || !scenarioSummary) return;
    const source = scenarioSource.value;
    const cessation = source ? timeMinutes(source) : null;
    const earliest = scenarioEarliest.value && /^\d{2}:\d{2}$/.test(scenarioEarliest.value)
      ? (() => { const [h,m] = scenarioEarliest.value.split(':').map(Number); return h * 60 + m; })()
      : null;
    const minimumOvers = Number(document.getElementById('minOversPerSide')?.value);
    const timePerOver = selectedTimePerOver();
    const missing = [];
    if (!source) missing.push('select the applicable cessation-time source');
    if (cessation == null) missing.push('complete the selected Appendix A cessation-time calculation');
    if (earliest == null) missing.push('enter the earliest proposed recommencement time');
    if (!Number.isInteger(minimumOvers) || minimumOvers < 1) missing.push('set a valid Minimum Overs per Side in Match Setup');
    if (timePerOver == null) missing.push('select a competition and valid Time per Over');
    if (missing.length) {
      scenarioSummary.textContent = 'To generate scenarios: ' + missing.join('; ') + '.';
      scenarioRows.innerHTML = '<tr><td colspan="4">Complete the scenario inputs to generate the table.</td></tr>';
      return;
    }
    let cessationTimeline = cessation;
    if (earliest > cessationTimeline) cessationTimeline += 1440;
    if (earliest >= cessationTimeline) {
      scenarioSummary.textContent = 'The proposed recommencement time must be before the selected cessation time.';
      scenarioRows.innerHTML = '<tr><td colspan="4">Check the recommencement and cessation times.</td></tr>';
      return;
    }
    const cutOff = cessationTimeline - minimumOvers * timePerOver;
    const finalWindowStart = cessationTimeline - 15;
    const scenarioTimes = [];
    for (let t = earliest; t < finalWindowStart; t += 15) scenarioTimes.push(t);
    if (finalWindowStart >= earliest) scenarioTimes.push(finalWindowStart);
    else scenarioTimes.push(earliest);
    for (let t = finalWindowStart + 5; t <= cessationTimeline; t += 5) {
      if (t > earliest) scenarioTimes.push(t);
    }
    if (!scenarioTimes.length || scenarioTimes[0] !== earliest) scenarioTimes.unshift(earliest);
    const uniqueTimes = [...new Set(scenarioTimes)].filter(t => t >= earliest && t <= cessationTimeline).sort((a,b) => a-b);
    const rows = uniqueTimes.map(restart => {
      const available = Math.max(0, cessationTimeline - restart);
      const overs = Math.floor(available / timePerOver + 1e-9);
      const achievable = restart <= cutOff + 1e-9 && overs >= minimumOvers;
      const outcome = achievable ? 'Minimum overs achievable' : 'Draw';
      return '<tr' + (achievable ? '' : ' class="scenario-draw"') + '><td>' + formatScenarioTime(restart) + '</td><td>' + available + ' min</td><td>' + overs + '</td><td>' + outcome + '</td></tr>';
    });
    scenarioSummary.textContent = 'Cessation: ' + formatScenarioTime(cessationTimeline) +
      ' · Minimum overs: ' + minimumOvers +
      ' · Minimum-overs cut-off: ' + formatScenarioTime(cutOff) +
      ' · Time per over: ' + timePerOver + ' min. ' +
      'The final 15 minutes are shown in 5-minute increments.';
    scenarioRows.innerHTML = rows.join('') || '<tr><td colspan="4">No recommencement scenarios fall within the selected period.</td></tr>';
  };
  if (scenarioSource) scenarioSource.addEventListener('change', updateScenarioTable);
  if (scenarioEarliest) scenarioEarliest.addEventListener('input', updateScenarioTable);
  const minimumOversField = document.getElementById('minOversPerSide');
  if (minimumOversField) minimumOversField.addEventListener('input', updateScenarioTable);
  const matchTypeField = document.getElementById('matchType');
  if (matchTypeField) matchTypeField.addEventListener('change', updateScenarioTable);
  const resetButton = document.getElementById('resetAppendixA');
  if (resetButton) resetButton.addEventListener('click', () => {
    document.querySelectorAll('[data-calc]').forEach(el => { el.value = ''; });
    if (competitionSelect) competitionSelect.value = '';
    if (scenarioSource) scenarioSource.value = '';
    if (scenarioEarliest) scenarioEarliest.value = '';
    updateCompetitionRate();
    updateScenarioTable();
  });
  document.querySelectorAll('[data-calc]').forEach(el => {
    el.addEventListener('input', update);
    el.addEventListener('change', update);
  });
  updateCompetitionRate();
})();

// Version 2.0 Development prototype: top-level application tab navigation.
const appTabButtons = Array.from(document.querySelectorAll('[data-app-tab]'));
const appTabPanels = appTabButtons.map(button => document.getElementById(button.getAttribute('aria-controls')));
function activateAppTab(name, moveFocus = false) {
  appTabButtons.forEach((button, index) => {
    const selected = button.dataset.appTab === name;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) button.focus();
    const panel = appTabPanels[index];
    if (panel) panel.hidden = !selected;
  });
}
appTabButtons.forEach((button, index) => {
  button.addEventListener('click', () => activateAppTab(button.dataset.appTab));
  button.addEventListener('keydown', event => {
    let next = null;
    if (event.key === 'ArrowRight') next = (index + 1) % appTabButtons.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + appTabButtons.length) % appTabButtons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = appTabButtons.length - 1;
    if (next !== null) {
      event.preventDefault();
      activateAppTab(appTabButtons[next].dataset.appTab, true);
    }
  });
});
