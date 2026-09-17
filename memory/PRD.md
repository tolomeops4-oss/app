# Progetto Oliveto - PRD

## Problem Statement
Applicazione web professionale, responsive (desktop + smartphone) chiamata "Progetto Oliveto" (Pianificatore Cartografico Impianti Oliveto Superintensivo e Irrigazione). Pianifica e squadra nuovi impianti agricoli su mappa satellitare gestendo perimetri reali, sesto d'impianto, capezzagne differenziate, ostacoli, orientamento delle file, calcolo delle piante e rete di irrigazione a goccia.

## Stack
- Frontend: React + Tailwind + shadcn/ui + Leaflet + Turf.js + jsPDF + html2canvas
- Backend: FastAPI + MongoDB (Motor)
- No auth (open app)
- Client-side PDF via jsPDF + html2canvas
- Persistence: MongoDB CRUD via `/api/fields`

## User Personas
- Agronomo / progettista impianti superintensivi
- Titolare azienda agricola con smartphone in campo
- Tecnico irrigazione a goccia

## Core Requirements (Static)
1. Mappa Leaflet full-screen con 4 tile layers (Google Hybrid, Google Satellite, Esri, OSM)
2. Barra strumenti touch con azioni in italiano
3. Multi-campo con drawer laterale
4. Parametri sesto d'impianto configurabili
5. Ostacoli con fasce di rispetto asimmetriche
6. Motore geometrico Turf.js con clipping su poligono
7. Bussola azimut interattiva + ottimizzazione automatica (5° / 1°)
8. Modulo irrigazione a goccia con settori e calcoli idraulici
9. Pannello Risultati con esportazioni GeoJSON/CSV/PDF

## Implemented (2026-02-XX)
- Backend CRUD completo `/api/fields` (list/create/get/update/delete/duplicate)
- Frontend: mappa Leaflet stabile con ref, tile layer switching, 4 sorgenti
- Toolbar touch con 8 pulsanti (Nuovo Campo, Annulla, Chiudi/Salva, Ostacolo, Elimina, Sposta, GPS, Ottimizza)
- Multi-campo drawer (crea, rinomina, duplica, elimina, selezione)
- Configurazione sesto d'impianto con slider + input (interfilare, distanza piante, capezzagne, margini, min segmento, varietà)
- Ostacoli tipo punto con buffer asimmetrico along/side; lista modificabile
- Motore geometrico: Turf.js, clipping orizzontale in frame ruotato, trim capezzagna, plants placement
- Bussola azimut: slider 0-359, ottimizzazione 5° e 1°
- Irrigazione: parametri completi, calcolo m³/h per settore, mm equivalenti, avviso pompa superata
- Esportazioni GeoJSON, CSV filari, CSV piante, PDF con mappa snapshot
- Ricerca Nominatim + coordinate + preset località italiane
- UI dark tactical HUD glassmorphism, palette olivo/terra/emerald

## Prioritized Backlog (P0/P1/P2)
- P1: Poligoni ostacoli (multi-vertex) via tool separato
- P1: Modifica interattiva vertici drag (attualmente solo click per eliminare)
- P1: Rete irrigazione: posizionamento elementi (pozzo, pompa, valvole) direttamente su mappa
- P2: Assegnazione manuale settori per filare (UI)
- P2: Editing perimetro post-chiusura (aggiunta vertici intermedi con doppio tap edge)
- P2: Import GeoJSON / KML

## Next Tasks
- Test end-to-end con testing_agent
- Ottimizzazione mobile bottom-sheet
