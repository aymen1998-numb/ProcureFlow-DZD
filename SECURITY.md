# Security & Hardening

## Authentication & Authorization
1. **Firebase Authentication**: Secures the platform identity.
2. **Tenant Isolation**: Multi-tenant architecture. Every document includes a `tenantId` property. Users can only access data where `tenantId` matches their verified token's `tenantId`.
3. **Role-Based Access Control (RBAC)**: User roles (`admin`, `production`, `magasinier`) dictate UI visibility and Firestore read/write capabilities.

## Firestore Rules Engine (Zero-Trust)
Our `firestore.rules` file enforces security at the edge:
1. **Master Gate**: Access is blocked by default (`match /{document=**} { allow read, write: if false; }`).
2. **Schema Enforcement**: Update and Create operations are gated by validation helpers (`isValidId`, explicit size and type checks) preventing schema poisoning.
3. **Data Isolation**: Read operations explicitly restrict data fetches to the user's `tenantId`.
4. **Denial of Wallet Protection**: Strings and collections are bounded by size limits to prevent malicious massive payload injections.

## Error Handling & Stability
1. **Error Boundaries**: A global `ErrorBoundary` prevents the whole React tree from crashing when a single module fails.
2. **Sanitized Inputs**: Search arrays and payloads are validated on the client and enforced heavily on the backend rules.
3. **Graceful Degradation**: If real-time connectivity fails, the app alerts the user and caches locally where permitted.

## Audit Logging
- Critical operations (e.g., inventory adjustments, OF completion) create immutable records in `stock_movements`.
- These logs cannot be deleted by standard users, ensuring traceability.
