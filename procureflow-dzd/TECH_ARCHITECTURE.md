# Technical Architecture

## Overview
The platform is a Serverless SaaS application built for manufacturing and production management, utilizing React (Vite) for the frontend and Firebase for the backend.

## Frontend Architecture
- **Framework**: React 18 with Vite.
- **Styling**: Tailwind CSS for utility-first styling.
- **Routing**: React Router DOM.
- **State Management**: React state hooks (`useState`, `useReducer`), standard context for global providers (Auth).
- **Animations**: `motion/react` for fluid transitions.
- **Icons**: `lucide-react`.

## Backend Architecture (Firebase)
- **Database**: Firestore (NoSQL) for transactional and relational data.
- **Authentication**: Firebase Auth (Email/Password, Google).
- **Rules**: Deeply nested, attribute-based access control (ABAC) in `firestore.rules`.
- **Realtime**: Heavy use of `onSnapshot` for reactive UI updates across devices.

## Data Models
1. `tenant_settings`: Global configuration per tenant.
2. `users`: User profiles and roles.
3. `products`: Both finished goods (`type: 'product'`) and raw materials (`type: 'raw_material'`).
4. `boms`: Bills of Materials defining the recipe for finished products.
5. `production_orders`: Tracking manufacturing processes from draft to completion.
6. `purchase_requests`, `pos` (Purchase Orders): Procurement and supply chain.
7. `stock_movements`: Immutable log of every inventory adjustment.

## Modularity & Extensibility
The platform is built on a modular "tab" system inside the Dashboard. Adding new features (like QC, Maintenance, or HR) simply requires creating a new component and adding it to the lazy-loaded routing map.
