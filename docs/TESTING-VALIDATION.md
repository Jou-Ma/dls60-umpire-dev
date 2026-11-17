# DLS Umpire Calculator — Testing & Validation Report

**Document status:** Initial test record; ongoing  
**Application baseline:** PoC Build 0.5.4  
**Calculation standard:** ICC DLS 6.0  
**Product version:** Not yet formally released

## 1. Purpose

Record reproducible tests of the application and comparisons against the official ICC DLS 6.0 calculator. The official calculator is the reference for numerical validation.

A successful test demonstrates agreement for the specific inputs tested. It does not, by itself, establish correctness for every possible match scenario.

## 2. Test method

For each comparison, record:
- Application build
- Match format and minimum overs
- Complete first-innings inputs and interruptions
- Complete second-innings inputs and interruptions
- Relevant official DLS 6.0 output
- Application output
- Comparison method
- Number of rows and numerical cells compared
- Discrepancies, if any
- Tester and test date

Distinguish manual visual comparison from automated comparison.

## 3. Recorded validation results

### 3.1 Build 0.5.4 — 50-over resource-table comparison

**Recorded outcome:** No discrepancies found in manual comparison.

- Over-by-over table: 10 rows × 10 wicket columns = 100 numerical values.
- Ball-by-ball table: 51 rows × 10 wicket columns = 510 numerical values.
- Total: 610 numerical values compared.
- Overs bowled, overs remaining and unavailable (--) cells also matched.

**Qualification:** This was a manual visual comparison of the supplied output, not an automated test. Preserve the original complete input scenario and reference output when available.

### 3.2 Build 0.5.4 — zero overs remaining after an interruption

The application was exercised with a T20 configuration, a standard 50-over configuration and a custom 60-over configuration with a 25-over minimum.

**Recorded outcome:**
- The application calculated without the previously observed NaN adjustment factor in all three configurations.
- The custom 60-over result was compared with the official ICC DLS 6.0 calculator and produced the same result.

**Known input details from the recorded test:**
- Custom match: 60 scheduled overs; 25-over minimum.
- First-innings score: 187.
- First-innings interruption entered at 18 overs.
- Five wickets down.
- Two overs lost.

**Qualification:** The complete event sequence and exact official output have not yet been transcribed into this document.

### 3.3 Build 0.5.4 — custom 60-over match with interruptions in both innings

**Recorded outcome:** The application ball-by-ball table matched the official ICC DLS 6.0 output in the supplied comparison.

- Overs scheduled: 60.
- Minimum overs: 25.
- Second-innings interruption also included.
- Rows compared: 117.
- Wicket columns: 10.
- Numerical values compared: 1,170.
- Discrepancies observed: 0.
- Unavailable (--) cells and overs remaining also aligned.

**Qualification:** The comparison was made from the two pasted tables. The complete match inputs, test date and a machine-readable comparison file still need to be captured. The comparison should not be described as automated.

## 4. Regression test catalogue

Maintain a separate reproducible test case for each of the following:
- Standard 50-over match
- T20 match
- Custom match type
- First-innings interruption
- Multiple first-innings interruptions
- Second-innings interruption
- Multiple second-innings interruptions
- Interruptions in both innings
- Zero overs remaining after an interruption
- Minimum-overs boundary
- All-out scenarios
- Chasing side reaches target
- Match tied
- Defending side wins
- No Result
- Ball-by-ball resource table
- Over-by-over resource table
- Saved match and report consistency
- Offline save and subsequent upload

## 5. Defect and retest log

| Reference | Build found | Description | Fix build | Retest result |
|---|---|---|---|---|
| To be assigned | — | — | — | — |

## 6. Known limitations and outstanding validation

- The currently recorded comparisons cover selected scenarios, not the complete DLS 6.0 scenario space.
- Some historical test inputs and outputs still need to be captured in reproducible form.
- Manual comparisons should be labelled as manual until an independent automated comparison process exists.

## 7. Test evidence register

For each test, retain the input sheet, official reference output, application output and a short comparison record. Do not rely solely on a statement that two results matched.


## 8. Development UX change — pending user verification

**Scope:** Development branch only. This section is a retest checklist, not evidence that the checks have passed.

### 8.1 Match setup and Time per Over

- [ ] Match Type is the only field on the first setup row on desktop and mobile.
- [ ] The next row is ordered Overs per innings, Time per Over, Minimum overs per side.
- [ ] ODI displays 4.2 minutes per over as read-only.
- [ ] T20 displays 4.25 minutes per over as read-only.
- [ ] Promotion League – 45 Overs displays 3.75 minutes per over as read-only.
- [ ] Women's League – 35 Overs displays 3.75 minutes per over as read-only; minimum overs remains editable and required.
- [ ] Women's T20 displays 3.75 minutes per over as read-only; minimum overs remains editable and required.
- [ ] Generic 50-over and 40-over presets have an editable, required Time per Over value.
- [ ] Custom match type has editable overs, minimum overs and Time per Over.
- [ ] Time per Over remains independent of the Appendix A worksheet; changing either setting does not change the other.

### 8.2 Innings controls and allocation

- [ ] First-innings total runs appear in section 02 above interruption events.
- [ ] Exactly one penalty-runs field appears below the Chasing Team interruptions table, labelled as penalty runs awarded to Team 1 while Team 2 is batting.
- [ ] The visible second-innings scheduled-overs override is removed.
- [ ] The chase's starting scheduled allocation equals Overs per innings less the cumulative first-innings interruption overs lost.
- [ ] Changing first-innings interruption entries recalculates the chasing allocation immediately; incomplete/invalid first-innings entries must not leave a stale allocation available for calculation.
- [ ] Legacy saved/imported scenarios ignore any old second-innings overs override and derive the chasing allocation from the first-innings schedule and interruption losses.
- [ ] The calculated second-innings overs are displayed in section 03 after applying both the revised chasing allocation and any second-innings interruption losses.
- [ ] Regression: Custom 65 overs, 3.75 minutes per over, 25 minimum; first-innings interruption at 13.2, 69 runs, 2 wickets, 12 overs lost. The chasing allocation must update to 53.0 overs.

### 8.3 Penalty-run result handling

- [ ] The single penalty-runs value is passed to the DLS calculation as penalty runs awarded to Team 1 while Team 2 is batting.
- [ ] The penalty value affects the revised target in accordance with the existing DLS calculation; it is not added again to Team 2's final score.
- [ ] The generated report identifies the penalty runs as awarded to Team 1 while Team 2 was batting.

### 8.4 Default interruption rows
- [ ] One blank event row is present by default in First Innings.
- [ ] One blank event row is present by default in Second Innings.
- [ ] Blank default rows do not trigger validation errors or affect DLS calculations.
- [ ] Reset restores one blank row in each innings.
- [ ] Loading a saved scenario with no interruptions restores one blank row in each innings.

**Verification status:** Not yet browser-tested. Complete the checklist on Development before any request to promote these changes to Production.
