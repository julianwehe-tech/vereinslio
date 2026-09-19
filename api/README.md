# VereinsLio-Controlplane

Die Controlplane nimmt eine Buchung entgegen, speichert die Einrichtungsdaten in PostgreSQL, legt ein optionales Vereinslogo in einem **privaten** Cloudflare-R2-Bucket ab und aktiviert den Verein erst nach der bestätigten Zahlungsart.

PostgreSQL ist die führende Datenbank. Cloudflare Hyperdrive verbindet den Worker mit einer bereits eingerichteten PostgreSQL-Instanz; R2 ersetzt keine relationale Datenbank und enthält nur Dateiobjekte. Der Browser erhält nie einen R2-Schlüssel oder eine öffentliche Bucket-URL.

## Einrichten

1. PostgreSQL bereitstellen und `schema.sql` einmalig ausführen.
2. In Cloudflare einen privaten Bucket `vereinslio-club-files` anlegen. Keine öffentliche Bucket-Domain und kein `r2.dev` aktivieren.
3. Einen Hyperdrive für die PostgreSQL-Verbindung anlegen und die erzeugte ID in `wrangler.jsonc` ersetzen.
4. Die in `.dev.vars.example` aufgeführten Geheimnisse als Worker-Secrets setzen. Die Datei selbst enthält nur Platzhalter und wird nicht verwendet.
5. Den produktiven App-Provisionierungsendpunkt absichern. Er erhält nach einer bestätigten Zahlung ausschließlich den serverseitigen Request mit dem Onboarding-Datensatz und muss idempotent sein.
6. Worker deployen, `api.vereinslio.de` als Custom Domain hinterlegen und die Buchungsseite auf diesen API-Ursprung konfigurieren.

## Zahlungsablauf

- **PayPal:** Der Worker erstellt eine abonnementgebundene Freigabe. PayPal-Webhooks werden bei PayPal geprüft, dedupliziert und erst dann wird die Plattform eingerichtet.
- **Rechnung:** Der Datensatz bleibt `INVOICE_PENDING`, bis die Rechnungsfreigabe vom Abrechnungssystem bestätigt wurde. Eine Rechnung darf keinen Zugang vor dieser Bestätigung freischalten.

## Datenschutz und Betrieb

Logos liegen verschlüsselt im privaten R2-Bucket; Metadaten, Identitäten, Vertrags- und Onboardingdaten liegen in PostgreSQL. Der Datenbankbetrieb braucht Backups, Wiederherstellungstest, Löschkonzept, Auftragsverarbeitung und eine dokumentierte Datenregion, bevor reale Vereine angebunden werden.
