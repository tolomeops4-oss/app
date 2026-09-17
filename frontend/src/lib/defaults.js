export const DEFAULT_CONFIG = {
  interRow: 4.0,
  interPlant: 1.5,
  headland: 10.0,
  sideMargin: 2.0,
  minSegment: 30.0,
  variety: "Arbequina",
};

export const DEFAULT_IRRIGATION = {
  linesPerRow: 1,
  emitterFlow: 1.5,
  emitterSpacing: 0.5,
  pressure: 1.0,
  pipeType: "PC",
  sectorMode: "auto",
  numSectors: 2,
  pumpCapacity: 20.0,
  manualAssignments: {},
};

export const VARIETIES = [
  "Arbequina",
  "Arbosana",
  "Lecciana",
  "Coratina",
  "Favolosa",
  "Koroneiki",
  "Leccino Nano",
  "Oliana",
];

export const OBSTACLE_TYPES = [
  { id: "palo", label: "Palo / Traliccio", along: 2.0, side: 1.5 },
  { id: "fabbricato", label: "Fabbricato / Casolare", along: 5.0, side: 3.0 },
  { id: "pozzo", label: "Pozzo / Vasca", along: 3.0, side: 2.0 },
  { id: "roccia", label: "Roccia / Incolto", along: 3.0, side: 2.0 },
  { id: "albero", label: "Albero Monumentale", along: 4.0, side: 3.0 },
];

export const NETWORK_ELEMENT_TYPES = [
  { id: "pozzo", label: "Punto Acqua / Pozzo", symbol: "◎" },
  { id: "pompa", label: "Pompa", symbol: "⚙" },
  { id: "filtro", label: "Filtrazione / Fertirrigazione", symbol: "⌘" },
  { id: "valvola", label: "Elettrovalvola Settore", symbol: "▣" },
];

export const TILE_LAYERS = [
  {
    id: "google_hybrid",
    name: "Google Ibrido",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "© Google",
    maxZoom: 21,
  },
  {
    id: "google_satellite",
    name: "Google Satellite",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "© Google",
    maxZoom: 21,
  },
  {
    id: "esri",
    name: "Esri World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  },
];

export const QUICK_LOCATIONS = [
  { label: "San Pietro Vernotico (BR)", lat: 40.4917, lng: 17.9975, zoom: 16 },
  { label: "Fasano (BR)", lat: 40.8339, lng: 17.3606, zoom: 15 },
  { label: "Bari", lat: 41.1171, lng: 16.8719, zoom: 13 },
  { label: "Andria", lat: 41.2270, lng: 16.2953, zoom: 14 },
  { label: "Lecce", lat: 40.3515, lng: 18.1750, zoom: 14 },
  { label: "Sciacca (AG)", lat: 37.5089, lng: 13.0810, zoom: 14 },
];
