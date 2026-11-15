# DLS Umpire Calculator — Technical Documentation

**Document status:** Draft structure  
**Application baseline:** PoC Build 0.5.4  
**Calculation standard:** ICC DLS 6.0  
**Product version:** Not yet formally released

## 1. System overview
- Application purpose and scope
- Supported deployment model
- Current operational baseline

## 2. Architecture
- Progressive Web App (PWA)
- Application shell and user interface
- Calculation engine
- Match record and report modules
- Service worker and cached assets
- Local persistence
- Archive upload service

## 3. Calculation engine
- ICC DLS 6.0 reference standard
- Engine module boundaries
- Input model and validation
- Resource calculations
- Interruption and segment handling
- Lambda and adjustment-factor handling
- Target and par-score generation
- Ball-by-ball and over-by-over output
- Numerical precision and rounding

**Important:** This section must describe the implemented code accurately. It must not reproduce or infer proprietary ICC methodology beyond what is necessary to document the application's implementation and observed behaviour.

## 4. Match data and reports
- Match input structure
- Interruption/event representation
- Result determination
- Report generation
- Match record schema and schema version
- Application build metadata

## 5. Offline and PWA behaviour
- Web app manifest
- Service worker
- Cache strategy and cache versioning
- First installation and subsequent updates
- Offline operation and its limits

## 6. Local storage
- What is stored on the device
- Match lifecycle and status
- Data retention and deletion behaviour
- Device-specific nature of local records
- Backup and recovery considerations

## 7. Archive upload service
- Architecture and data flow
- Cloudflare Worker responsibilities
- Authentication model
- GitHub private archive repository
- Record naming and storage structure
- CORS and request validation
- Retry and idempotency behaviour
- Operational limits and failure handling
- Security considerations

**Security note:** The GitHub personal access token must remain server-side as a Cloudflare secret. Any shared access code embedded in a public client application must be treated as extractable, not as a confidential secret.

## 8. Build and deployment process
- Source repository and branch
- Files forming the application
- Build identification
- Service-worker cache updates
- Deployment to GitHub Pages
- Verification after deployment
- Rollback considerations

## 9. Maintenance and future changes
- Calculation engine changes
- Regression testing requirements
- Data schema compatibility
- Archive service maintenance
- Formal product-version policy

## 10. Technical appendices
- Repository file inventory
- Data structures
- Endpoint contracts
- Configuration inventory (excluding secret values)
- Known limitations

---

## Editorial notes / content still required

- Verify every architectural statement against the current source code and deployed Worker.
- Record exact storage APIs, keys and schema fields from the implementation.
- Document actual endpoint responses and error cases.
- Do not include access codes, tokens or other credentials.
- Distinguish verified behaviour from design intent and known limitations.
