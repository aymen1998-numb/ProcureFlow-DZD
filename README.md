# Purchase Order Management System

A comprehensive web application for managing Purchase Orders (POs), deliveries, and invoicing.

## Features
- Create and manage purchase orders
- Track delivery statuses and record packing slips (BL)
- Generate and record final invoices (FF)
- PDF generation for orders, deliveries, and invoices
- Interactive dashboards and status tracking
- Role-based Google Auth Authentication

## Prerequisites
- Node.js (v18 or higher recommended)
- A Firebase Project (for Authentication and Database)

## Setup Instructions

1. **Install Dependencies**
   Run the following command to install the necessary packages:
   ```bash
   npm install
   ```

2. **Firebase Configuration**
   - Head to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
   - Enable **Firestore Database** and **Authentication** (Google Sign-In).
   - Register a Web App in your Firebase project to get your configuration.
   - Open the `firebase-applet-config.json` file in the root of the project and replace its contents with your own Firebase configuration keys:
   ```json
   {
     "projectId": "YOUR_PROJECT_ID",
     "appId": "YOUR_APP_ID",
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
     "firestoreDatabaseId": "(default)",
     "storageBucket": "YOUR_PROJECT_ID.firebasestorage.app",
     "messagingSenderId": "YOUR_SENDER_ID",
     "measurementId": "YOUR_MEASUREMENT_ID"
   }
   ```

3. **Deploy Firestore Security Rules**
   You can deploy the included `firestore.rules` to your Firebase project to secure your database:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore # Select your newly created project
   firebase deploy --only firestore:rules
   ```

## Running the Application

Start the local development server:
```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

## Building for Production

To build the application for deployment (e.g., to Vercel, Netlify, or Firebase Hosting), run:
```bash
npm run build
```
This will generate optimized static files in the `dist` directory.
