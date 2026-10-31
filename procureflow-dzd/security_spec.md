# Security Specification - ProcureFlow

## Data Invariants
1. A Purchase must be assigned to a valid buyer (userId).
2. Only Admins can see all purchases; Buyers see only their own.
3. Documents and Payments must correspond to a parent Purchase document.
4. Users cannot change their own roles (escalation protection).
5. Immutable fields like `createdAt` and `buyerId` must remain unchanged after creation.

## The Dirty Dozen (Attack Payloads)

1. **Identity Spoofing**: Attempt to create a purchase where `buyerId` is someone else's UID.
2. **Privilege Escalation**: Attempt to update a user's own profile to set `role: "admin"`.
3. **Ghost Field Injection**: Adding a `verified: true` field to a purchase which isn't in the schema.
4. **Invalid Type Poisoning**: Setting `totalAmount` as a string "Billion" instead of a number.
5. **ID Poisoning**: Creating a purchase with a document ID that is a 2KB string of garbage.
6. **Relation Bypass**: Creating a document in `/purchases/NON_EXISTENT_ID/documents/doc1`.
7. **Negative Amount**: Setting `totalAmount: -1000` to manipulate accounting.
8. **Statue Shortcutting**: Moving a purchase from `draft` directly to `completed` without intermediate approvals.
9. **Timestamp Forgery**: Proving a `createdAt` date in the past to appear older than it is.
10. **Anonymous Write**: Attempting to create a purchase without being authenticated.
11. **Cross-Buyer Read**: Buyer A attempting to `get` a purchase belonging to Buyer B.
12. **Collection Scraping**: Authenticated user attempting a blanket `list` of all users to harvest emails.

## Test Runner Plan
I will implement `firestore.rules.test.ts` to verify these rejection scenarios.
