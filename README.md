# ProcureFlow-DZD

Web application for managing local purchasing (DZD), international import files (EUR / USD), stock movements, and supplier communications across warehouse units.

## Features

- **Purchase Requests & Local Orders (DA / BC)**: Track internal purchase requests from warehouse/production units and convert them into local purchase orders in DZD.
- **International Purchases (Import Dossiers)**: Follow import files, landed cost estimates, customs D10 archives, financing structures (cash, leasing, or 20/80 bank financing), and document checklists (Commercial Invoice, Bill of Lading, Certificate of Origin, Packing List).
- **Bank Payment Files (DHL Tracking)**: Track DHL waybill numbers used for sending payment dossiers and original trade documents to the bank, with automatic detection from incoming supplier/bank emails and 3-day inactivity reminders.
- **Inventory & Production**: Manage finished goods, raw materials, bills of materials (BOM), production orders, and inter-unit stock transfers.
- **Roles & Permissions**: Multi-unit access for buyers, international buyers, warehouse keepers (`magasinier`), finance, and admins.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend / Database**: Firebase Authentication & Cloud Firestore (with local IndexedDB offline persistence)
- **Exports**: PDF (`jspdf`, `jspdf-autotable`) and Excel (`xlsx`)
- **Email Sync**: Gmail REST API (OAuth2), local `.eml`/`.mbox` file reader, and an optional Python IMAP script (`scripts/local_email_sync.py`)

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/aymen1998-numb/ProcureFlow-DZD.git
   cd ProcureFlow-DZD
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Update `.env` or `firebase-applet-config.json` with your Firebase project config.

3. Run the development server:
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:3000`.

4. Build for production:
   ```bash
   npm run build
   ```

## Updating `aymen1998-numb/ProcureFlow-DZD` on GitHub

Run `./push-to-github.sh` (macOS / Linux / Git Bash) or `push-to-github.bat` (Windows), or run:

```bash
git init -b main
git add .
git commit -m "Update ProcureFlow-DZD"
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/aymen1998-numb/ProcureFlow-DZD.git
git push -u --force origin main
```
