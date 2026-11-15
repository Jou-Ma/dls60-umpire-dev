# DLS Umpire Calculator — Release Notes & Build History

**Document status:** Living development and release record; reconstructed from project conversations and available Git history  
**Application status:** Version 1.0 released  
**Current build:** 0.5.4  
**Calculation standard:** ICC DLS 6.0  
**Product version:** 1.0  
**History coverage:** Initial prototype through Build 0.5.4

> **Record-keeping note:** The early builds (0.1.0–0.5.0) were developed and discussed in the project conversation. The GitHub repository does not preserve a complete, one-commit-per-build source history for those early iterations; some source files were uploaded in batches. Their entries below are therefore reconstructed from contemporaneous project notes and user testing, not represented as verified individual Git commits. Git commit timestamps are recorded where available. All dates are 15 November 2026 (South African local date); exact times are shown only where supported by Git commit timestamps.

## 1. Numbering policy

### Product version
- Formal product versions identify significant product releases.
- The first formal product release is **Version 1.0**, based on the tested Build 0.5.4 baseline.
- A later major product milestone may be **Version 2.0**, **Version 3.0**, and so on.
- The project convention does not require decimal product versions such as 1.1 or 1.2.

### Build number
- Every development build has its own build identifier.
- Multiple builds may belong to one product version.
- Development iterations, bug fixes and functional corrections are tracked by build number.
- A new build does not automatically create a new product version.

### Calculation standard
- The current implementation uses **ICC DLS 6.0**.
- The calculation standard is recorded separately from both product version and build number.
- ICC DLS 6.0 is the accepted reference standard for this project. No work on a hypothetical later DLS version is in scope unless the project direction changes.

### Identifiers to display
The formal release display identifies the product version, included build and calculation standard, for example:

**Version 1.0 · Build 0.5.4 · ICC DLS 6.0**

## 2. Chronological build history

### Build 0.1.0 — Initial working prototype

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** Initial prototype

**Purpose:** Establish a working, offline-capable DLS 6.0 umpire calculator.

**Implemented capabilities recorded at the time:**
- Initial DLS 6.0 calculation engine and calculator interface.
- First-innings and second-innings interruption inputs, including multiple interruptions.
- Overs and balls notation, including handling of the all-out ('A') notation in the relevant input workflow.
- Revised target calculation.
- Over-by-over and ball-by-ball par-score tables.
- CSV output.
- Local match/scenario saving.
- JSON import and export.
- PWA/offline application shell and caching.

**Validation recorded:**
- 10 of 10 target test scenarios matched the supplied official DLS 6.0 JAR reference results.
- A multiple-interruption comparison covering both innings recorded 41 over-by-over rows and 241 ball-by-ball rows with no mismatches in the compared output.

**Outstanding at this stage:**
- Physical-device testing on Android and iPhone/iPad had not been completed.
- Airplane-mode/offline behaviour still required direct device verification.
- Broader regression testing was still required.

**Evidence qualification:** The test counts and outcomes are retained from the contemporaneous development record. The full original test input/output pack should be preserved separately if recovered.

### Build 0.2.0 — Match types and innings allocation

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** Feature build; deployed for user testing

**Changes introduced:**
- Added match-type selection for ODI, T20, Other and Custom formats.
- Added minimum-overs-per-side configuration.
- Recorded defaults/options included ODI 50 overs with a 20-over minimum; T20 20 overs with a 5-over minimum; Other presets; and a Custom option.
- The Other format's minimum overs needed to remain editable.
- Added automatic second-innings overs allocation based on overs lost in the first innings.
- Retained a manual override for second-innings overs.
- Added clearer labels to interruption input fields.

**Example allocation used during development:** A 50-over match with first-innings losses of 4.0 and 2.3 overs resulted in 43.3 overs allocated for the chase.

**Validation recorded:**
- Existing reference tests continued to pass.
- A partial-over automatic allocation case was added to the checks.

**Outstanding at this stage:**
- Interactive browser testing was not yet complete.
- The user had begun checking the deployed application on Android; a full platform test matrix was still outstanding.

### Build 0.3.0 — Match report and minimum-overs rules

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** Feature build

**Changes introduced:**
- Added a DLS Match Report workflow.
- Added minimum-overs validation and No Result handling.
- ODI minimum overs defaulted to 20; T20 defaulted to 5; Other/custom minimum overs remained configurable.
- Retained support for multiple interruptions in both innings.
- Added report readiness logic. In this iteration, report availability was too restrictive: it was initially tied to the chasing side reaching the target.

**Validation recorded:**
- Ten DLS reference scenarios.
- Multiple interruptions in both innings.
- A comparison set containing 41 over-by-over rows and 241 ball-by-ball rows.
- No mismatches were recorded in those numerical comparisons.

**Known defect carried forward:** The second-innings resource tables did not correctly restrict their displayed range after overs were lost in the chase. The report readiness rule also needed later refinement.

### Build 0.3.1 — Attempted second-innings table boundary correction

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** Superseded; attempted fix was unsuccessful

**Intended change:**
- Correct the second-innings over-by-over and ball-by-ball table boundaries so the tables reflected the revised chase length after interruptions.

**Test scenario used:**
- First-innings interruptions at 10 and 20 overs, each with 10 overs lost.
- Second-innings interruptions at 10 overs (75 runs, 4 wickets, 8 overs lost) and 18 overs (150 runs, 4 wickets, 2 overs lost).
- Revised target recorded as 262.

**Outcome:**
- The attempted correction did not resolve the problem.
- The user confirmed that the second-innings tables still showed the original 0–30-over range rather than the revised chase range.
- An earlier claim that the fix had worked was withdrawn. This build must not be recorded as a successful correction.

### Build 0.3.2 — Second-innings table boundary fix

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** Successful correction; user comparison confirmed

**Changes introduced:**
- Corrected the second-innings table boundary logic.
- Tables now stopped at the revised chase length rather than continuing to the original scheduled overs.
- Correctly handled the two-interruption-per-innings test case described under Build 0.3.1.

**Validation recorded:**
- In the test scenario, the revised chase length ended at 20 overs.
- Over-by-over output contained 3 rows (18.0–20.0).
- Ball-by-ball output contained 13 rows (18.0–20.0, including individual balls).
- All 13 ball-by-ball rows and all 3 over-by-over rows matched the official DLS 6.0 reference values in the user's comparison.
- The revised target remained 262.

**Outcome:** User confirmed the corrected tables matched the official DLS 6.0 output for this scenario.

### Build 0.4.0 — Match report workflow iteration

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** Intermediate report implementation

**Recorded scope:**
- Continued development of the DLS Match Report workflow introduced in Build 0.3.0.
- Report generation and availability were still being refined against different match outcomes.

**Known issue identified during this iteration:**
- A report could be unavailable when the chasing side had not won or reached the target.
- This made report availability dependent on the match outcome rather than simply on the required report information being supplied.

**Evidence limitation:** The surviving project notes do not provide a reliable, complete file-by-file change list for this build. Do not infer additional functionality or claim a specific fix beyond the report workflow iteration described here.

### Build 0.4.1 — Match report available regardless of outcome

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** User-confirmed correction

**Changes introduced:**
- Corrected report readiness so a report could be generated once the required report details were captured, regardless of whether the chasing side won.
- Removed the unintended dependency on the chasing side reaching the target.

**Scenarios explicitly covered in the user confirmation:**
- Chasing side wins.
- Chasing side finishes below the target.
- Chasing side is all out.
- Match is No Result.

**Outcome:** User confirmed the report was working as expected.

### Build 0.5.0 — Local match records and private archive upload (initial implementation)

**Date:** 15 November 2026 (project conversation; exact source commit date not established)  
**Status:** Major workflow implementation; initial service setup and live verification followed

**Purpose:** Allow match records to be retained locally and uploaded to a separate private archive without making the public application repository a match-data store.

**Specified/implemented workflow:**
- Save match records locally on the device.
- Keep records pending when offline.
- Upload automatically when the application is active and an internet connection is available.
- Provide a manual **Sync Now** action.
- Track upload status per match.
- Retry failed/pending uploads.
- Include match inputs, interruption details, targets/results, par-score tables and application build information in the archive record.

**Capturer identity requirement at initial design:**
- The user required the person capturing the match to enter Name and Surname.
- In the initial 0.5.0 specification these fields were mandatory and blocked calculation if missing.
- Capturer details were intended to appear in saved match data, reports and uploaded records. This requirement was relaxed in Build 0.5.1.

**Archive architecture:**
- Public application repository: `Jou-Ma/dls60-umpire`.
- Separate private match archive repository: `Jou-Ma/dls60-match-archive`.
- Cloudflare Worker used as the server-side bridge between the PWA and GitHub.
- GitHub personal access token held as a Cloudflare Worker secret, not in the browser application.
- Shared upload access code used by the small umpire group.

**Initial implementation/setup limitations:**
- The first upload implementation had only been exercised against a simulated GitHub API; the real private repository and Worker still required setup and live testing.
- Initial archive synchronisation did not result in a stored match because the private repository needed its initial commit/repository setup completed.
- The user then completed the private repository and Worker configuration and tested the live service.

**Important distinction:** The 0.5.0 feature specification and initial implementation should not be confused with the later confirmed live upload milestone. Live Worker health and upload testing were completed during the subsequent 0.5.2 setup/refinement work.

### Build 0.5.1 — Capturer details made optional and moved into report

**Date:** 15 November 2026  
**Git commit sequence:** 09:46:46–09:46:52 UTC (11:46:46–11:46:52 South African time)  
**Status:** Deployed; user confirmed update on Windows and Android

**User-requested changes:**
- Name and Surname were no longer mandatory.
- Capturer Name and Surname fields were moved to the DLS Match Report section, under additional report details.
- The report fields used default Name/Surname values rather than blocking match calculation.
- Capturer details remained available for inclusion in the report, saved match and uploaded record when entered.

**Files/components recorded as changed:** `app.js`, `index.html`, `match-record.js` and `sw.js`.

**PWA update:**
- Service-worker cache advanced from `dls60-umpire-shell-v9` to `dls60-umpire-shell-v10`.

**Validation/deployment:**
- User deployed/refreshed the update.
- Ctrl+F5 on Windows refreshed the application successfully.
- Closing and reopening the Android PWA also loaded the updated build.

**Git commits:**
- `b041a92c4c58b9133eeb671c86eca7bc509ad4c8`
- `d279cdc27b1135003993b7df6b46c61d05c46ca2`
- `89abc8acd73ad1bb270cda2e892f7202c0e3bf2e`
- `7b62d8a68fa7ef48c75edabe54420ab73ede5a3f`

### Build 0.5.2 — Preconfigured private archive and simplified synchronisation

**Date:** 15 November 2026  
**Git commit timestamps:** 10:26:54–10:26:56 UTC (12:26:54–12:26:56 South African time)  
**Status:** Live archive service tested

**Changes introduced:**
- Preconfigured the PWA with the Cloudflare Worker endpoint and shared umpire-group upload code.
- Removed the need for each user to enter and save the upload endpoint and access code.
- Removed the upload connection settings panel.
- Simplified the saved-match upload status message.
- Changed the manual action label to **Sync now**.
- Retained automatic upload when online and pending-match synchronisation.
- Updated the stored scenario application version to 0.5.2.

**Security/architecture note:**
- The shared access code is bundled in the public client code for convenience within the small trusted group; it must be treated as extractable, not confidential.
- The GitHub personal access token remains a Cloudflare Worker secret and must never be placed in the PWA.
- The archive remains a separate private repository; match records are not committed to the public application repository.

**Files/components confirmed by Git diffs:** `app.js`, `index.html`; service-worker cache and match-record version updates were also committed as part of the 0.5.2 sequence.

**PWA update:**
- Service-worker cache advanced from `dls60-umpire-shell-v10` to `dls60-umpire-shell-v11`.

**Validation/deployment:**
- Worker health endpoint returned `{ "service": "dls-match-archive", "ready": true }`.
- Live match uploads were tested successfully from the app, including on a phone.
- Saved records were confirmed to upload to the private archive.

**Git commits:**
- `efe3212d50639901625cc6588e0ebe333165d108` — preconfigure private archive upload.
- `0ac1d27276bd696d95a90e8d6111da45d744d8d6` — simplify archive upload UI.
- `a548a892e8` — match-record application version update (short SHA; full SHA to be confirmed from Git history).
- `9257ff7d9c` — service-worker cache refresh (short SHA; full SHA to be confirmed from Git history).

### Build 0.5.3 — Interface simplification and match report presentation

**Date:** 15 November 2026  
**Git commit timestamps:** 10:47:00–10:47:09 UTC (12:47:00–12:47:09 South African time)  
**Status:** Deployed; initial user check positive; colleague testing awaited

**User's design direction:** Remove elements that are not required. Retain the black application header and install option; remove redundant explanatory material and notices.

**Interface changes:**
- Retained the black header, application identity and install option.
- Removed the redundant introductory block, including the `DLS 6.0 · UMPIRE EDITION` heading, promotional tagline and explanatory paragraph.
- Removed the repeated offline-ready/feature notice.
- Kept the calculator interface more compact and focused.

**Report changes:**
- Removed lambda and adjustment factor from the printable DLS Match Report. These values remained available in the calculator metrics; they were removed from the report only.
- Reworked the result wording to show the DLS target, chasing team's final score and concise match outcome.
- When the chasing team reaches the target and wickets are known, the report states the wickets remaining.
- When wickets are not supplied, the report states that the team won without inventing a wicket margin.
- When the defending side wins, the report calculates the run margin as target minus final score minus one.
- A score exactly one run short of the target is reported as a tie.
- No Result is explicitly identified as such.
- Actual team names are passed into the outcome wording rather than generic team labels.

**Files/components confirmed by Git diffs:** `index.html`, `app.js`, `report.js`, `match-record.js`, `sw.js`.

**PWA update:**
- Service-worker cache advanced from `dls60-umpire-shell-v11` to `dls60-umpire-shell-v12`.

**Validation/deployment:**
- Repository contents were re-fetched and checked after the changes.
- Verification confirmed the intro was removed, install button retained, calculator metrics remained available, report parameters were removed, team names were passed to the outcome function, and application/match-record build metadata was updated.
- User performed an initial check and reported that it appeared correct.
- Further colleague testing was still awaited at the time of the project notes.

**Git commits:**
- `5f6d70ea495221503b5c0a6a3ab8b6f6f3f3b82b` — simplify landing layout and bump build.
- `2a2b73937fbf175faaf0ca7ed6437564033c5914` — remove technical DLS parameters from report.
- `dd6497cbe73d841450a6eef687c1a3208c9fe31d` — concise cricket result wording.
- `9e0cf4d1799796886114d812e37a991051670d60` — match-record version update.
- `0a85e225e06845703cbf6fb725bbe9bf3a5560e5` — service-worker cache refresh.
- `7bc26eba161caea90d12134bd2e04e3e3393a899` — preserve calculator metrics and pass actual defending team.

### Build 0.5.4 — Zero-resource interruption calculation guard

**Date:** 15 November 2026  
**Git commit timestamps:** 12:37:54–12:38:14 UTC (14:37:54–14:38:14 South African time)  
**Status:** Current PoC build; user testing and official-reference comparisons reported successful

**Problem reported:**
- An interruption scenario could cause the adjustment factor to display as `NaN`.
- The issue was first noticed in a T20 scenario and then also tested in a 50-over scenario.
- Investigation identified a zero-over resource segment as a calculation path requiring explicit handling.

**Code change:**
- Added a guard in `engine.js` so an event segment with zero or fewer overs contributes zero resources instead of evaluating the zero-over resource expression and propagating an invalid numerical result.

**Other build updates:**
- Application footer/build identifier changed to Build 0.5.4.
- Service-worker cache advanced from `dls60-umpire-shell-v12` to `dls60-umpire-shell-v13`.

**Files changed:** `engine.js`, `index.html`, `sw.js`.

**Git commits:**
- `60c4b935557a011383b23f43af21a7e2b5a9c281` — calculation guard.
- `36f8605fcb552e16a4b8378b3f54c7adb01779fd` — build identifier.
- `3c4283eee26247a4388fd628058147ff0c6f3a58` — service-worker cache refresh.

**Validation recorded after the build:**
- User confirmed the calculation worked in T20 and 50-over scenarios.
- A custom 60-over match with a 25-over minimum and the same zero-over interruption condition calculated successfully and matched the official ICC DLS 6.0 result.
- A second-innings interruption was then added to the custom 60-over match.
- The application ball-by-ball table was compared with the official DLS 6.0 table:
  - 117 rows.
  - 10 wicket columns.
  - 1,170 numerical values.
  - No discrepancies observed.
  - Overs bowled, overs remaining and unavailable (--) cells also aligned.

**Comparison qualification:** The table comparison was a manual comparison of the outputs supplied in the project conversation, not an automated independent test. It validates the supplied scenario; it does not prove every possible DLS scenario.

## 3. Build summary index

| Build | Main purpose/change | Outcome/status |
|---|---|---|
| 0.1.0 | Initial DLS 6.0 calculator prototype | Initial reference tests passed; device/offline testing outstanding |
| 0.2.0 | Match types, minimum overs, automatic chase overs, clearer interruption labels | Reference checks passed; interactive testing still in progress |
| 0.3.0 | Match report and minimum-overs/No Result handling | Feature added; report readiness and table-boundary issues remained |
| 0.3.1 | Attempted second-innings table boundary fix | **Unsuccessful**; defect confirmed by user |
| 0.3.2 | Corrected second-innings table range | **Successful** in supplied official comparison |
| 0.4.0 | Match report workflow iteration | Outcome-dependent report availability issue remained |
| 0.4.1 | Report readiness independent of match outcome | **User confirmed working as expected** |
| 0.5.0 | Local match records and private archive upload workflow | Initial implementation; live service setup/testing followed |
| 0.5.1 | Capturer details optional and moved into report | Deployed; Windows and Android refresh confirmed |
| 0.5.2 | Preconfigured archive connection and simplified sync UI | Live Worker health and match upload tested successfully |
| 0.5.3 | Simplified interface and revised report wording | Repository checks and initial user check positive; colleague test awaited |
| 0.5.4 | Zero-resource interruption guard | User compared T20, 50-over and custom 60-over results with official DLS 6.0; latest 1,170-value table comparison had no discrepancies |

## 4. Known gaps in the historical record

The following information should be added if recovered; it must not be guessed:

1. Exact creation dates/times and source snapshots for Builds 0.1.0 through 0.5.0.
2. Full file-by-file change lists for Builds 0.1.0 through 0.4.1.
3. The exact implementation details of Build 0.4.0.
4. Full Git commit SHAs for the two abbreviated 0.5.2 commits.
5. The original complete inputs and official reference outputs for the early DLS test scenarios.
6. Exact build-by-build deployment and device-test evidence for early builds.

The repository's current Git history contains reliable individual commits for the 0.5.1–0.5.4 work described above, but early iterations were uploaded in batches and cannot safely be reconstructed from commit metadata alone.

## 5. Formal product releases

| Product version | Release date | Release build | Status |
|---|---|---|---|
| 1.0 | 15 November 2026 | 0.5.4 | Released; first formal product release |

## 6. Required entry format for future builds

Every future build entry must record:

- Build identifier.
- Date and time (South African time; include UTC if sourced from Git).
- Reason for the change / problem addressed.
- Exact changes made.
- Files or components affected.
- Git commit SHA(s).
- Tests performed and reference standard used.
- Test outcome, including failures and limitations.
- Deployment status and user confirmation.
- Any known issue carried forward.

A failed or superseded fix must remain in the history. Do not delete it merely because a later build corrected the problem; recording unsuccessful attempts is essential for future diagnosis.

## 7. Formal release entry format

For each formal product release, record:

- Product version.
- Release date.
- Included build.
- User-facing changes.
- Compatibility or migration notes.
- Known limitations.
- Approved documentation set.
- Release acceptance/approval.


### Version 1.0 — First formal product release

**Release date:** 15 November 2026  
**Included development build:** 0.5.4  
**Calculation standard:** ICC DLS 6.0  
**Release baseline:** Build 0.5.4, including the zero-resource interruption guard.

**Release decision:** The project owner accepted the current build for the first formal product release after testing multiple scenarios. The only reported calculation error of concern was the `NaN` adjustment-factor issue, which was corrected in Build 0.5.4 and retested.

**Included functionality:**
- DLS 6.0 target and resource calculations for supported match formats.
- Multiple first- and second-innings interruption handling.
- Minimum-overs rules and No Result handling.
- Over-by-over and ball-by-ball par-score tables.
- Match reports, local match records, JSON import/export and CSV export.
- Offline-capable PWA installation and private match-archive upload workflow.

**Validation evidence:** The user reported successful testing across multiple scenarios. Recorded comparisons include 10 reference target scenarios; 41 over-by-over rows and 241 ball-by-ball rows with no mismatches in the earlier comparison; and a later 1,170-value ball-by-ball comparison for a custom 60-over interrupted match with no discrepancies observed. These results are scenario-specific and are not an exhaustive validation of every possible input combination.

**Known limitations and cautions:**
- The implementation has not been exhaustively validated across every possible input combination or competition condition.
- Official match decisions must be cross-checked using the authorised DLS application and applicable playing conditions.
- DLS is proprietary. This independent tool is not an ICC product and is not certified, endorsed or approved by the ICC. Distribution and use remain subject to applicable permissions and licensing requirements.
- Local saved records are device/browser-specific unless uploaded to the separately configured private archive.

**Release metadata:** The application footer and release-facing documentation identify the release as **Version 1.0 · Build 0.5.4 · ICC DLS 6.0**. The calculation logic remains the Build 0.5.4 implementation; the release metadata does not represent a new calculation build.
