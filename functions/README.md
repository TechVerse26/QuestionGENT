# functions/ — reference only

These Cloud Functions (AI generation, SSLCommerz payments) **cannot be deployed on the free Firebase (Spark) plan**, and this project runs at zero cost.
They are kept as the reference implementation and are being ported to server route handlers (Next.js) that use the Firebase Admin SDK.
Do not run `firebase deploy` for functions. See `docs/phase-2/00-ZERO-COST-ADDENDUM.md`.
