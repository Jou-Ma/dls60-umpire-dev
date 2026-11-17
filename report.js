import { parseOvers, oversToBalls } from './engine.js';

/**
 * Report readiness validates the recorded score and any penalty runs.
 * Second-innings penalty runs affect the match result only; they do not alter
 * the DLS target or the underlying resource calculation.
 */
export function evaluateReportReadiness({
  result,
  finalRunsRaw,
  wicketsRaw = '',
  oversRaw = '',
  secondInningsPenaltyRunsRaw = '0',
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

  const penaltyText = String(secondInningsPenaltyRunsRaw ?? '0').trim();
  const secondInningsPenaltyRuns = penaltyText === '' ? 0 : Number(penaltyText);
  if (!Number.isInteger(secondInningsPenaltyRuns) || secondInningsPenaltyRuns < 0 || secondInningsPenaltyRuns > 999) {
    return { eligible: false, code: 'invalid-penalty', message: 'Second-innings penalty runs must be a whole number from 0 to 999.' };
  }
  const effectiveFinalRuns = finalRuns + secondInningsPenaltyRuns;

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
  } else if (effectiveFinalRuns >= result.target) {
    code = 'target-achieved';
    message = `Report ready. The chasing team’s effective score is ${effectiveFinalRuns}${secondInningsPenaltyRuns ? ` (including ${secondInningsPenaltyRuns} penalty runs)` : ''}, achieving the revised target of ${result.target}.`;
  } else {
    const shortfall = result.target - effectiveFinalRuns;
    message = `Report ready. The revised target was not achieved; the effective score is ${shortfall} run${shortfall === 1 ? '' : 's'} below the target of ${result.target}.`;
    code = 'target-not-achieved';
  }

  return { eligible: true, code, message, finalRuns, effectiveFinalRuns, secondInningsPenaltyRuns, wicketsLost, finalOvers };
}

/** Build neutral, outcome-aware wording using the score plus second-innings penalty runs. */
export function describeReportOutcome({
  result,
  finalRuns,
  secondInningsPenaltyRuns = 0,
  wicketsLost = null,
  chasingTeam = 'Team B',
  defendingTeam = 'Team A'
}) {
  const effectiveRuns = Number(finalRuns) + Number(secondInningsPenaltyRuns || 0);
  const score = `${finalRuns}${wicketsLost == null ? '' : `/${wicketsLost}`}`;
  const penaltyNote = secondInningsPenaltyRuns
    ? ` · ${secondInningsPenaltyRuns} second-innings penalty runs (effective score ${effectiveRuns})`
    : '';

  if (result.noResult) {
    return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score}${penaltyNote} · No Result.`;
  }

  if (effectiveRuns >= result.target) {
    if (wicketsLost != null && wicketsLost < 10) {
      const wicketsRemaining = 10 - wicketsLost;
      return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score}${penaltyNote} · ${chasingTeam} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}.`;
    }
    return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score}${penaltyNote} · ${chasingTeam} won.`;
  }

  if (effectiveRuns === result.target - 1) {
    return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score}${penaltyNote} · Match tied.`;
  }

  const runsMargin = result.target - effectiveRuns - 1;
  return `DLS Target: ${result.target} · ${chasingTeam} Final Score: ${score}${penaltyNote} · ${defendingTeam} won by ${runsMargin} run${runsMargin === 1 ? '' : 's'}.`;
}
