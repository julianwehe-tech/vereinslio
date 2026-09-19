# Vereinslio Produktseite

Statische Marketingseite für `vereinslio.de`. Sie läuft über GitHub Pages und verarbeitet keine Registrierungen, Cookies oder Analyse-Daten.

`/demo/` ist ein vollständig eingerichteter, interaktiver Testverein mit ausschließlich synthetischen Daten. Aktionen in der Demo bleiben im Browser und werden beim Neuladen zurückgesetzt.

`/buchen/` führt Tarif, Vereinsdaten, erste Administration, optionales Logo und Zahlungsart in drei Schritten zusammen. Der produktive Abschluss wird über die unter [`api/`](api/README.md) angelegte Controlplane abgewickelt: PostgreSQL enthält die fachlichen Onboardingdaten, Cloudflare R2 ausschließlich private Dateiobjekte. PayPal-Freigaben und Webhooks laufen ausschließlich auf dem Server; eine Rechnungsbuchung bleibt bis zur bestätigten Rechnungsfreigabe gesperrt.

Die API ist bewusst noch nicht an die öffentliche Produktseite gebunden: In Cloudflare gibt es aktuell weder den nötigen R2-Bucket noch eine Hyperdrive-Konfiguration für eine separate PostgreSQL-Instanz. Erst nach dieser Infrastruktur- und Secret-Konfiguration darf die Buchungsseite reale Vereinsdaten senden oder eine Zahlung freigeben.
