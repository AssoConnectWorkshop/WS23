// Loyers meublés moyens au m² (données observatoires 2024-2025, arrondissement/quartier)
// Sources : OLAP, CLAMEUR, PAP, observatoires locaux, encadrement des loyers

// Paris : par arrondissement (code postal 750XX)
const PARIS_PAR_ARRONDISSEMENT: Record<number, number> = {
  1: 37, 2: 35, 3: 36, 4: 38,
  5: 38, 6: 42, 7: 40, 8: 34,
  9: 30, 10: 28, 11: 29, 12: 26,
  13: 24, 14: 27, 15: 28, 16: 31,
  17: 28, 18: 25, 19: 22, 20: 23,
};

// Lyon : par arrondissement (code postal 6900X)
const LYON_PAR_ARRONDISSEMENT: Record<number, number> = {
  1: 21, // Terreaux, Croix-Rousse bas
  2: 22, // Presqu'île, Confluence — très demandé
  3: 18, // Part-Dieu, Montchat
  4: 23, // Croix-Rousse plateau — premium
  5: 19, // Vieux-Lyon, Saint-Just
  6: 24, // Brotteaux, Cité Internationale — le plus cher
  7: 18, // Guillotière, Jean-Macé — en hausse
  8: 16, // Monplaisir, Mermoz
  9: 17, // Vaise, La Duchère
};

// Marseille : par arrondissement (code postal 130XX)
const MARSEILLE_PAR_ARRONDISSEMENT: Record<number, number> = {
  1: 17, // Vieux-Port, Panier
  2: 14, // Joliette, Euroméditerranée
  3: 12, // Belle-de-Mai
  4: 13, // Cinq-Avenues, Longchamp
  5: 13, // Belsunce, Chave
  6: 20, // Préfecture, Castellane, Notre-Dame du Mont
  7: 22, // Endoume, Vallon des Auffes, corniche
  8: 23, // Périer, Saint-Giniez, Prado — le plus prisé
  9: 18, // Les Goudes, Calanques, Mazargues
  10: 13, // La Capelette, Saint-Loup
  11: 12, // La Valentine, La Treille
  12: 13, // La Pointe-Rouge, Bonneveine
  13: 12, // Les Olives, Château-Gombert
  14: 11, // Les Crottes, Saint-Barthélémy
  15: 10, // La Cabucelle, Le Canet
  16: 10, // L'Estaque, Saint-Henri
};

// Bordeaux : par secteur (code postal 3300X)
const BORDEAUX_PAR_QUARTIER: Record<string, number> = {
  "33000": 20, // Centre — Saint-Pierre, Chartrons, Victoire, Capucins
  "33100": 17, // Caudéran
  "33200": 14, // Mérignac / Pessac
  "33300": 18, // Bastide, Bacalan, Bassins à flot — en forte hausse
  "33400": 14, // Talence
  "33600": 14, // Pessac centre
  "33700": 13, // Mérignac nord
  "33800": 14, // Bordeaux Sud, Nansouty
};

// Villes avec données par secteur de code postal
const LOYERS_PAR_CP: Record<string, number> = {
  // Nice — Alpes-Maritimes
  "06000": 28, // Vieux-Nice, Carré d'Or, centre
  "06100": 25, // Nice Ouest, Magnan, Fabron
  "06200": 22, // Nice nord, Riquier, Saint-Roch
  "06300": 21, // Nice Est, Madeleine, Lingostière
  "06500": 24, // Menton
  "06400": 22, // Cannes centre
  "06110": 19, // Le Cannet
  "06700": 22, // Saint-Laurent-du-Var

  // Toulouse — Haute-Garonne
  "31000": 18, // Centre, Capitole, Carmes, Saint-Étienne
  "31100": 16, // Compans-Caffarelli, Saint-Aubin, Borderouge
  "31200": 14, // Minimes, Lalande, Sept-Deniers
  "31300": 15, // Saint-Cyprien, Croix-de-Pierre, Fontaines
  "31400": 16, // Saint-Agne, Rangueil, Sauzelong
  "31500": 17, // Jolimont, Bonhoure, Guilheméry

  // Nantes — Loire-Atlantique
  "44000": 18, // Centre, Bouffay, Graslin, Feydeau
  "44100": 16, // Chantenay, Breil, Bellevue
  "44200": 15, // Saint-Sébastien-sur-Loire
  "44300": 15, // Doulon, Bout-des-Landes, Nort
  "44400": 14, // Rezé
  "44700": 14, // Orvault

  // Montpellier — Hérault
  "34000": 19, // Centre Historique, Écusson, Antigone, Beaux-Arts
  "34070": 16, // Port Marianne, Ovalie, Richter
  "34080": 14, // Croix d'Argent, Mosson
  "34090": 16, // Hôpitaux-Facultés, Prés d'Arènes

  // Strasbourg — Bas-Rhin
  "67000": 18, // Centre, Petite France, Krutenau, Neustadt
  "67100": 15, // Neudorf, Meinau, Port du Rhin
  "67200": 13, // Hautepierre, Koenigshofen, Cronenbourg

  // Lille — Nord
  "59000": 19, // Centre, Vieux-Lille, Wazemmes, Moulins
  "59100": 12, // Roubaix — marché différent
  "59130": 14, // Hellemmes
  "59160": 14, // Lomme
  "59260": 13, // Hellemmes-Lille
  "59800": 16, // Lille Fives, Lezennes

  // Rennes — Ille-et-Vilaine
  "35000": 19, // Centre, Thabor, Colombia, Sainte-Thérèse
  "35200": 16, // Villejean, Bréquigny, Beauregard
  "35700": 15, // Cesson-Sévigné, Saint-Grégoire

  // Grenoble — Isère
  "38000": 16, // Centre, Championnet, Berriat
  "38100": 14, // Grenoble nord, Eaux-Claires
  "38130": 14, // Échirolles

  // Annecy — Haute-Savoie
  "74000": 24, // Centre, Vieille Ville, Bonlieu — très cher
  "74600": 20, // Seynod
  "74370": 21, // Argonay, Metz-Tessy
  "74940": 19, // Annecy-le-Vieux

  // Aix-en-Provence — Bouches-du-Rhône
  "13100": 22, // Centre Aix, Quartier Mazarin, Sextius — très prisé
  "13290": 17, // Les Milles, Aix-les-Milles

  // Toulon — Var
  "83000": 15, // Centre, Le Mourillon
  "83100": 14, // Toulon Ouest, La Valette
  "83200": 14, // Toulon Est, La Garde

  // Angers — Maine-et-Loire
  "49000": 15, // Centre, La Doutre, Ralliement
  "49100": 13, // Angers nord, Belle-Beille

  // Dijon — Côte-d'Or
  "21000": 15, // Centre, Darcy, Montchapet, Clemenceau
  "21100": 12, // Dijon nord

  // Reims — Marne
  "51100": 14, // Centre, Clairmarais, Boulingrin
  "51000": 13, // Reims Sud

  // Tours — Indre-et-Loire
  "37000": 15, // Centre, Vieux-Tours, Prébendes
  "37100": 13, // Tours nord, Saint-Symphorien

  // Metz — Moselle
  "57000": 13, // Centre, Queuleu, Plantières
  "57050": 11, // Metz Borny

  // Nancy — Meurthe-et-Moselle
  "54000": 14, // Centre, Poincaré, Nabécor
  "54100": 12, // Nancy nord, Maxéville

  // Rouen — Seine-Maritime
  "76000": 15, // Centre, Vieux-Rouen, Saint-Marc
  "76100": 13, // Rouen rive gauche, Sotteville

  // Clermont-Ferrand — Puy-de-Dôme
  "63000": 13, // Centre, Montferrand, Croix-de-Neyrat
  "63100": 11, // Clermont nord

  // Caen — Calvados
  "14000": 14, // Centre, Saint-Jean, Folie-Couvrechef
  "14200": 12, // Hérouville-Saint-Clair

  // Perpignan — Pyrénées-Orientales
  "66000": 12, // Centre, Saint-Mathieu
  "66100": 10, // Perpignan nord

  // Brest — Finistère
  "29200": 12, // Centre, Recouvrance, Saint-Marc

  // Limoges — Haute-Vienne
  "87000": 11, // Centre, Carnot

  // Pau — Pyrénées-Atlantiques
  "64000": 12, // Centre, Trespoey, Hédas

  // Bayonne / Biarritz / Pays Basque
  "64100": 19, // Bayonne centre, Grand Bayonne
  "64200": 25, // Biarritz — très premium, surf, tourisme
  "64210": 16, // Bidart
  "64500": 20, // Saint-Jean-de-Luz
  "64600": 22, // Anglet — entre Bayonne et Biarritz

  // La Rochelle — Charente-Maritime
  "17000": 18, // Centre, Vieux-Port, Minimes — très demandé
  "17100": 14, // Saintes

  // Nîmes — Gard
  "30000": 13, // Centre, Arènes
  "30900": 11, // Nîmes nord

  // Avignon — Vaucluse
  "84000": 14, // Intra-muros, Avignon centre
  "84140": 12, // Montfavet

  // Orléans — Loiret
  "45000": 14, // Centre, Saint-Marceau, Saint-Jean
  "45100": 12, // Orléans Ouest

  // Le Mans — Sarthe
  "72000": 12, // Centre, Cité Plantagenêt

  // Poitiers — Vienne
  "86000": 12, // Centre, Montbernage, Saint-Éloi

  // Besançon — Doubs
  "25000": 13, // Centre, Battant, Planoise
  "25200": 11, // Montbéliard

  // Chambéry — Savoie
  "73000": 16, // Centre, Biollay — bon marché Alpes
  "73100": 14, // Aix-les-Bains

  // Valence — Drôme
  "26000": 13, // Centre

  // Colmar — Haut-Rhin
  "68000": 15, // Centre historique
  "68100": 12, // Mulhouse centre

  // Lorient — Morbihan
  "56100": 13, // Centre

  // Saint-Étienne — Loire
  "42000": 10, // Centre, Manufacture
  "42100": 9,  // Saint-Étienne nord

  // Amiens — Somme
  "80000": 12, // Centre, Saint-Leu
  "80080": 11, // Amiens nord

  // Troyes — Aube
  "10000": 12, // Centre historique

  // Montauban — Tarn-et-Garonne
  "82000": 11,

  // Chartres — Eure-et-Loir
  "28000": 13,

  // Quimper — Finistère
  "29000": 12,

  // Vannes — Morbihan
  "56000": 15, // Centre, presqu'île — tourisme et retraités

  // Bayeux — Calvados
  "14400": 13,

  // La Baule — Loire-Atlantique (station balnéaire premium)
  "44500": 21,

  // Arcachon — Gironde (station balnéaire)
  "33120": 25,

  // Hossegor / Capbreton — Landes
  "40150": 22,
};

// Fallback par département
const LOYERS_PAR_DEPARTEMENT: Record<string, number> = {
  "75": 33, // Paris (fallback)
  "92": 23, // Hauts-de-Seine (Neuilly, Levallois, Boulogne)
  "93": 16, // Seine-Saint-Denis
  "94": 19, // Val-de-Marne (Vincennes, Créteil)
  "95": 16, // Val-d'Oise
  "78": 17, // Yvelines (Versailles, Saint-Germain)
  "91": 16, // Essonne
  "77": 14, // Seine-et-Marne
  "06": 22, // Alpes-Maritimes
  "13": 15, // Bouches-du-Rhône
  "69": 18, // Rhône
  "31": 15, // Haute-Garonne
  "33": 16, // Gironde
  "34": 15, // Hérault
  "44": 15, // Loire-Atlantique
  "67": 15, // Bas-Rhin
  "59": 15, // Nord
  "35": 15, // Ille-et-Vilaine
  "38": 14, // Isère
  "74": 20, // Haute-Savoie
  "73": 15, // Savoie
  "83": 14, // Var
  "84": 13, // Vaucluse
  "76": 13, // Seine-Maritime
  "57": 12, // Moselle
  "54": 12, // Meurthe-et-Moselle
  "64": 17, // Pyrénées-Atlantiques (Pays Basque)
  "40": 17, // Landes (côte)
  "17": 15, // Charente-Maritime
  "29": 12, // Finistère
  "56": 13, // Morbihan
  "49": 13, // Maine-et-Loire
  "37": 13, // Indre-et-Loire
  "21": 13, // Côte-d'Or
  "25": 12, // Doubs
  "68": 13, // Haut-Rhin
  "30": 12, // Gard
  "63": 12, // Puy-de-Dôme
  "14": 13, // Calvados
  "66": 11, // Pyrénées-Orientales
  "87": 10, // Haute-Vienne
  "42": 10, // Loire
  "80": 11, // Somme
  "51": 12, // Marne
};

// Taxe foncière : taux effectif appliqué à la valeur locative cadastrale.
// VLC ≈ loyer_mensuel × 12 × 50% (abattement 50%). Taux = taux commune + taux dept.
// Sources : DGFIP 2023-2024, observatoires fiscaux locaux.
const TAXE_FONCIERE_TAUX: Record<string, number> = {
  paris: 0.132,
  lyon: 0.252,
  marseille: 0.278,
  toulouse: 0.278,
  bordeaux: 0.225,
  nantes: 0.278,
  montpellier: 0.328,
  strasbourg: 0.292,
  lille: 0.318,
  rennes: 0.258,
  nice: 0.194,
  grenoble: 0.298,
  annecy: 0.182,
  aix: 0.222,
  toulon: 0.298,
  angers: 0.278,
  dijon: 0.288,
  reims: 0.288,
  tours: 0.268,
  metz: 0.278,
  nancy: 0.272,
  rouen: 0.298,
  clermont: 0.288,
  caen: 0.268,
  pau: 0.218,
  bayonne: 0.228,
  biarritz: 0.218,
  anglet: 0.218,
  brest: 0.268,
  perpignan: 0.318,
  nimes: 0.288,
  avignon: 0.278,
  orleans: 0.278,
  poitiers: 0.278,
  besancon: 0.268,
  chambery: 0.248,
  valence: 0.268,
  saint: 0.318, // Saint-Étienne — taux très élevé
  amiens: 0.288,
  lorient: 0.268,
  vannes: 0.238,
  quimper: 0.258,
  troyes: 0.278,
  limoges: 0.298,
  colmar: 0.248,
  mulhouse: 0.318,
  _default: 0.260,
};

// Assurance PNO : €/m²/an. Dépend de la zone géographique et du risque.
const PNO_PAR_DEPT: Record<string, number> = {
  "06": 2.8,  // Alpes-Maritimes (risque sismique + vol)
  "13": 2.5,  // Bouches-du-Rhône
  "75": 2.8,  // Paris (vol, dégât des eaux)
  "92": 2.5, "93": 2.8, "94": 2.5,
  "69": 2.2,  // Rhône
  "31": 2.0,  // Haute-Garonne
  "33": 2.2,  // Gironde
  "34": 2.2,  // Hérault
  "44": 2.0,
  "67": 2.0,
  "59": 2.0,
  "35": 1.8,
  "38": 2.0,
  "74": 2.0,
  "73": 2.0,
  "83": 2.5,  // Var (risque incendie)
  "64": 2.2,  // Pays Basque
  "40": 2.2,  // Landes (risque incendie)
  "17": 2.0,
  "29": 1.8,
  "56": 1.8,
  _default: 1.8,
} as unknown as Record<string, number>;

function getTaxeFonciere(city: string, loyer: number): number {
  const c = (city ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let taux = TAXE_FONCIERE_TAUX["_default"];
  for (const [key, t] of Object.entries(TAXE_FONCIERE_TAUX)) {
    if (key !== "_default" && c.includes(key)) { taux = t; break; }
  }
  // TF = VLC × taux, VLC ≈ loyer_annuel × 50%
  return Math.round(loyer * 12 * 0.5 * taux);
}

function getPNO(codePostal: string | undefined, surface: number): number {
  const dept = codePostal?.slice(0, 2) ?? "";
  const tauxM2 = (PNO_PAR_DEPT as Record<string, number>)[dept] ?? (PNO_PAR_DEPT as unknown as Record<string, number>)["_default"] ?? 1.8;
  return Math.round(tauxM2 * surface);
}

export function estimerLoyerParAdresse(opts: {
  codePostal?: string;
  citycode?: string; // INSEE code ex: "75056"
  city?: string;
  surface: number;
  loyer?: number;
}): { loyerM2: number; precision: "arrondissement" | "codePostal" | "departement" | "ville"; taxeFonciere: number; assurancePNO: number } {
  const { codePostal, citycode, city, surface, loyer } = opts;

  const mk = (loyerM2: number, precision: "arrondissement" | "codePostal" | "departement" | "ville") => {
    const loyerEst = loyer ?? Math.round(loyerM2 * surface);
    return {
      loyerM2,
      precision,
      taxeFonciere: getTaxeFonciere(city ?? "", loyerEst),
      assurancePNO: getPNO(codePostal, surface),
    };
  };

  // Paris : par arrondissement via code postal 750XX ou citycode
  if (codePostal?.startsWith("75") && codePostal.length === 5) {
    const arr = parseInt(codePostal.slice(3));
    if (arr >= 1 && arr <= 20 && PARIS_PAR_ARRONDISSEMENT[arr]) {
      return mk(PARIS_PAR_ARRONDISSEMENT[arr], "arrondissement");
    }
  }
  if (citycode?.startsWith("751") && citycode.length === 5) {
    const arr = parseInt(citycode.slice(3));
    if (arr >= 1 && arr <= 20 && PARIS_PAR_ARRONDISSEMENT[arr]) {
      return mk(PARIS_PAR_ARRONDISSEMENT[arr], "arrondissement");
    }
  }

  // Lyon : par arrondissement
  if (codePostal?.startsWith("690") && codePostal.length === 5) {
    const arr = parseInt(codePostal.slice(3));
    if (arr >= 1 && arr <= 9 && LYON_PAR_ARRONDISSEMENT[arr]) {
      return mk(LYON_PAR_ARRONDISSEMENT[arr], "arrondissement");
    }
  }

  // Marseille : par arrondissement
  if (codePostal?.startsWith("13") && codePostal.length === 5) {
    const arr = parseInt(codePostal.slice(3));
    if (arr >= 1 && arr <= 16 && MARSEILLE_PAR_ARRONDISSEMENT[arr]) {
      return mk(MARSEILLE_PAR_ARRONDISSEMENT[arr], "arrondissement");
    }
  }

  if (codePostal && BORDEAUX_PAR_QUARTIER[codePostal]) return mk(BORDEAUX_PAR_QUARTIER[codePostal], "codePostal");
  if (codePostal && LOYERS_PAR_CP[codePostal]) return mk(LOYERS_PAR_CP[codePostal], "codePostal");

  const dept = codePostal?.slice(0, 2) ?? "";
  if (dept && LOYERS_PAR_DEPARTEMENT[dept]) return mk(LOYERS_PAR_DEPARTEMENT[dept], "departement");

  const v = (city ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const VILLES: Array<[string, number]> = [
    ["paris", 33], ["lyon", 20], ["marseille", 16], ["nice", 25], ["bordeaux", 18],
    ["toulouse", 17], ["nantes", 17], ["montpellier", 17], ["strasbourg", 17],
    ["lille", 18], ["rennes", 17], ["grenoble", 15], ["annecy", 23],
    ["aix", 21], ["toulon", 14], ["angers", 14], ["dijon", 14],
    ["reims", 13], ["tours", 14], ["metz", 13], ["nancy", 13],
    ["rouen", 14], ["clermont", 12], ["caen", 13], ["bayonne", 18],
    ["biarritz", 24], ["la rochelle", 17], ["pau", 12], ["nimes", 13],
    ["avignon", 13], ["brest", 12], ["limoges", 11], ["perpignan", 11],
    ["chambery", 15], ["valence", 13], ["vannes", 14], ["quimper", 12],
    ["lorient", 13], ["colmar", 14], ["troyes", 12], ["amiens", 12],
    ["saint-etienne", 10], ["orleans", 13], ["poitiers", 12], ["besancon", 13],
    ["arcachon", 24], ["hossegor", 21], ["la baule", 20],
  ];
  for (const [key, prix] of VILLES) {
    if (v.includes(key)) return mk(prix, "ville");
  }

  return mk(12, "ville");
}
