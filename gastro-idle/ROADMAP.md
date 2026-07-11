# Gastro-Imperium — Analyse & Roadmap

## Ist-Stand (V3)

**Architektur:** 13 klar getrennte Module (`js/`), Balancing zentral in `data.js`/`CONFIG`,
Save-Versionierung v1→v2→v3 mit automatischer Migration + Backup-Slot, Simulation und
Präsentation getrennt (Spieltempo wirkt nur auf die Simulation).

**Systeme:** 15 handgebaute Betriebe + unendliche Expansion · Mitarbeiter als Charaktere
(Name, Rolle, Seltenheit, Eigenschaft mit Spieleffekt, Marotte, Level/XP, Bewerber-Auswahl)
· Manager · 7 Upgrade-Familien · Zufriedenheit · Erfolge · Tagesaufgaben · 26+ Meilensteine
· 8 Ruf-Ränge mit Inszenierung & Freischaltungen (2×/4×-Tempo) · Wetter mit Gameplay-Wirkung
· Events · 2 Prestige-Ebenen · Offline-Bilanz · Tag/Nacht · Lieferautos/Drohnen/Vögel.

**Komfort/Technik:** Pause/1×/2×/4×, Kaufmengen ×1/×10/×25/×100/Max, 3 Zahlenformate,
getrennte Lautstärken, reduzierte Effekte, Export/Import, Debug-Panel (`?debug`),
adaptive Grafikqualität, Objekt-Pooling für alle Partikel.

## Nächste Phasen (priorisiert)

### Phase 4 — Spezialisierung & Entscheidungen
- Pro Betrieb eine Ausrichtung wählen (Fast-Food / Gourmet / Lieferfokus) mit echten
  Vor-/Nachteilen (Tempo vs. Trinkgeld vs. Wetterresistenz), sichtbar an Deko/Schild
- Rezept-Slots je Betrieb: 3 Gerichte aus einem Pool wählen (Beliebtheit ↔ Marge ↔ Tempo)

### Phase 5 — Herausforderungen & Konkurrenz
- Freundliche Konkurrenz-Betriebe auf der gegenüberliegenden Straßenseite mit
  Wochen-Duellen („Verkaufe mehr Gerichte als Bruno's Bude") — Belohnung, nie Bestrafung
- Reagierbare Mini-Störungen (Ofen streikt → Klick-Minispiel repariert schneller;
  gute Wartungs-Upgrades verhindern sie)

### Phase 6 — Regionen (Städte-Prestige)
- Nach Rang 8: Umzug in Region 2 „Küstenstadt" (neue Palette, Strand statt Park,
  Möwen statt Vögel, neue Betriebsnamen) — RANKS/VENUES sind bereits datengetrieben,
  Regionen = Daten-Preset + Env-Theme
- Betriebe der alten Region laufen automatisiert weiter (passives Einkommen)

### Phase 7 — Steuerung & Zugänglichkeit
- Gamepad-API: Fokus-Navigation im Panel, Stick-Kamera, Trigger-Zoom, Symbol-Anzeige
- UI-Skalierung, Farbenblind-Paletten, Untertitel für Sound-Ereignisse

### Phase 8 — Feinschliff
- Fotomodus (UI ausblenden + freie Kamera), Analyse-Panel mit Engpass-Empfehlungen,
  Wochenziele, Charakter-Miniszenen zwischen Mitarbeitern (Beziehungen/Synergien)
