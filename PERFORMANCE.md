# Performance Optimization Notes

## Frontend Optimizations
1. **Lazy Loading & Code Splitting**: 
   - `React.lazy()` and `Suspense` are used to split heavy components (like tables, dashboards, and production modules). This drastically reduces the initial main bundle size.
2. **Memoization**: 
   - Uses `React.memo`, `useMemo`, and `useCallback` on heavy rendering lists and expensive calculations (e.g., pivot tables and variance calculations).
3. **Pagination**:
   - Implemented client-side and server-side pagination to limit DOM nodes.
4. **Debouncing**:
   - Implemented debounced search inputs to prevent aggressive Firestore querying and re-rendering.
5. **Asset Optimization**:
   - SVG icons from `lucide-react` are tree-shaken.

## Backend / Database Optimizations (Firestore)
1. **Query Optimization**: 
   - Queries are structured to retrieve only relevant tenant data (`where('tenantId', '==', tenantId)`).
   - Real-time listeners (`onSnapshot`) are cleaned up meticulously in `useEffect` return statements to prevent memory leaks and zombie connections.
2. **Index Management**: 
   - Composite indexes are built for complex queries (e.g., `tenantId` + `createdAt` DESC).
3. **Read Minimization**: 
   - Avoids reading full arrays for simple existence checks. Relational aggregations are stored incrementally (e.g., `actualQuantity`) instead of calculating from scratch on every load.

## Future Improvement Roadmap
- Add virtualization (e.g., `@tanstack/react-virtual`) if datasets exceed 10,000 rows.
- Transition aggressive `onSnapshot` queries to `get()` + polling or cache if real-time updates are not strictly necessary to save document read costs.
