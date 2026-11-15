import assert from 'node:assert/strict';
import { calculateMatch, parseOvers, prepareEvents, deriveSecondOvers, __test } from '../engine.js';

assert.equal(parseOvers('17.3'), 17.5);
assert.equal(parseOvers('48.3'), 48.5);
assert.equal(parseOvers('12.5'), 12 + 5/6);
assert.throws(() => parseOvers('17.6'));

const cases = [
  { name:'base100', in:{firstOvers:50,firstRuns:100,secondOvers:50}, lambda:1.0000, adj:0.398009950249, target:101 },
  { name:'base350', in:{firstOvers:50,firstRuns:350,secondOvers:50}, lambda:1.0526, adj:1, target:351 },
  { name:'base400', in:{firstOvers:50,firstRuns:400,secondOvers:50}, lambda:1.0809, adj:0.999822956055, target:401 },
  { name:'base450', in:{firstOvers:50,firstRuns:450,secondOvers:50}, lambda:1.1115, adj:1, target:451 },
  { name:'base500', in:{firstOvers:50,firstRuns:500,secondOvers:50}, lambda:1.1456, adj:1.000028038190, target:501 },
  { name:'base550', in:{firstOvers:50,firstRuns:550,secondOvers:50}, lambda:1.1844, adj:1.000086800930, target:551 },
  { name:'one-event-each', in:{firstOvers:50,firstRuns:320,secondOvers:46,firstEvents:[{oversBowled:12,wickets:1,oversLost:4}],secondEvents:[{oversBowled:10,wickets:1,oversLost:4}]}, lambda:1.0456, adj:1.000081218373, target:303 },
  { name:'three-event-each', in:{firstOvers:50,firstRuns:360,secondOvers:40,firstEvents:[{oversBowled:8,wickets:0,oversLost:3},{oversBowled:22,wickets:2,oversLost:4},{oversBowled:37,wickets:5,oversLost:3}],secondEvents:[{oversBowled:7,wickets:1,oversLost:2},{oversBowled:17,wickets:3,oversLost:4},{oversBowled:30,wickets:6,oversLost:3}]}, lambda:1.1009, adj:0.999932536048, target:299 },
  { name:'three-event-each-penalty', in:{firstOvers:50,firstRuns:360,secondOvers:40,penaltyRuns:5,firstEvents:[{oversBowled:8,wickets:0,oversLost:3},{oversBowled:22,wickets:2,oversLost:4},{oversBowled:37,wickets:5,oversLost:3}],secondEvents:[{oversBowled:7,wickets:1,oversLost:2},{oversBowled:17,wickets:3,oversLost:4},{oversBowled:30,wickets:6,oversLost:3}]}, lambda:1.1009, adj:0.999932536048, target:304 },
  { name:'two-event-each', in:{firstOvers:50,firstRuns:240,secondOvers:40,firstEvents:[{oversBowled:10,wickets:0,oversLost:5},{oversBowled:30,wickets:3,oversLost:5}],secondEvents:[{oversBowled:8,wickets:0,oversLost:3},{oversBowled:24,wickets:3,oversLost:4}]}, lambda:1.0179, adj:1.0002034520891927, target:218 }
];
for (const c of cases) {
  const r=calculateMatch(c.in);
  assert.equal(r.lambda,c.lambda,`${c.name} lambda`);
  assert.ok(Math.abs(r.adjustmentFactor-c.adj)<1e-10,`${c.name} adjustment ${r.adjustmentFactor}`);
  assert.equal(r.target,c.target,`${c.name} target`);
}
const base=calculateMatch({firstOvers:50,firstRuns:300,secondOvers:50});
assert.equal(base.lambda,1.0258);
assert.ok(Math.abs(base.adjustmentFactor-0.9997167216012829)<1e-12);
assert.equal(base.target,301);
assert.deepEqual(base.overRows[0].par,[0,26,58,94,135,175,213,245,271,292]);
assert.deepEqual(base.overRows[25].par,[102,113,127,144,166,193,222,250,274,292]);
assert.equal(base.ballRows.length,301);
assert.equal(base.overRows.length,51);
console.log(`PASS: ${cases.length} JAR reference scenarios + notation and par-table checks.`);

const twoEach = calculateMatch({
  firstOvers:50, firstRuns:240, secondOvers:40,
  firstEvents:[{oversBowled:10,wickets:0,oversLost:5},{oversBowled:30,wickets:3,oversLost:5}],
  secondEvents:[{oversBowled:8,wickets:0,oversLost:3},{oversBowled:24,wickets:3,oversLost:4}]
});
assert.equal(twoEach.target,218);
assert.equal(twoEach.finalSecondOvers,'33.0');
assert.equal(twoEach.overRows.length,41);
assert.equal(twoEach.ballRows.length,241);
assert.equal(twoEach.overRows[0].oversRemaining,'40.0');
assert.deepEqual(twoEach.overRows[0].par,[-37,-18,6,34,68,103,137,166,190,210]);
assert.deepEqual(twoEach.overRows[15].par,[25,35,49,66,87,113,141,168,191,210]);
assert.deepEqual(prepareEvents([
  {oversBowled:'10.0',wickets:'1',oversLost:'4.0'},
  {oversBowled:'20.0',wickets:'2',oversLost:'A'}
],50,'test'),[
  {oversBowled:10,wickets:1,oversLost:4,scoreAtEvent:null},
  {oversBowled:20,wickets:2,oversLost:26,scoreAtEvent:null}
]);
console.log('PASS: multi-event par-table reference rows and A-entry handling.');
assert.deepEqual(base.overRows.at(-1).par, Array(10).fill(300));
assert.deepEqual(twoEach.overRows.at(-1).par, Array(10).fill(217));
console.log('PASS: Java Math.round(NaN) terminal-row parity.');

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(here, 'fixtures/two-events-each.json'), 'utf8'));
const fullTableCheck = calculateMatch(fixture.input);
assert.equal(fullTableCheck.lambda, fixture.lambda);
assert.ok(Math.abs(fullTableCheck.adjustmentFactor - fixture.adjustmentFactor) < 1e-12);
assert.equal(fullTableCheck.target, fixture.target);
assert.equal(fullTableCheck.overRows.length, fixture.overRows.length);
assert.equal(fullTableCheck.ballRows.length, fixture.ballRows.length);
for (let i=0;i<fixture.overRows.length;i++) {
  assert.equal(fullTableCheck.overRows[i].oversRemaining, fixture.overRows[i].oversRemaining, `over table row ${i}`);
  assert.deepEqual(fullTableCheck.overRows[i].par, fixture.overRows[i].par, `over table cells ${i}`);
}
for (let i=0;i<fixture.ballRows.length;i++) {
  assert.equal(fullTableCheck.ballRows[i].oversRemaining, fixture.ballRows[i].oversRemaining, `ball table row ${i}`);
  assert.deepEqual(fullTableCheck.ballRows[i].par, fixture.ballRows[i].par, `ball table cells ${i}`);
}
console.log('PASS: all 41 over-by-over rows and 241 ball-by-ball rows match the original JAR fixture exactly.');


// Automatic chase allocation from first-innings interruption losses.
const firstLossEvents = prepareEvents([
  { oversBowled: '10.0', scoreAtEvent: '65', wickets: '1', oversLost: '4.0' },
  { oversBowled: '28.0', scoreAtEvent: '151', wickets: '3', oversLost: '2.3' }
], 50, 'First innings');
assert.equal(deriveSecondOvers(50, firstLossEvents), '43.3');
const fractionalChase = calculateMatch({
  firstOvers: 50,
  firstRuns: 250,
  secondOvers: parseOvers(deriveSecondOvers(50, firstLossEvents)),
  firstEvents: firstLossEvents
});
assert.equal(fractionalChase.overRows.length, 44);
assert.equal(fractionalChase.ballRows.length, 262);
assert.equal(fractionalChase.overRows[0].oversRemaining, '43.3');
console.log('PASS: automatically derived second-innings allocation, including partial-over notation.');


// Minimum-over rules: the ODI default is checked by the UI; the engine receives
// the selected minimum and marks a chase allocation below it as NO RESULT.
const exactlyMinimum = calculateMatch({
  firstOvers: 50, firstRuns: 250, secondOvers: 40, minOversPerSide: 20,
  secondEvents: [{ oversBowled: 10, wickets: 1, oversLost: 20 }]
});
assert.equal(exactlyMinimum.finalSecondOvers, '20.0');
assert.equal(exactlyMinimum.noResult, false, 'exactly the minimum overs remains result-eligible');
const belowMinimum = calculateMatch({
  firstOvers: 50, firstRuns: 250, secondOvers: 40, minOversPerSide: 20,
  secondEvents: [{ oversBowled: 10, wickets: 1, oversLost: 21 }]
});
assert.equal(belowMinimum.finalSecondOvers, '19.0');
assert.equal(belowMinimum.noResult, true, 'less than the minimum overs must be No Result');
assert.match(belowMinimum.noResultReason, /minimum is 20 overs/);
const t20Minimum = calculateMatch({
  firstOvers: 20, firstRuns: 150, secondOvers: 20, minOversPerSide: 5,
  secondEvents: [{ oversBowled: 5, wickets: 1, oversLost: 15 }]
});
assert.equal(t20Minimum.finalSecondOvers, '5.0');
assert.equal(t20Minimum.noResult, false, 'exactly the T20 minimum remains result-eligible');
console.log('PASS: configurable minimum overs (ODI 20, T20 5, and below-minimum No Result handling).');
