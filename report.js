import { parseOvers, oversToBalls } from './engine.js';

/** Report readiness validates the chasing side's recorded final score. */
export function evaluateReportReadiness({
  result,
  finalRunsRaw,
  wicketsRaw = '',
  oversRaw = '',
  secondEvents = []
}) {
  if (!result) {
    return { eligible: false, code: 'no-calculation', message: 'Calculate the DLS match first.' };
  }

  const runsText = String(finalRunsRaw ?? '').trim();
  if (!runsText) {
    return { eligible: false, code: 'missing-score', message: 'Enter the chasing team’s final score to make the report available.' };
  }
  const finalRuns = Number(runsText);
  if (!Number.isInteger(finalRuns) || finalRuns < 0 || finalRuns > 999) {
    return { eligible: false, code: 'invalid-score', message: 'Final runs must be a whole number from 0 to 999.' };
  }

  const wicketsText = String(wicketsRaw ?? '').trim();
  const wicketsLost = wicketsText === '' ? null : Number(wicketsText);
  if (wicketsLost != null && (!Number.isInteger(wicketsLost) || wicketsLost < 0 || wicketsLost > 10)) {
    return { eligible: false, code: 'invalid-wickets', message: 'Wickets lost must be a whole number from 0 to 10.' };
  }

  const events = Array.isArray(secondEvents) ? secondEvents : [];
  for (const event of events) {
    if (event.scoreAtEvent != null && Number(event.scoreAtEvent) > finalRuns) {
      return { eligible: false, code: 'score-before-event', message: 'Final runs cannot be lower than a score already recorded at a second-innings interruption.' };
    }
    if (wicketsLost != null && Number(event.wickets) > wicketsLost) {
      return { eligible: false, code: 'wickets-before-event', message: 'Wickets lost at finish cannot be lower than the wickets already lost at a second-innings interruption.' };
    }
  }

  const oversText = String(oversRaw ?? '').trim();
  let finalOvers = null;
  if (oversText) {
    try {
      finalOvers = parseOvers(oversText, 'Chasing innings overs at finish');
    } catch (error) {
      return { eligible: false, code: 'invalid-overs', message: error.message };
    }
    const finalBalls = oversToBalls(finalOvers);
    const allocationBalls = oversToBalls(Number(result.finalSecondOvers));
    if (finalBalls > allocationBalls) {
      return { eligible: false, code: 'overs-over-allocation', message: 'Overs at finish cannot exceed the revised chase length.' };
    }
    const latestStoppageBalls = events.reduce((max, event) => Math.max(max, oversToBalls(Number(event.oversBowled))), 0);
    if (finalBalls < latestStoppageBalls) {
      return { eligible: false, code: 'overs-before-event', message: 'Overs at finish cannot be earlier than the latest second-innings interruption.' };
    }
  }

  let code;
  let message;
  if (result.noResult) {
    code = 'no-result';
    message = `Report ready. The match is classified NO RESULT: ${result.noResultReason || 'minimum overs requirement not met'}.`;
  } else if (finalRuns >= result.target) {
    code = 'target-achieved';
    message = `Report ready. The chasing team achieved the revised target of ${result.target}.`;
  } else {
    const shortfall = result.target - finalRuns;
    message = `Report ready. The revised target was not achieved; the score is ${shortfall} run${shortfall === 1 ? '' : 's'} below the target of ${result.target}.`;
    code = 'target-not-achieved';
  }

  return { eligible: true, code, message, finalRuns, wicketsLost, finalOvers };
}

/** Build neutral, outcome-aware wording using the recorded final score. */
export function describeReportOutcome({
  result,
  finalRuns,
  wicketsLost = null,
  chasingTeam = 'Team B',
  defendingTeam = 'Team A'
}) {
  const score = `${finalRuns}${wicketsLost == null ? '' : `/${wicketsLost}`}`;

  if (result.noResult) {
    return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score} · No Result.`;
  }

  if (finalRuns >= result.target) {
    if (wicketsLost != null && wicketsLost < 10) {
      const wicketsRemaining = 10 - wicketsLost;
      return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score} · ${chasingTeam} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}.`;
    }
    return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score} · ${chasingTeam} won.`;
  }

  if (finalRuns === result.target - 1) {
    return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score} · Match tied.`;
  }

  const runsMargin = result.target - finalRuns - 1;
  return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score} · ${defendingTeam} won by ${runsMargin} run${runsMargin === 1 ? '' : 's'}.`;
}
