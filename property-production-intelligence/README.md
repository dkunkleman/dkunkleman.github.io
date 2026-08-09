# Production Intelligence & Job-Cost Engine V0.1

This is an isolated, review-only business/work-record prototype. It is not deployed and it does not read or write any field-app storage.

## What it establishes

- Measured work quantity and actual phase time remain separate from delays.
- Crew-hours and worker-hours are calculated from supplied time and crew data.
- Production rates exist only when both a usable completed quantity and usable productive time exist.
- Costs remain `UNKNOWN` until every required cost input is supplied, including explicit zeroes.
- A test cannot enter an internal baseline until an operator separately confirms its quantity, time, production class, and delays.
- Production knowledge is separated by production class, finish level, and quantity type.
- A separately timed Clean Staging follow-on pass can be compared with its matching Reveal test to preserve the actual incremental labor and cost; missing costs remain unknown.
- Proposal estimates remain `UNKNOWN` when production rate or required cost components are unknown.
- Proposal price requires an explicit operator approval event.
- Work-order imports remain ineligible until separately reviewed.

## Data boundaries

Production tests are `BUSINESS_WORK_RECORD` objects. They may reference immutable evidence IDs, but they never alter field observations, photographs, GPS, or other source evidence.

The browser prototype uses only the isolated localStorage key:

`propertyProductionIntelligenceV01Review`

It does not use a service worker.

## Run locally

Serve the repository root or this directory with a normal static server and open `property-production-intelligence/index.html`.

## Important language

Observed internal production rates are not promises and are never described as statistically proven. Pearson proposal quantities are geometry-derived planning inputs. Rates, hours, cost, and price are intentionally `UNKNOWN` until supported by measured tests and operator approval.
