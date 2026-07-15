# 🍽️ Gastro-Imperium

Ein hochwertiges 3D-Idle-Tycoon rund um die Gastronomie: Vom Imbisswagen über Pizzeria,
Sushi-Bar und Kreuzfahrtschiff bis zum Flughafen, zur Megacity — und unendlich weiter.

**Komplett kostenlos, kein Echtgeld, keine Werbung, kein Ende.** Nur zum Spielen und Zuschauen.

## Spielen

Einfach **`index.html` doppelklicken** — das Spiel läuft direkt im Browser, komplett offline.

## Features

- 🏙️ Stilisierte 3D-Welt mit 15 einzigartigen, handgebauten Betrieben (drehendes Riesenrad,
  schaukelndes Kreuzfahrtschiff, rotierender Casino-Würfel, kreisendes Flugzeug …) und
  danach unendlich vielen prozeduralen Expansionen
- 🚶 Lebendige Straße: Gäste mit Ärmchen, Augen und Hüten, Personal vor den Betrieben,
  Lieferautos, Drohnen, Vögel, Dampf, Konfetti, Trinkgeld-Münzen
- 🌗 Tag/Nacht-Zyklus mit Sonne, Mond, Sternen, Neonlicht und Lichterketten
- 👥 **Personal & Manager** je Betrieb (+30 % je Mitarbeiter, ×2,5 durch Manager) — sichtbar vor der Tür
- 🔬 **Upgrade-Baum** mit 7 Familien und unendlichen Stufen: Kochtempo, Trinkgeld, Werbung,
  Tempo, Deko (verschönert sichtbar die Straße), Lieferdienst, Drohnen
- 😊 **Zufriedenheits-System**: Deko + Team steigern die Laune der Gäste = mehr Einkommen
- 🏆 **Erfolge** mit unendlich generierten Stufen — jede gibt dauerhafte Boni
- 🎉 Meilenstein-Boni (Level 10/25/50/100/200 …), Gebäude wachsen sichtbar mit
- 🧐 Zufalls-Events (Foodkritiker, Happy Hour, Reisebus, Gastro-Preis …)
- ⭐🥄 **Zwei Prestige-Ebenen**: Michelin-Sterne (+2 % je) und Goldene Löffel (Verdopplung je Löffel)
- 💾 Autosave, Offline-Einnahmen, Spielstand-Export/-Import (⚙️-Menü)
- 🎵 Prozedurale Lo-Fi-Hintergrundmusik + dezente Soundeffekte (WebAudio, keine Dateien)
- ⚡ Adaptive Grafikqualität, korrektes sRGB-Farbmanagement, ACES-Tonemapping, weiche Schatten

## Neu in V3

- 👥 **Mitarbeiter als Charaktere**: Bewerber-Auswahl (3 Kandidaten), Name, Rolle, Seltenheit,
  Spezialfähigkeit, Marotte, Level & Erfahrung (auch offline), Team-Album
- 🎯 **Ziele-Tab**: 3 Tagesaufgaben pro Tag + 26 Karriere-Meilensteine mit Belohnungen
- 🏙️ **Ruf-Ränge**: Straßenstand → Legendäres Gastro-Imperium, mit großer Inszenierung,
  dauerhaften Boni und Freischaltungen (2×/4×-Tempo)
- 🌦️ **Wetter**: Regen (Lieferdienst boomt, sichtbarer Niederschlag), Hitzewelle (Getränke!)
- ⏸ **Spieltempo**: Pause / 1× / 2× / 4× (durch Ruf freischaltbar, nie durch Geld)
- 🔢 Zahlenformat wählbar (kurz / ausgeschrieben / wissenschaftlich)
- 💾 Save v3 mit Sicherungskopie + automatischer Migration alter Stände
- 🛠️ Debug-/Balancing-Panel per `?debug`, zentrale CONFIG in data.js

## Steuerung

- **Ziehen**: Kamera drehen · **Scrollen**: Zoomen · **Klick auf Gebäude**: Bonus-Schub
- **🎮 Controller**: linker Stick Kamera, rechter Stick Zoom, ✕ Auswählen, ○ Zurück, L1/R1 Tabs, Steuerkreuz Fokus, Options Einstellungen (Tastenhinweise erscheinen automatisch)
- **Tastatur**: Leertaste Pause, 1–4 Tabs, Enter startet vom Titelbildschirm
- Oben rechts: Kaufmenge (×1/×10/×25/×100/Max), Einstellungen, Hilfe, Prestige
- Unten Mitte: Spieltempo ⏸/1×/2×/4×
- Panel-Tabs: 🏪 Betriebe · 🔬 Upgrades · 🎯 Ziele · 🏆 Boni

## Projektstruktur

| Datei | Verantwortung |
|---|---|
| `index.html` | Einstieg, lädt Module in fester Reihenfolge |
| `css/style.css` | komplette UI-Gestaltung |
| `js/util.js` | Formatierung, Mathe, Geometrie-Helfer (abgerundete Boxen) |
| `js/data.js` | **Alle Spieldaten/Balancing**: Betriebe, Upgrades, Erfolge |
| `js/state.js` | Spielstand, Save/Load, Migration, Export/Import (Cloud-vorbereitet) |
| `js/economy.js` | Werte, Tick, Käufe, Events, Erfolge, 2-stufiges Prestige |
| `js/audio.js` | prozedurale Musik + SFX |
| `js/scene.js` | Renderer, Licht, Himmel, Umgebung, Kamera |
| `js/fx.js` | Partikel (Geld, Münzen, Konfetti, Dampf, Sprechblasen) |
| `js/actors.js` | Gäste, Personal-Figuren, Autos, Drohnen, Vögel |
| `js/buildings.js` | 15 Gebäude-Baupläne + Animationen |
| `js/ui.js` | HUD, Tabs, Karten, Modals, Toasts |
| `js/main.js` | Start & Hauptschleife |
| `three.min.js` | Three.js r147 (vendored) |
