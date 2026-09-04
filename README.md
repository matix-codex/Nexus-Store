# Nexus Store

De aparte appstore voor [Nexus Hub](https://github.com/matix-codex/Nexus-Hub), met een eigen catalogus en pakketversies. Een pakketupdate heeft geen nieuwe Nexus-installer nodig.

## Collectie

12 uitbreidingen: World Clock, Focus List, Quick Calc, Countdown, Session Stopwatch, Breathing Space, Wikipedia, Twitch en de thema's Obsidian, Ocean Blue, Sunset en Rose Quartz.

Open **Nexus Store** in Nexus Hub 1.3.0 of nieuwer. Installeer een pakket, open het of voeg het toe aan het dashboard. Onder **Updates** werk je elk pakket apart bij. De store controleert bij opstarten en elke zes uur op nieuwe pakketten; installeren en bijwerken start je zelf.

## Pakket bijwerken

1. Maak een nieuw bestand in `packages/<id>/<versie>.nexus.json`. Gebruik een hogere stabiele versie, bijvoorbeeld `1.0.1`. Behoud oude versiebestanden.
2. Pas inhoud en versie aan. `id` blijft hetzelfde; lokale gegevens zijn aan die ID gekoppeld.
3. Voer `node tools/catalog.mjs --write` uit. De catalogus kiest per ID de hoogste versie en berekent SHA-256 en bestandsgrootte.
4. Commit pakket en catalogus samen naar de **main**-branch. CI valideert de catalogus. Nexus toont daarna de update, onafhankelijk van de desktoprelease.

## Nieuwe pakketten

Een `.nexus.json` bevat `schema: 1`, `id`, `version`, `minNexus`, `name`, `description`, `author`, `kind`, `accent`, `permissions` en `content`.

- `kind`: `app`, `widget`, `tool` of `theme`.
- Lokale apps/widgets/toepassingen: `content: { type: "sandbox", height: 320, html: "<!doctype html>..." }`. De HTML bevat eigen inline CSS en JavaScript. Geen externe afhankelijkheden; maximaal 1 MB per pakket.
- Webapps: `content: { type: "web", url: "https://..." }` met `permissions: ["web"]`. De online dienst opent in een afzonderlijk, afgeschermd Nexus-appvenster. Dit is geen herdistributie van Windows-software.
- Thema's: `content: { type: "theme", palette: { accent, background, panel, text, muted } }`. Elke kleur is een zescijferige hexkleur.
- Lokale opslag is optioneel: `permissions: ["storage"]`. Gebruik het berichtenprotocol hieronder; maximaal 64 KB eigen JSON-gegevens per pakket.

## Lokale opslag

Verzend vanuit het widgetframe naar `parent.postMessage({ channel: "nexus-extension-v1", requestId, action: "load" }, "*")` of `{ channel: "nexus-extension-v1", requestId, action: "save", value }`. Nexus antwoordt aan datzelfde frame met `{ channel: "nexus-extension-response", requestId, value }` of `error`. Controleer `event.source === parent`. Focus List en Countdown bevatten een complete Promise-wrapper (`nexusStorage.load()` / `nexusStorage.save(value)`).

Een frame kan uitsluitend eigen opslag gebruiken. Het heeft geen Nexus-bridge, toegang tot andere pakketten, chatberichten, bestanden, shellcommando's of netwerk. Webapps hebben hun eigen Electron-sessie. Installeer code uitsluitend uit een beoordeelde catalogus; een sandboxwidget kan zijn eigen weergave en processorbelasting beïnvloeden.

Verwijderen haalt het pakket uit Nexus en je dashboard; eigen opslag blijft behouden voor herinstallatie. Updates worden eerst gecontroleerd en daarna atomair vervangen. Een foutieve download laat de vorige werkende versie intact. Pakketten met een hogere `minNexus` worden pas installeerbaar na een Nexus-update.

## Validatie

`node tools/catalog.mjs` valideert alle manifesten, versievolgorde, catalogusverwijzingen, checksums en bestandsgroottes. Hiervoor is alleen Node.js 24 nodig. Geen npm-installatie of GitHub-token in de Nexus-client.

Nexus Store-pakketten worden apart bijgewerkt. De geïnstalleerde Windows-versies van Spotify, WhatsApp en Discord gebruiken hun eigen officiële updater.
