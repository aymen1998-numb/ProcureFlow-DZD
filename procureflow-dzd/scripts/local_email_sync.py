#!/usr/bin/env python3
"""
ProcuraFlow Local Email Sync Script
===================================
Runs 100% locally on your laptop. Connects to your email via standard IMAP (Gmail, Outlook, or corporate mail)
with ZERO cloud AI API dependencies.

Outputs: local_emails.json (which you can drag & drop or import directly into ProcuraFlow).

Usage:
  python local_email_sync.py
"""

import imaplib
import email
from email.header import decode_header
import json
import os
import re
from datetime import datetime

IMAP_SERVER = os.environ.get("IMAP_SERVER", "imap.gmail.com")
IMAP_PORT = int(os.environ.get("IMAP_PORT", 993))
EMAIL_USER = os.environ.get("EMAIL_USER", "")
EMAIL_PASS = os.environ.get("EMAIL_PASS", "")

OUTPUT_FILE = "local_emails.json"

def clean_header(header_val):
    if not header_val:
        return ""
    decoded_parts = decode_header(header_val)
    result = []
    for part, enc in decoded_parts:
        if isinstance(part, bytes):
            result.append(part.decode(enc or 'utf-8', errors='ignore'))
        else:
            result.append(str(part))
    return "".join(result).strip()

def get_body_and_attachments(msg):
    body = ""
    has_attachments = False

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in disposition.lower():
                has_attachments = True
                continue

            if content_type == "text/plain" and not body:
                payload = part.get_payload(decode=True)
                if payload:
                    body = payload.decode(errors="ignore")
            elif content_type == "text/html" and not body:
                payload = part.get_payload(decode=True)
                if payload:
                    raw_html = payload.decode(errors="ignore")
                    # simple tag removal
                    body = re.sub(r'<[^>]+>', ' ', raw_html)
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode(errors="ignore")

    return body.strip(), has_attachments

def sync_local_emails():
    print("=" * 60)
    print("  ProcuraFlow - Local Email Synchronization")
    print("  100% Local Processing on your Laptop")
    print("=" * 60)

    user = EMAIL_USER
    password = EMAIL_PASS

    if not user or not password:
        print("\nVeuillez renseigner vos identifiants pour l'accès local IMAP:")
        print("(Pour Gmail, utilisez un 'Mot de passe d'application' depuis myaccount.google.com/apppasswords)")
        user = input("Adresse email: ").strip()
        password = input("Mot de passe (ou mot de passe d'application): ").strip()

    if not user or not password:
        print("Erreur: identifiants requis.")
        return

    print(f"\nConnexion sécurisée à {IMAP_SERVER}:{IMAP_PORT}...")
    try:
        mail = imaplib.IMAP4_SSL(IMAP_SERVER, IMAP_PORT)
        mail.login(user, password)
        print("✓ Connexion établie avec succès !")
    except Exception as e:
        print(f"✗ Échec de connexion IMAP: {e}")
        return

    mail.select("INBOX")
    # Search for recent emails or procurement keywords
    status, messages = mail.search(None, "ALL")
    if status != "OK":
        print("✗ Impossible de lister la boîte de réception.")
        return

    msg_ids = messages[0].split()
    total_found = len(msg_ids)
    print(f"Messages trouvés : {total_found}. Récupération des 50 plus récents...")

    # Take last 50
    selected_ids = msg_ids[-50:]
    selected_ids.reverse()

    parsed_emails = []

    for idx, mid in enumerate(selected_ids, 1):
        try:
            res, data = mail.fetch(mid, "(RFC822)")
            if res != "OK":
                continue

            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = clean_header(msg.get("Subject"))
            sender = clean_header(msg.get("From"))
            to = clean_header(msg.get("To"))
            date_str = clean_header(msg.get("Date"))

            # extract raw email from From
            email_match = re.search(r'<([^>]+)>', sender) or re.search(r'([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)', sender)
            from_email = email_match.group(1) if email_match else sender

            body, has_attachments = get_body_and_attachments(msg)
            snippet = (body[:140] + "...") if len(body) > 140 else body

            parsed_emails.append({
                "id": f"imap-{mid.decode()}-{int(datetime.now().timestamp())}",
                "threadId": f"thread-{mid.decode()}",
                "subject": subject or "(Sans objet)",
                "from": sender,
                "fromEmail": from_email,
                "to": to or user,
                "date": date_str,
                "timestamp": int(datetime.now().timestamp() * 1000),
                "snippet": snippet,
                "body": body,
                "labelIds": ["INBOX", "LOCAL_IMAP"],
                "unread": False,
                "hasAttachments": has_attachments
            })

            print(f" [{idx}/{len(selected_ids)}] {subject[:50]}...")
        except Exception as err:
            print(f"  Erreur message {mid}: {err}")

    mail.close()
    mail.logout()

    # Save to JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(parsed_emails, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"✓ {len(parsed_emails)} e-mails synchronisés avec succès dans '{OUTPUT_FILE}' !")
    print("Vous pouvez maintenant importer ce fichier directement dans ProcuraFlow")
    print("via le bouton 'Importer E-mails Locaux' dans l'onglet 'Suivi Gmail & DHL'.")
    print("=" * 60)

if __name__ == "__main__":
    sync_local_emails()
