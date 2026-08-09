# Property Intelligence Opportunity Engine V0.1

This isolated review candidate converts traceable property conditions, interpretations, unknowns, customer intent, work history, and customer interactions into **candidate opportunities**.

It does not modify evidence, set prices, send proposals, schedule work, or claim that an intervention will increase property value.

## Information chain

1. `OBSERVED CONDITION`
2. `INTERPRETATION`
3. `UNKNOWN / REQUIRED VERIFICATION`
4. `POSSIBLE OPPORTUNITY`
5. `PROPOSAL ELIGIBILITY`
6. `CUSTOMER DECISION`

## Eligibility

- `NEEDS_VERIFICATION`: a candidate exists, but at least one required verification remains.
- `READY_FOR_DRAFT`: the source record supports an operator-reviewed draft proposal input.
- `NOT_ELIGIBLE`: no Property Intelligence physical-service proposal should be created, including professional handoffs.

`READY_FOR_DRAFT` never supplies or validates a price, accepts a proposal, changes geometry, or sends material to a customer.

## Customer intent

The type catalog declares which candidates are normally relevant to sellers/listing agents, buyers, builders, and owners. The complete internal candidate record remains available, while the review interface filters normal customer-facing relevance.

Customer favorites, zone selections, questions, and change requests are stored as `CUSTOMER_INTEREST`. They may influence a disclosed priority dimension, but they never become evidence of a physical property condition.

## Priority

Nine dimensions remain separate. The engine returns `priority_score: null` whenever any dimension is unknown. It does not fabricate a false-precision ROI or revenue-only rank.

## Integrations

- Proposal Generator: operator-approved draft input only; pricing, validation, geometry selection, acceptance, and delivery remain separate.
- Repeat Photo Points: recommendation only; BEFORE, WORK, AFTER, and MONITORING phases are reviewed without automatically creating a photo point.
- Recurring review: completed work may create maintenance, repeat-photo, pre-showing, post-storm, monitoring, or additional-reveal candidates, but nothing is sold or scheduled automatically.

## Regression example

`pearson-road-examples.js` is explicitly labeled `PEARSON-LIKE REGRESSION INPUT — NOT SOURCE EVIDENCE`. It tests creek access, light and heavy brush, a candidate homesite, a measured path, an unmeasured northwest path, mature-tree preservation, completed work missing AFTER evidence, water/culvert monitoring, a significant storm, and a professional handoff.

The generic engine does not contain Pearson-specific rules.
