/*
 * DLS 6.0 model port – private validation build.
 * Ported from the user-supplied DLS60.jar bytecode.
 * Not approved for redistribution; verify licensing before sharing the engine.
 */
const MODEL = Object.freeze({
  bb: 0.0365,
  g50: 251.25,
  lmbcap: 9.9999,
  lmbcap1: 2.9999,
  lmb350: 1.0526,
  lmb450: 1.1115,
  lmb600: 1.2294,
  scap: 1639.9,
  step: 0.0001,
  lmbdastar: 1.0,
  p350: [2.33, 62, 110, 150, 185, 217, 247, 275, 301, 326, 350],
  p450: [2.56, 70, 127, 175, 221, 263, 303, 341, 378, 414, 450],
  p600: [2.97, 83, 153, 216, 275, 332, 387, 441, 494, 547, 600],
  pw11: [0, .1275, .1325, .135, .1325, .1225, .1075, .09, .0725, .0575]
});

function roundJava(x) {
  // java.lang.Math.round(double): NaN maps to 0; finite values use floor(x + 0.5).
  if (Number.isNaN(x)) return 0;
  if (x === Infinity) return Number.MAX_SAFE_INTEGER;
  if (x === -Infinity) return Number.MIN_SAFE_INTEGER;
  return Math.floor(x + 0.5);
}
function nearZero(x) { return Math.abs(x) < 1e-12; }

export function parseOvers(value, label = 'Overs') {
  const s = String(value ?? '').trim();
  if (!s) throw new Error(`${label} is required.`);
  const m = /^(\d+)(?:\.(\d))?$/.exec(s);
  if (!m) throw new Error(`${label} must use cricket notation, for example 17.3.`);
  const whole = Number(m[1]);
  const balls = m[2] == null ? 0 : Number(m[2]);
  if (balls > 5) throw new Error(`${label}: the balls digit must be between 0 and 5.`);
  return whole + balls / 6;
}

export function oversToBalls(overs) {
  return roundJava(overs * 6);
}

export function ballsToOvers(balls) {
  const whole = Math.floor(balls / 6);
  const rem = balls % 6;
  return `${whole}.${rem}`;
}

/** Return the second-innings allocation after the first-innings event losses. */
export function deriveSecondOvers(firstOvers, firstEvents) {
  const scheduledBalls = oversToBalls(firstOvers);
  const lostBalls = (firstEvents || []).reduce((sum, event) => sum + oversToBalls(event.oversLost), 0);
  return ballsToOvers(Math.max(0, scheduledBalls - lostBalls));
}

function setupWicketArrays() {
  const a = Array(11).fill(0);
  for (let i = 0; i < 10; i++) a[10] = a[10] + (i === 0 ? 0 : MODEL.pw11[i]);
  a[10] = roundJava((1 - a[10]) * 1000) / 1000;
  const Fw = Array(10).fill(0);
  const nw = Array(10).fill(0);
  Fw[0] = 1;
  nw[0] = 10;
  for (let i = 1; i < 10; i++) {
    Fw[i] = Fw[i - 1] - MODEL.pw11[i];
    nw[i] = nw[0] * Fw[i];
  }
  return { Fw, nw };
}
const WICKETS = setupWicketArrays();

function poly1(x) { return 1.22 - 0.01579 * x + 2.328e-4 * x * x; }
function poly2(x) { return 1.27 - 0.01571 * x + 2.113e-4 * x * x; }
function poly3(x) { return 1.33 - 0.01644 * x + 2.028e-4 * x * x; }

function gufun(overs, lambda) {
  if (!(overs > 0 && lambda > 1)) return 1;
  let n, d;
  if (lambda < MODEL.lmb350) {
    const w1 = (MODEL.lmb350 - lambda) / (MODEL.lmb350 - 1);
    const w2 = (lambda - 1) / (MODEL.lmb350 - 1);
    n = poly1(overs) * w1 + poly2(overs) * w2;
    d = poly1(50) * w1 + poly2(50) * w2;
  } else if (lambda < MODEL.lmb450) {
    const w1 = (MODEL.lmb450 - lambda) / (MODEL.lmb450 - MODEL.lmb350);
    const w2 = (lambda - MODEL.lmb350) / (MODEL.lmb450 - MODEL.lmb350);
    n = poly1(overs) * w1 + poly2(overs) * w2;
    d = poly1(50) * w1 + poly2(50) * w2;
  } else if (lambda < MODEL.lmb600) {
    const w1 = (MODEL.lmb600 - lambda) / (MODEL.lmb600 - MODEL.lmb450);
    const w2 = (lambda - MODEL.lmb450) / (MODEL.lmb600 - MODEL.lmb450);
    n = poly2(overs) * w1 + poly3(overs) * w2;
    d = poly2(50) * w1 + poly3(50) * w2;
  } else if (lambda < MODEL.lmbcap1) {
    const w1 = (MODEL.lmbcap1 - lambda) / (MODEL.lmbcap1 - MODEL.lmb600);
    const w2 = (lambda - MODEL.lmb600) / (MODEL.lmbcap1 - MODEL.lmb600);
    n = poly3(overs) * w1 + w2;
    d = poly3(50) * w1 + w2;
  } else {
    return 1;
  }
  return n / d;
}

function Gfun(overs, lambda, wickets) {
  const { Fw, nw } = WICKETS;
  const f = Fw[wickets];
  const n = nw[wickets];
  let used = overs;
  if (wickets === 9 && overs > 5) used = 5;
  else if (wickets === 8 && overs >= 12 && overs < 18) used = 11.833333333333334;

  const whole = Math.floor(used);
  const balls = roundJava(6 * (used - whole));
  const totalBalls = whole * 6 + balls;
  const q = totalBalls === 1 ? 1 : Math.ceil(used / 5) + 1;

  const z0 = MODEL.g50 / (1 - Math.exp(-50 * MODEL.bb));
  const h18 = z0 * (1 - Math.exp(-((q - 1) * 5) * MODEL.bb));
  const h20 = z0 * (1 - Math.exp(-used * MODEL.bb));
  const h22 = q > 2
    ? z0 * (1 - Math.exp(-((q - 2) * 5) * MODEL.bb))
    : z0 * (1 - Math.exp((-1 / 6) * MODEL.bb));
  const frac = q > 1 ? (h20 - h22) / (h18 - h22) : 1;

  const h12 = z0 * f * Math.pow(lambda, n + 1) * (1 - Math.exp(-overs * MODEL.bb * gufun(overs, lambda) / (f * Math.pow(lambda, n))));
  const h26 = z0 * Math.pow(lambda, nw[0] + 1) * (1 - Math.exp(-50 * MODEL.bb / Math.pow(lambda, nw[0])));
  const h28 = f * (1 - Math.exp(-used * MODEL.bb / f)) / (1 - Math.exp(-used * MODEL.bb));
  const h30 = z0 * Math.pow(MODEL.lmb350, nw[0] + 1) * (1 - Math.exp(-50 * MODEL.bb / Math.pow(MODEL.lmb350, nw[0])));
  const h32 = z0 * Math.pow(MODEL.lmb450, nw[0] + 1) * (1 - Math.exp(-50 * MODEL.bb / Math.pow(MODEL.lmb450, nw[0])));
  const h34 = z0 * Math.pow(MODEL.lmb600, nw[0] + 1) * (1 - Math.exp(-50 * MODEL.bb / Math.pow(MODEL.lmb600, nw[0])));
  const h36 = z0 * (1 - Math.exp(-used * MODEL.bb));

  let p350, p450, p600;
  if (q === 1) {
    p350 = MODEL.p350[0]; p450 = MODEL.p450[0]; p600 = MODEL.p600[0];
  } else if (q < 12) {
    p350 = MODEL.p350[q - 1] * frac + MODEL.p350[q - 2] * (1 - frac);
    p450 = MODEL.p450[q - 1] * frac + MODEL.p450[q - 2] * (1 - frac);
    p600 = MODEL.p600[q - 1] * frac + MODEL.p600[q - 2] * (1 - frac);
  } else {
    p350 = MODEL.p350[10] + (MODEL.p350[10] - MODEL.p350[9]) / 5 * (used - 50);
    p450 = MODEL.p450[10] + (MODEL.p450[10] - MODEL.p450[9]) / 5 * (used - 50);
    p600 = MODEL.p600[10] + (MODEL.p600[10] - MODEL.p600[9]) / 5 * (used - 50);
  }
  let cap = MODEL.scap * used / 50;
  p350 = Math.max(p350, h36);
  p450 = Math.max(p450, p350);
  p600 = Math.max(p600, p450);
  cap = Math.max(cap, p600);

  let h46;
  if (overs > 0 && lambda > 1) {
    if (lambda < MODEL.lmb350) {
      h46 = (h36 * (h30 - h26) / (h30 - MODEL.g50)
        + p350 * (h26 - MODEL.g50) / (h30 - MODEL.g50)) * h28;
    } else if (lambda < MODEL.lmb450) {
      h46 = (p350 * (h32 - h26) / (h32 - h30)
        + p450 * (h26 - h30) / (h32 - h30)) * h28;
    } else if (lambda < MODEL.lmb600) {
      h46 = (p450 * (h34 - h26) / (h34 - h32)
        + p600 * (h26 - h32) / (h34 - h32)) * h28;
    } else if (lambda < MODEL.lmbcap1) {
      h46 = (p600 * (MODEL.scap - h26) / (MODEL.scap - h34)
        + cap * (h26 - h34) / (MODEL.scap - h34)) * h28;
    } else {
      h46 = h26 * used / 50 * h28;
    }
  } else {
    h46 = h12;
  }
  return h46 / h12;
}

function resourceRun(overs, lambda, wickets) {
  const { Fw, nw } = WICKETS;
  const f = Fw[wickets];
  const n = nw[wickets];
  return MODEL.g50 / (1 - Math.exp(-50 * MODEL.bb))
    * Gfun(overs, lambda, wickets)
    * f * Math.pow(lambda, n + 1)
    * (1 - Math.exp(-overs * MODEL.bb * gufun(overs, lambda) / (f * Math.pow(lambda, n))));
}

function eventSegment(overs, lambda, wickets) {
  // A zero-over resource segment contributes zero resources. Without this
  // guard Gfun(0, ...) evaluates a 0/0 ratio and contaminates lambda/adjustment.
  if (overs <= 0) return 0;
  return MODEL.g50 / (1 - Math.exp(-50 * MODEL.bb))
    * Gfun(overs, lambda, wickets)
    * WICKETS.Fw[wickets] * Math.pow(lambda, WICKETS.nw[wickets] + 1)
    * (1 - Math.exp(-overs * MODEL.bb * gufun(overs, lambda)
      / (WICKETS.Fw[wickets] * Math.pow(lambda, WICKETS.nw[wickets]))));
}

function firstInningsResidual(totalOvers, score, events, lambda) {
  let estimated = eventSegment(totalOvers, lambda, 0);
  let allocated = totalOvers;
  for (const event of events) {
    if (event.wickets >= 10) continue;
    const remainingBefore = allocated - event.oversBowled;
    estimated -= eventSegment(remainingBefore, lambda, event.wickets);
    const remainingAfter = remainingBefore - event.oversLost;
    allocated -= event.oversLost;
    estimated += eventSegment(remainingAfter, lambda, event.wickets);
  }
  return estimated - score;
}

function fitLambda(totalOvers, score, events) {
  let lambda = MODEL.lmbdastar;
  let residual = firstInningsResidual(totalOvers, score, events, lambda);
  if (residual < 0) {
    while (residual < 0 && lambda < MODEL.lmbcap) {
      lambda += MODEL.step;
      const previousResidual = residual;
      residual = firstInningsResidual(totalOvers, score, events, lambda);
      // The Java implementation compares the two residuals only once the
      // search crosses zero or reaches the lambda cap.
      if (!(residual < 0 && lambda < MODEL.lmbcap)) {
        if (Math.abs(residual) >= Math.abs(previousResidual)) lambda -= MODEL.step;
        break;
      }
    }
  }
  return roundJava(lambda * 10000) / 10000;
}

function adjustmentFactor(totalOvers, score, events, lambda) {
  let modelled = eventSegment(totalOvers, lambda, 0);
  let allocated = totalOvers;
  for (const event of events) {
    if (event.wickets >= 10) continue;
    const remainingBefore = allocated - event.oversBowled;
    modelled -= eventSegment(remainingBefore, lambda, event.wickets);
    const remainingAfter = remainingBefore - event.oversLost;
    allocated -= event.oversLost;
    modelled += eventSegment(remainingAfter, lambda, event.wickets);
  }
  return (score === 0 ? 1 : score) / modelled;
}

function calculateTarget(firstOvers, firstRuns, firstEvents, secondOvers, secondEvents, penaltyRuns, lambda, adj) {
  let target = roundJava(adj * eventSegment(secondOvers, lambda, 0));
  let allocated = secondOvers;
  for (const event of secondEvents) {
    if (event.wickets >= 10) continue;
    const remainingBefore = allocated - event.oversBowled;
    target -= roundJava(adj * eventSegment(remainingBefore, lambda, event.wickets));
    const remainingAfter = remainingBefore - event.oversLost;
    allocated -= event.oversLost;
    target += roundJava(adj * eventSegment(remainingAfter, lambda, event.wickets));
  }
  if (firstRuns === 0 && target > 0) target -= 1;
  return target + 1 + penaltyRuns;
}

function parScore(oversRemaining, wickets, target, firstRuns, lambda, adj) {
  let score = target - 1 - roundJava(adj * eventSegment(oversRemaining, lambda, wickets));
  if (firstRuns === 0 && score < 0) score = 0;
  return score;
}

function validateEvents(events, scheduledOvers, label) {
  if (events.length > 29) throw new Error(`${label}: maximum 29 interruption events.`);
  let previousOver = -1;
  let previousLoss = 0;
  let previousWickets = 0;
  let previousRuns = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!Number.isFinite(e.oversBowled) || e.oversBowled < 0 || e.oversBowled > scheduledOvers) {
      throw new Error(`${label} interruption ${i + 1}: overs bowled is outside the innings.`);
    }
    if (e.oversBowled < previousOver) throw new Error(`${label} interruptions must be entered chronologically.`);
    if (!Number.isInteger(e.wickets) || e.wickets < previousWickets || e.wickets > 10) throw new Error(`${label} interruption ${i + 1}: wickets must be ${previousWickets}–10 and cannot decrease.`);
    if (e.scoreAtEvent != null) {
      if (!Number.isInteger(e.scoreAtEvent) || e.scoreAtEvent < previousRuns) throw new Error(`${label} interruption ${i + 1}: score must be a whole number and cannot decrease.`);
      previousRuns = e.scoreAtEvent;
    }
    if (!Number.isFinite(e.oversLost) || e.oversLost < 0) throw new Error(`${label} interruption ${i + 1}: overs lost must be zero or greater.`);
    const availableAtEvent = scheduledOvers - e.oversBowled - previousLoss;
    if (e.oversLost > availableAtEvent + 1e-8) throw new Error(`${label} interruption ${i + 1}: overs lost exceeds the remaining allocation.`);
    previousOver = e.oversBowled;
    previousLoss += e.oversLost;
    previousWickets = e.wickets;
  }
}


/** Convert UI interruption rows to the numeric event records used by the model.
 * oversLost accepts cricket overs notation or A/a for all remaining overs.
 */
export function prepareEvents(rows, scheduledOvers, label = 'Innings') {
  let previousLoss = 0;
  return rows.filter(r => !r._deleted).map((r, index) => {
    const oversBowled = parseOvers(r.oversBowled, `${label} interruption ${index + 1} overs bowled`);
    const lossText = String(r.oversLost ?? '').trim();
    let oversLost;
    if (/^a$/i.test(lossText)) {
      oversLost = Math.max(0, scheduledOvers - oversBowled - previousLoss);
    } else {
      oversLost = parseOvers(lossText, `${label} interruption ${index + 1} overs lost`);
    }
    previousLoss += oversLost;
    const wickets = Number(r.wickets);
    const scoreAtEvent = r.scoreAtEvent === '' || r.scoreAtEvent == null ? null : Number(r.scoreAtEvent);
    return { oversBowled, wickets, oversLost, scoreAtEvent };
  });
}

export function calculateMatch(input) {
  const firstOvers = Number(input.firstOvers);
  const firstRuns = Number(input.firstRuns);
  const secondOvers = Number(input.secondOvers);
  const penaltyRuns = Number(input.penaltyRuns || 0);
  const firstEvents = input.firstEvents || [];
  const secondEvents = input.secondEvents || [];
  if (!(Number.isInteger(firstOvers) && firstOvers > 0 && firstOvers <= 100)) throw new Error('First-innings overs must be a whole number from 1 to 100.');
  if (!(Number.isFinite(secondOvers) && secondOvers > 0 && secondOvers <= 100)) throw new Error('Second-innings overs must be greater than 0 and no more than 100 overs. Use cricket notation for partial overs.');
  if (!(Number.isInteger(firstRuns) && firstRuns >= 0)) throw new Error('First-innings runs must be a whole number of 0 or more.');
  if (!(Number.isInteger(penaltyRuns) && penaltyRuns >= 0)) throw new Error('Penalty runs must be a whole number of 0 or more.');
  validateEvents(firstEvents, firstOvers, 'First innings');
  validateEvents(secondEvents, secondOvers, 'Second innings');

  const lambda = fitLambda(firstOvers, firstRuns, firstEvents);
  const adj = adjustmentFactor(firstOvers, firstRuns, firstEvents, lambda);
  const target = calculateTarget(firstOvers, firstRuns, firstEvents, secondOvers, secondEvents, penaltyRuns, lambda, adj);
  const finalSecondOvers = Math.max(0, secondOvers - secondEvents.reduce((s, e) => s + e.oversLost, 0));
  const minOversPerSide = input.minOversPerSide == null ? null : Number(input.minOversPerSide);
  if (minOversPerSide != null && (!Number.isInteger(minOversPerSide) || minOversPerSide < 1 || minOversPerSide > 99)) {
    throw new Error('Minimum overs per side must be a whole number between 1 and 99.');
  }
  const firstRemainingOvers = Math.max(0, firstOvers - firstEvents.reduce((s, e) => s + e.oversLost, 0));
  const firstRemainingBalls = oversToBalls(firstRemainingOvers);
  const finalSecondBalls = oversToBalls(finalSecondOvers);
  const minimumFailedSides = [];
  if (minOversPerSide != null) {
    if (firstRemainingBalls < minOversPerSide * 6) {
      minimumFailedSides.push(`first innings: ${ballsToOvers(firstRemainingBalls)} overs available`);
    }
    if (finalSecondBalls < minOversPerSide * 6) {
      minimumFailedSides.push(`second innings: ${ballsToOvers(finalSecondBalls)} overs available`);
    }
  }
  const noResult = minimumFailedSides.length > 0;
  const noResultReason = noResult
    ? `${minimumFailedSides.join('; ')}; the minimum is ${minOversPerSide} overs per side.`
    : null;

  // Match the original DLS 6.0 second-innings par-table sequence.
  // The table is generated from the final total overs available (after all
  // second-innings losses) and starts at the latest second-innings stoppage.
  // In the original JAR: olft2 = total overs available - overs bowled at the
  // latest stoppage. The displayed rows then run from that stoppage to the
  // revised innings limit.
  const latestStoppageBalls = secondEvents.length
    ? oversToBalls(secondEvents[secondEvents.length - 1].oversBowled)
    : 0;
  const remainingAtLatestStoppageBalls = finalSecondBalls - latestStoppageBalls;
  const latestStoppageWickets = secondEvents.length
    ? secondEvents[secondEvents.length - 1].wickets
    : 0;
  const makeParCells = (remainingBalls) => {
    const remaining = remainingBalls / 6;
    return Array.from({ length: 10 }, (_, wickets) =>
      wickets < latestStoppageWickets
        ? '--'
        : parScore(remaining, wickets, target, firstRuns, lambda, adj)
    );
  };

  const overRows = [];
  if (remainingAtLatestStoppageBalls >= 0) {
    // The JAR's over table iterates whole-over remaining values. If a stoppage
    // occurs part-way through an over, the first over-table row is the next
    // whole-over position.
    const maxWholeOversRemaining = Math.floor(remainingAtLatestStoppageBalls / 6);
    for (let wholeOversRemaining = maxWholeOversRemaining; wholeOversRemaining >= 0; wholeOversRemaining--) {
      const remainingBalls = wholeOversRemaining * 6;
      const ballsBowled = finalSecondBalls - remainingBalls;
      overRows.push({
        ballsBowled,
        oversBowled: ballsToOvers(ballsBowled),
        oversRemaining: ballsToOvers(remainingBalls),
        par: makeParCells(remainingBalls)
      });
    }
  }

  const ballRows = [];
  if (remainingAtLatestStoppageBalls >= 0) {
    // The ball-by-ball table starts at the exact ball position of the latest
    // stoppage and then includes each remaining ball through the revised limit.
    for (let remainingBalls = remainingAtLatestStoppageBalls; remainingBalls >= 0; remainingBalls--) {
      const ballsBowled = finalSecondBalls - remainingBalls;
      ballRows.push({
        ballsBowled,
        oversBowled: ballsToOvers(ballsBowled),
        oversRemaining: ballsToOvers(remainingBalls),
        par: makeParCells(remainingBalls)
      });
    }
  }

  return {
    lambda, adjustmentFactor: adj, target, targetLabel: `Target ${target}`,
    finalSecondOvers: ballsToOvers(oversToBalls(finalSecondOvers)), overRows, ballRows,
    minOversPerSide, noResult, noResultReason,
    firstResourcesLost: firstEvents.reduce((s, e) => s + e.oversLost, 0),
    secondResourcesLost: secondEvents.reduce((s, e) => s + e.oversLost, 0),
    firstEvents, secondEvents,
    firstRemainingOvers,
    secondRemainingOvers: finalSecondOvers,
    model: 'DLS 6.0 bytecode port – validation build'
  };
}

export const __test = { WICKETS, gufun, Gfun, eventSegment, fitLambda, adjustmentFactor, calculateTarget, parScore, MODEL };
