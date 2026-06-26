// Loyers meublés moyens au m² (données observatoires 2024-2025, arrondissement/quartier)
// Sources : OLAP, CLAMEUR, observatoires locaux, encadrement des loyers

// Paris : par arrondissement (code postal 750XX)
const PARIS_PAR_ARRONDISSEMENT: Record<number, number> = {
  1: 38, 2: 36, 3: 36, 4: 38,
  5: 38, 6: 42, 7: 40, 8: 35,
  9: 30, 10: 28, 11: 28, 12: 25,
  13: 24, 14: 26, 15: 27, 16: 30,
  17: 27, 18: 24, 19: 21, 20: 22,
};

// Lyon : par arrondissement (code postal 6900X)
const LYON_PAR_ARRONDISSEMENT: Record<number, number> = {
  1: 19, 2: 18, 3: 16, 4: 20,
  5: 17, 6: 20, 7: 15, 8: 14, 9: 15,
};

// Marseille : par arrondissement (code postal 130XX)
const MARSEILLE_PAR_ARRONDISSEMENT: Record<number, number> = {
  1: 16, 2: 13, 3: 12, 4: 13, 5: 12, 6: 17,
  7: 18, 8: 19, 9: 15, 10: 12, 11: 11, 12: 12,
  13: 11, 14: 11, 15: 10, 16: 10,
};

// Bordeaux : par secteur (code postal 3300X)
const BORDEAUX_PAR_QUARTIER: Record<string, number> = {
  "33000": 16, // Centre (Chartrons, Victoire)
  "33100": 14, // Caudéran
  "33200": 13, // Mérignac / Pessac
  "33300": 14, // Bacalan / Bassins
  "33400": 13, // Talence
  "33800": 13, // Bordeaux Sud
};

// Villes avec données par secteur de code postal
const LOYERS_PAR_CP: Record<string, number> = {
  // Nice et alentours
  "06000": 25, "06100": 22, "06200": 21, "06300": 19,
  // Toulouse
  "31000": 16, "31100": 14, "31200": 13, "31300": 13, "31400": 14, "31500": 15,
  // Nantes
  "44000": 16, "44100": 14, "44200": 14, "44300": 13,
  // Montpellier
  "34000": 17, "34070": 14, "34080": 13, "34090": 14,
  // Strasbourg
  "67000": 16, "67100": 14, "67200": 13,
  // Lille
  "59000": 17, "59100": 14, "59130": 13, "59160": 13, "59260": 12,
  // Rennes
  "35000": 17, "35200": 14, "35700": 13,
  // Grenoble
  "38000": 14, "38100": 12,
  // Annecy
  "74000": 21, "74600": 18,
  // Aix-en-Provence
  "13100": 19, "13290": 16,
  // Toulon
  "83000": 14, "83100": 13, "83200": 13,
  // Angers
  "49000": 14, "49100": 12,
  // Dijon
  "21000": 13,
  // Reims
  "51100": 12,
  // Tours
  "37000": 13, "37100": 12,
  // Metz
  "57000": 12, "57050": 11,
  // Nancy
  "54000": 13, "54100": 11,
  // Rouen
  "76000": 13, "76100": 12,
  // Clermont-Ferrand
  "63000": 12, "63100": 10,
  // Caen
  "14000": 13,
  // Perpignan
  "66000": 11,
  // Brest
  "29200": 11,
  // Limoges
  "87000": 10,
  // Pau
  "64000": 11,
  // Bayonne / Biarritz
  "64100": 16, "64200": 20,
  // La Rochelle
  "17000": 15,
  // Nîmes
  "30000": 12,
  // Avignon
  "84000": 13,
};

// Fallback par département
const LOYERS_PAR_DEPARTEMENT: Record<string, number> = {
  "75": 33, // Paris (fallback)
  "92": 22, // Hauts-de-Seine
  "93": 16, // Seine-Saint-Denis
  "94": 18, // Val-de-Marne
  "95": 15, // Val-d'Oise
  "78": 16, // Yvelines
  "91": 15, // Essonne
  "77": 14, // Seine-et-Marne
  "06": 20, // Alpes-Maritimes
  "13": 14, // Bouches-du-Rhône
  "69": 16, // Rhône
  "31": 13, // Haute-Garonne
  "33": 14, // Gironde
  "34": 14, // Hérault
  "44": 13, // Loire-Atlantique
  "67": 14, // Bas-Rhin
  "59": 14, // Nord
  "35": 14, // Ille-et-Vilaine
  "38": 13, // Isère
  "74": 18, // Haute-Savoie
  "83": 13, // Var
  "76": 12, // Seine-Maritime
  "57": 11, // Moselle
  "54": 11, // Meurthe-et-Moselle
};

export function estimerLoyerParAdresse(opts: {
  codePostal?: string;
  citycode?: string; // INSEE code ex: "75056"
  city?: string;
  surface: number;
}): { loyerM2: number; precision: "arrondissement" | "codePostal" | "departement" | "ville" } {
  const { codePostal, citycode, city, surface: _surface } = opts;

  // Paris : par arrondissement via code postal 750XX ou citycode
  if (codePostal?.startsWith("75") && codePostal.length === 5) {
    const arr = parseInt(codePostal.slice(3));
    if (arr >= 1 && arr <= 20 && PARIS_PAR_ARRONDISSEMENT[arr]) {
      return { loyerM2: PARIS_PAR_ARRONDISSEMENT[arr], precision: "arrondissement" };
    }
  }
  // citycode INSEE pour Paris (75101 = 1er, 75120 = 20e)
  if (citycode?.startsWith("751") && citycode.length === 5) {
    const arr = parseInt(citycode.slice(3));
    if (arr >= 1 && arr <= 20 && PARIS_PAR_ARRONDISSEMENT[arr]) {
      return { loyerM2: PARIS_PAR_ARRONDISSEMENT[arr], precision: "arrondissement" };
    }
  }

  // Lyon : par arrondissement
  if (codePostal?.startsWith("690") && codePostal.length === 5) {
    const arr = parseInt(codePostal.slice(3));
    if (arr >= 1 && arr <= 9 && LYON_PAR_ARRONDISSEMENT[arr]) {
      return { loyerM2: LYON_PAR_ARRONDISSEMENT[arr], precision: "arrondissement" };
    }
  }

  // Marseille : par arrondissement
  if (codePostal?.startsWith("13") && codePostal.length === 5) {
    const arr = parseInt(codePostal.slice(3));
    if (arr >= 1 && arr <= 16 && MARSEILLE_PAR_ARRONDISSEMENT[arr]) {
      return { loyerM2: MARSEILLE_PAR_ARRONDISSEMENT[arr], precision: "arrondissement" };
    }
  }

  // Bordeaux par quartier
  if (codePostal && BORDEAUX_PAR_QUARTIER[codePostal]) {
    return { loyerM2: BORDEAUX_PAR_QUARTIER[codePostal], precision: "codePostal" };
  }

  // Lookup par code postal exact
  if (codePostal && LOYERS_PAR_CP[codePostal]) {
    return { loyerM2: LOYERS_PAR_CP[codePostal], precision: "codePostal" };
  }

  // Fallback par département
  const dept = codePostal?.slice(0, 2) ?? "";
  if (dept && LOYERS_PAR_DEPARTEMENT[dept]) {
    return { loyerM2: LOYERS_PAR_DEPARTEMENT[dept], precision: "departement" };
  }

  // Fallback par nom de ville
  const v = (city ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const VILLES: Array<[string, number]> = [
    ["paris", 33], ["lyon", 18], ["marseille", 14], ["nice", 22], ["bordeaux", 15],
    ["toulouse", 15], ["nantes", 15], ["montpellier", 15], ["strasbourg", 15],
    ["lille", 16], ["rennes", 15], ["grenoble", 13], ["annecy", 20],
    ["aix", 18], ["toulon", 13], ["angers", 13], ["dijon", 12],
    ["reims", 12], ["tours", 12], ["metz", 12], ["nancy", 12],
    ["rouen", 12], ["clermont", 11], ["caen", 12], ["bayonne", 15],
    ["biarritz", 20], ["la rochelle", 14], ["pau", 11], ["nimes", 11],
    ["avignon", 12], ["brest", 11], ["limoges", 10], ["perpignan", 10],
  ];
  for (const [key, prix] of VILLES) {
    if (v.includes(key)) return { loyerM2: prix, precision: "ville" };
  }

  return { loyerM2: 12, precision: "ville" };
}
