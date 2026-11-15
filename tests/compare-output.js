import { calculateMatch, prepareEvents } from '../engine.js';
const input = {
  firstOvers: 50, firstRuns: 240, secondOvers: 40,
  firstEvents: prepareEvents([
    {oversBowled:'10.0',scoreAtEvent:'',wickets:'0',oversLost:'5.0'},
    {oversBowled:'30.0',scoreAtEvent:'',wickets:'3',oversLost:'5.0'}
  ],50,'1st'),
  secondEvents: prepareEvents([
    {oversBowled:'8.0',scoreAtEvent:'',wickets:'0',oversLost:'3.0'},
    {oversBowled:'24.0',scoreAtEvent:'',wickets:'3',oversLost:'4.0'}
  ],40,'2nd')
};
const r=calculateMatch(input);
console.log(`lambda=${r.lambda} adj=${r.adjustmentFactor} target=${r.target}`);
console.log('over table remaining -> wickets');
for(const row of r.overRows) console.log(`${row.oversRemaining.padStart(4)} | ${row.par.join(' ')}`);
console.log('BALL_ROWS');
for(const row of r.ballRows) console.log(`${row.ballsBowled}|${row.par.join(' ')}`);
