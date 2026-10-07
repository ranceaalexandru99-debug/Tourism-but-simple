// Smart mock route engine.
// Generates believable itineraries from a destination + preferences,
// without any external API. A real Claude API call would slot in at
// generateRoute() — same input/output shape.
//
// Three tiers of objectives, best first:
//
//   1. DESTINATIONS below — 19 cities written out by hand, with the local tips
//      and the "go at 8:00, it's almost empty" advice no database holds.
//   2. The packed OpenStreetMap objectives — 265,740 real places across 4,769
//      cities, from data/pois/ via scripts/pack-native-pois.mjs. See poiPack.js.
//   3. FALLBACK — "Centrul istoric", "Muzeul orașului". Until tier 2 existed
//      this is what 4,980 of the 4,999 cities in the index got: an itinerary
//      with no real name in it.
//
// Tier 2 is why generateRoute is async now.

import { searchDestinations, nameMatchesCity } from "./destinations.js";
import { loadPackedPois } from "./poiPack.js";
import { buildDest } from "../shared/poiDest.js";
import { tStatic } from "./i18n.js";

// ---- POI database -----------------------------------------------------------
// tags: culture | food | nature | nightlife | shopping | family
// ll: [lat, lng] for the map. cost: ticket price in EUR (0 = free/included).
const DESTINATIONS = {
  roma: {
    name: "Roma", country: "Italia", emoji: "🏛", center: [41.9009, 12.4833],
    blurb: "Capitala eternă — straturi de istorie la fiecare colț.",
    pois: [
      { name: "Colosseumul", wiki: "Colosseum", emoji: "🏛", tags: ["culture", "family"], dur: 120, hours: "9:00–19:00", cost: 16, tip: "Rezervă online cu 2 zile înainte ca să eviți coada.", ll: [41.8902, 12.4922] },
      { name: "Foro Romano", emoji: "🏺", tags: ["culture"], dur: 90, hours: "9:00–18:00", cost: 0, tip: "Bilet combinat cu Colosseumul — folosește-l în aceeași zi.", ll: [41.8925, 12.4853] },
      { name: "Fontana di Trevi", emoji: "⛲", tags: ["culture", "family"], dur: 30, hours: "non-stop", cost: 0, tip: "Vino dimineața devreme, la 8:00 e aproape goală.", ll: [41.9009, 12.4833] },
      { name: "Panteonul", wiki: "Pantheon, Rome", emoji: "🏛", tags: ["culture"], dur: 45, hours: "9:00–19:00", cost: 5, tip: "Privește oculusul la prânz, când lumina cade perfect.", ll: [41.8986, 12.4769] },
      { name: "Vatican & Capela Sixtină", wiki: "Capela Sixtină", emoji: "⛪", tags: ["culture"], dur: 180, hours: "8:00–18:00", cost: 17, tip: "Intră pe la 8:00 sau după 16:00, restul zilei e sufocant.", ll: [41.9065, 12.4536] },
      { name: "Trastevere la apus", wiki: "Trastevere", emoji: "🌆", tags: ["food", "nightlife"], dur: 120, hours: "seara", cost: 0, tip: "Pierde-te pe străduțe — cele mai bune trattorii n-au firmă.", ll: [41.8893, 12.4690] },
      { name: "Villa Borghese", emoji: "🌳", tags: ["nature", "family"], dur: 90, hours: "non-stop", cost: 0, tip: "Închiriază o bicicletă sau o barcă pe lac.", ll: [41.9142, 12.4923] },
      { name: "Piața Navona", wiki: "Piazza Navona", emoji: "🎨", tags: ["culture", "shopping"], dur: 45, hours: "non-stop", cost: 0, tip: "Artiști stradali și gelato la Tre Scalini.", ll: [41.8992, 12.4731] },
    ],
    food: ["🍝 Trattoria da Enzo (cacio e pepe legendar)", "🍕 Pizzarium (pizza al taglio)", "🍨 Gelateria del Teatro", "☕ Sant'Eustachio Il Caffè"],
    transport: "🚇 Metro Linia A + B, completate cu mers pe jos prin centru.",
  },
  paris: {
    name: "Paris", country: "Franța", emoji: "🗼", center: [48.8584, 2.3376],
    blurb: "Orașul luminilor — artă, cafenele și plimbări fără țintă.",
    pois: [
      { name: "Turnul Eiffel", emoji: "🗼", tags: ["culture", "family"], dur: 120, hours: "9:30–23:45", cost: 29, tip: "Urcă pe scări până la etajul 2 — coadă mai mică și priveliște la fel.", ll: [48.8584, 2.2945] },
      { name: "Muzeul Luvru", emoji: "🖼", tags: ["culture"], dur: 180, hours: "9:00–18:00", cost: 22, tip: "Intră pe Porte des Lions, evită piramida aglomerată.", ll: [48.8606, 2.3376] },
      { name: "Montmartre & Sacré-Cœur", wiki: "Montmartre", emoji: "⛪", tags: ["culture", "nightlife"], dur: 120, hours: "6:00–22:30", cost: 0, tip: "Urcă pe la apus, apoi un pahar la o terasă din spate.", ll: [48.8867, 2.3431] },
      { name: "Cartierul Latin", wiki: "Latin Quarter, Paris", emoji: "📚", tags: ["food", "culture"], dur: 90, hours: "ziua", cost: 0, tip: "Shakespeare & Company + crêpe de la o tarabă.", ll: [48.8499, 2.3470] },
      { name: "Muzeul d'Orsay", wiki: "Musée d'Orsay", emoji: "🎨", tags: ["culture"], dur: 120, hours: "9:30–18:00", cost: 16, tip: "Impresioniștii sunt la ultimul etaj — urcă direct acolo.", ll: [48.8600, 2.3266] },
      { name: "Sena cu vaporașul", wiki: "Seine", emoji: "🚤", tags: ["family", "nightlife"], dur: 75, hours: "seara", cost: 17, tip: "Croaziera de la apus prinde monumentele aprinse.", ll: [48.8606, 2.2976] },
      { name: "Le Marais", emoji: "🛍", tags: ["shopping", "food"], dur: 120, hours: "ziua", cost: 0, tip: "Falafel pe Rue des Rosiers, apoi boutique-uri vintage.", ll: [48.8590, 2.3580] },
      { name: "Grădinile Luxembourg", wiki: "Jardin du Luxembourg", emoji: "🌳", tags: ["nature", "family"], dur: 60, hours: "7:30–dusk", cost: 0, tip: "Un scaun verde lângă bazin = pauza perfectă.", ll: [48.8462, 2.3372] },
    ],
    food: ["🥐 Du Pain et des Idées (pâtisserie)", "🧀 L'As du Fallafel", "🍷 Le Comptoir du Relais", "🍫 Pierre Hermé (macarons)"],
    transport: "🚇 Metro dens și ieftin; ia un carnet de 10 bilete.",
  },
  barcelona: {
    name: "Barcelona", country: "Spania", emoji: "🏖", center: [41.3917, 2.1650],
    blurb: "Gaudí, tapas și mare — mediteraneana în stare pură.",
    pois: [
      { name: "Sagrada Família", emoji: "⛪", tags: ["culture", "family"], dur: 120, hours: "9:00–18:00", cost: 26, tip: "Rezervă slot de dimineață, când vitraliile colorează interiorul.", ll: [41.4036, 2.1744] },
      { name: "Park Güell", emoji: "🦎", tags: ["culture", "nature", "family"], dur: 120, hours: "9:30–19:30", cost: 10, tip: "Zona monumentală cere bilet cu oră fixă — ia-l din timp.", ll: [41.4145, 2.1527] },
      { name: "Cartierul Gotic", wiki: "Gothic Quarter, Barcelona", emoji: "🏰", tags: ["culture", "food"], dur: 120, hours: "ziua", cost: 0, tip: "Pierde-te pe străduțe; catedrala ascunde o curte cu gâște.", ll: [41.3839, 2.1765] },
      { name: "La Boqueria", emoji: "🍓", tags: ["food", "family"], dur: 60, hours: "8:00–20:00", cost: 0, tip: "Mănâncă la barul din fund, nu la tarabele de la intrare.", ll: [41.3817, 2.1716] },
      { name: "Plaja Barceloneta", wiki: "ca:La Barceloneta", emoji: "🏖", tags: ["nature", "nightlife", "family"], dur: 120, hours: "non-stop", cost: 0, tip: "Chiringuito cu sangria la apus, apoi promenada.", ll: [41.3784, 2.1925] },
      { name: "Casa Batlló", emoji: "🏠", tags: ["culture"], dur: 75, hours: "9:00–20:00", cost: 35, tip: "Audioghidul AR chiar merită aici.", ll: [41.3917, 2.1650] },
      { name: "Bunkers del Carmel", emoji: "🌇", tags: ["nature", "nightlife"], dur: 60, hours: "apus", cost: 0, tip: "Cea mai bună panoramă a orașului, gratis. Ia ceva de băut.", ll: [41.4194, 2.1622] },
    ],
    food: ["🥘 Paella la Can Solé", "🍤 Tapas la El Xampanyet", "🍦 Gelaaati di Marco", "🍷 Vermut la Bodega 1900"],
    transport: "🚇 Metro + mult mers prin Gotic; bicicleta merge pe litoral.",
  },
  brasov: {
    name: "Brașov", country: "România", emoji: "🏔", center: [45.6427, 25.5887],
    blurb: "Cetate medievală la poalele Tâmpei — Transilvania ca-n povești.",
    pois: [
      { name: "Piața Sfatului", emoji: "🏛", tags: ["culture", "family"], dur: 45, hours: "non-stop", cost: 0, tip: "Inima orașului vechi — ia loc la o terasă și privește Casa Sfatului.", ll: [45.6427, 25.5887] },
      { name: "Biserica Neagră", emoji: "⛪", tags: ["culture"], dur: 60, hours: "10:00–19:00", cost: 3, tip: "Cea mai mare biserică gotică din zonă; orga are 4000 de tuburi.", ll: [45.6411, 25.5876] },
      { name: "Strada Sforii", emoji: "🚶", tags: ["culture", "family"], dur: 15, hours: "non-stop", cost: 0, tip: "Una dintre cele mai înguste străzi din Europa — fotografia obligatorie.", ll: [45.6403, 25.5869] },
      { name: "Telecabina pe Tâmpa", wiki: "Tâmpa", emoji: "🚠", tags: ["nature", "family"], dur: 120, hours: "9:30–17:00", cost: 5, tip: "Panoramă completă peste oraș și literele BRAȘOV de pe munte.", ll: [45.6383, 25.5942] },
      { name: "Strada Republicii", emoji: "🛍", tags: ["shopping", "food"], dur: 60, hours: "ziua", cost: 0, tip: "Pietonala plină de cafenele și cofetării — ia niște papanași.", ll: [45.6435, 25.5905] },
      { name: "Bastionul Țesătorilor", emoji: "🏰", tags: ["culture"], dur: 45, hours: "9:00–17:00", cost: 2, tip: "Cea mai bine păstrată fortificație a cetății, cu machetă a Brașovului vechi.", ll: [45.6385, 25.5860] },
      { name: "Castelul Bran", emoji: "🦇", tags: ["culture", "family"], dur: 180, hours: "9:00–18:00", cost: 15, tip: "La 30 km — castelul lui „Dracula”. Pleacă dimineața, se aglomerează.", ll: [45.5149, 25.3672] },
      { name: "Poiana Brașov", emoji: "🏔", tags: ["nature", "family"], dur: 180, hours: "non-stop", cost: 0, tip: "Stațiune montană la 12 km — vara drumeții, iarna schi.", ll: [45.5938, 25.5519] },
    ],
    food: ["🍲 Ciorbă în pâine la La Ceaun", "🥟 Bucătărie ardelenească la Sergiana", "🍰 Papanași la Casa Românească", "☕ Cafenele pe Strada Republicii"],
    transport: "🚶 Centrul vechi se face pe jos; telecabină pe Tâmpa, mașină/bus pentru Bran și Poiana.",
  },
  santorini: {
    name: "Santorini", country: "Grecia", emoji: "🌊", center: [36.4150, 25.4290],
    blurb: "Case albe, cupole albastre și apusuri de neuitat.",
    pois: [
      { name: "Apus în Oia", wiki: "Oia, Greece", emoji: "🌅", tags: ["nature", "nightlife", "family"], dur: 90, hours: "seara", cost: 0, tip: "Prinde un loc cu o oră înainte — se umple instant.", ll: [36.4618, 25.3753] },
      { name: "Plaja Roșie", emoji: "🏖", tags: ["nature"], dur: 120, hours: "ziua", cost: 0, tip: "Adu papuci de apă, pietrele sunt fierbinți.", ll: [36.3485, 25.3936] },
      { name: "Sat Fira pe jos", wiki: "Fira", emoji: "🚶", tags: ["culture", "shopping"], dur: 120, hours: "ziua", cost: 0, tip: "Poteca Fira–Oia (10 km) e spectaculoasă la răsărit.", ll: [36.4167, 25.4324] },
      { name: "Croazieră în Caldeira", wiki: "Santorini caldera", emoji: "⛵", tags: ["nature", "family"], dur: 240, hours: "după-amiază", cost: 85, tip: "Variantă cu izvoare termale și cină la bord.", ll: [36.4150, 25.4290] },
      { name: "Akrotiri (sit antic)", wiki: "Akrotiri (Santorini)", emoji: "🏺", tags: ["culture"], dur: 90, hours: "8:00–17:00", cost: 12, tip: "„Pompeiul grecesc” — răcoros și aproape gol dimineața.", ll: [36.3517, 25.4030] },
      { name: "Degustare de vinuri", wiki: "Santorini (wine)", emoji: "🍷", tags: ["food", "nightlife"], dur: 90, hours: "după-amiază", cost: 25, tip: "Assyrtiko local, la Santo Wines, cu vedere la caldeira.", ll: [36.3760, 25.4480] },
    ],
    food: ["🐙 Caracatiță la Ammoudi Bay", "🍅 Salată cu roșii cherry locale", "🍷 Santo Wines", "🍨 Lolita Gelato în Fira"],
    transport: "🚗 Cel mai simplu cu mașina/ATV închiriat; busuri rare.",
  },

  // ---- Asia ----
  tokyo: {
    name: "Tokyo", country: "Japonia", emoji: "🗼", center: [35.6762, 139.6503],
    blurb: "Neon, temple și cea mai bună mâncare din lume — haos ordonat.",
    pois: [
      { name: "Templul Sensō-ji", wiki: "Sensō-ji", emoji: "⛩", tags: ["culture", "family"], dur: 90, hours: "6:00–17:00", cost: 0, tip: "Vino la 7:00, înainte de mulțime, și trage un omikuji (răvaș) la intrare.", ll: [35.7148, 139.7967] },
      { name: "Intersecția Shibuya", wiki: "Shibuya Crossing", emoji: "🚦", tags: ["culture", "shopping"], dur: 45, hours: "non-stop", cost: 0, tip: "Privește-o de sus din Starbucks-ul Tsutaya sau de la Shibuya Sky.", ll: [35.6595, 139.7005] },
      { name: "Altarul Meiji", wiki: "Meiji Shrine", emoji: "🌳", tags: ["culture", "nature"], dur: 75, hours: "răsărit–apus", cost: 0, tip: "Pădurea din jur e răcoroasă vara; poți prinde o nuntă tradițională.", ll: [35.6764, 139.6993] },
      { name: "Piața Tsukiji", wiki: "Tsukiji", emoji: "🍣", tags: ["food"], dur: 90, hours: "5:00–14:00", cost: 0, tip: "Sushi la micul dejun; ia tamagoyaki pe băț de la Yamacho.", ll: [35.6654, 139.7707] },
      { name: "Tokyo Skytree", emoji: "🗼", tags: ["family", "culture"], dur: 90, hours: "10:00–21:00", cost: 18, tip: "Bilet online cu oră fixă; cel mai frumos la apus.", ll: [35.7101, 139.8107] },
      { name: "teamLab Planets", emoji: "✨", tags: ["culture", "family"], dur: 120, hours: "9:00–22:00", cost: 24, tip: "Se merge desculț prin apă — vino cu pantaloni scurți.", ll: [35.6486, 139.7905] },
      { name: "Grădina Shinjuku Gyoen", wiki: "Shinjuku Gyoen", emoji: "🌸", tags: ["nature", "family"], dur: 90, hours: "9:00–16:30", cost: 4, tip: "Primăvara e regina sakura; ia un bento și stai pe iarbă.", ll: [35.6852, 139.7100] },
    ],
    food: ["🍜 Ramen la Ichiran", "🍣 Sushi la Tsukiji", "🍢 Izakaya în Omoide Yokocho", "🍡 Dango și matcha în Asakusa"],
    transport: "🚇 Metroul e vast și punctual; ia o cartelă Suica/Pasmo.",
  },
  bangkok: {
    name: "Bangkok", country: "Thailanda", emoji: "🛕", center: [13.7563, 100.5018],
    blurb: "Temple aurii, piețe animate și street food la fiecare colț.",
    pois: [
      { name: "Marele Palat", wiki: "Grand Palace", emoji: "🏯", tags: ["culture", "family"], dur: 120, hours: "8:30–15:30", cost: 13, tip: "Ține umerii și genunchii acoperiți, altfel nu intri.", ll: [13.7500, 100.4915] },
      { name: "Wat Pho (Buddha culcat)", emoji: "🛕", tags: ["culture"], dur: 75, hours: "8:00–18:30", cost: 5, tip: "Fă un masaj thailandez la școala din incintă — originalul.", ll: [13.7465, 100.4927] },
      { name: "Wat Arun", emoji: "🌅", tags: ["culture"], dur: 60, hours: "8:00–18:00", cost: 3, tip: "Traversează cu feribotul ieftin; superb la apus.", ll: [13.7437, 100.4889] },
      { name: "Piața Chatuchak", wiki: "Chatuchak Weekend Market", emoji: "🛍", tags: ["shopping", "food"], dur: 150, hours: "sâmbătă–duminică", cost: 0, tip: "Peste 15.000 de tarabe — vino dimineața, e mai răcoare.", ll: [13.7999, 100.5503] },
      { name: "Casa lui Jim Thompson", wiki: "Jim Thompson House", emoji: "🏠", tags: ["culture"], dur: 60, hours: "10:00–17:00", cost: 5, tip: "Oază de liniște; tur ghidat despre mătasea thailandeză.", ll: [13.7492, 100.5286] },
      { name: "Chinatown (Yaowarat)", wiki: "Yaowarat Road", emoji: "🏮", tags: ["food", "nightlife"], dur: 120, hours: "seara", cost: 0, tip: "Vino după 18:00 pentru street food; încearcă supa de tăiței.", ll: [13.7404, 100.5090] },
      { name: "Khao San Road", emoji: "🎉", tags: ["nightlife", "food"], dur: 90, hours: "seara", cost: 0, tip: "Pad thai la tarabă și un suc proaspăt; energie de backpacker.", ll: [13.7590, 100.4977] },
    ],
    food: ["🍜 Boat noodles", "🥭 Mango sticky rice", "🍢 Satay la grătar", "🌶 Som tum (salată de papaya)"],
    transport: "🚈 BTS Skytrain + tuk-tuk și bărci pe canale (khlong).",
  },

  // ---- Africa ----
  marrakech: {
    name: "Marrakech", country: "Maroc", emoji: "🕌", center: [31.6295, -7.9811],
    blurb: "Labirint de souk-uri, grădini și ceai de mentă în Orașul Roșu.",
    pois: [
      { name: "Jemaa el-Fnaa", emoji: "🎪", tags: ["culture", "food", "nightlife"], dur: 120, hours: "non-stop", cost: 0, tip: "Seara devine teatru: povestitori, muzică și tarabe de mâncare.", ll: [31.6258, -7.9891] },
      { name: "Moscheea Koutoubia", wiki: "Kutubiyya Mosque", emoji: "🕌", tags: ["culture"], dur: 30, hours: "exterior non-stop", cost: 0, tip: "Nu se intră, dar grădinile din jur sunt superbe la apus.", ll: [31.6242, -7.9931] },
      { name: "Palatul Bahia", wiki: "Bahia Palace", emoji: "🏛", tags: ["culture", "family"], dur: 75, hours: "9:00–17:00", cost: 7, tip: "Tavane pictate spectaculoase; vino devreme, se aglomerează.", ll: [31.6216, -7.9832] },
      { name: "Grădina Majorelle", wiki: "Majorelle Garden", emoji: "🌵", tags: ["nature", "culture"], dur: 75, hours: "8:00–18:00", cost: 15, tip: "Albastrul YSL e iconic; bilet online ca să sari coada.", ll: [31.6417, -8.0033] },
      { name: "Souk-urile din Medina", wiki: "Medina of Marrakesh", emoji: "🛍", tags: ["shopping", "culture"], dur: 120, hours: "9:00–20:00", cost: 0, tip: "Negociază de la jumătate și zâmbește; pierde-te intenționat.", ll: [31.6295, -7.9865] },
      { name: "Mormintele Saadiene", wiki: "Saadian Tombs", emoji: "🏛", tags: ["culture"], dur: 45, hours: "9:00–17:00", cost: 7, tip: "Mici, dar cu mozaicuri fine; mergi la prima oră.", ll: [31.6180, -7.9890] },
      { name: "Grădinile Menara", wiki: "Menara gardens", emoji: "🌴", tags: ["nature", "family"], dur: 60, hours: "8:00–18:00", cost: 0, tip: "Bazin cu reflexia Atlasului; locul de relaxare al localnicilor.", ll: [31.6146, -8.0206] },
    ],
    food: ["🍲 Tajine de miel cu prune", "🍛 Couscous de vineri", "🥟 Pastilla (plăcintă dulce-sărată)", "🍵 Ceai de mentă (atay)"],
    transport: "🚶 Medina se face pe jos; petit taxi pentru zonele noi (Guéliz).",
  },
  cairo: {
    name: "Cairo", country: "Egipt", emoji: "🐪", center: [30.0444, 31.2357],
    blurb: "Piramide, comori faraonice și Nilul care taie orașul în două.",
    pois: [
      { name: "Piramidele din Giza", emoji: "🔺", tags: ["culture", "family"], dur: 180, hours: "8:00–17:00", cost: 12, tip: "Mergi la 8:00, eviți căldura; poți intra în Marea Piramidă (bilet separat).", ll: [29.9792, 31.1342] },
      { name: "Marele Sfinx", wiki: "Great Sphinx of Giza", emoji: "🦁", tags: ["culture", "family"], dur: 45, hours: "8:00–17:00", cost: 0, tip: "Inclus în biletul de Giza; cea mai bună poză de la platforma de sud.", ll: [29.9753, 31.1376] },
      { name: "Muzeul Egiptean", wiki: "Egyptian Museum", emoji: "🏺", tags: ["culture"], dur: 150, hours: "9:00–17:00", cost: 12, tip: "Sala Tutankhamon e obligatorie; ia un ghid ca să nu te pierzi.", ll: [30.0478, 31.2336] },
      { name: "Khan el-Khalili", emoji: "🏮", tags: ["shopping", "food"], dur: 120, hours: "10:00–22:00", cost: 0, tip: "Cafea la El Fishawy, cea mai veche cafenea din oraș.", ll: [30.0477, 31.2622] },
      { name: "Citadela lui Saladin", wiki: "Cairo Citadel", emoji: "🏰", tags: ["culture"], dur: 120, hours: "8:00–17:00", cost: 10, tip: "Moscheea de Alabastru și panorama peste tot Cairo.", ll: [30.0287, 31.2599] },
      { name: "Croazieră pe Nil (felucca)", wiki: "Felucca", emoji: "⛵", tags: ["nature", "nightlife", "family"], dur: 90, hours: "după-amiază", cost: 15, tip: "O felucca la apus, împărțită cu un grup, e ieftină și magică.", ll: [30.0444, 31.2280] },
      { name: "Cairo Copt", wiki: "Coptic Cairo", emoji: "⛪", tags: ["culture"], dur: 90, hours: "9:00–16:00", cost: 0, tip: "Biserica Suspendată și străduțele liniștite din vechiul cartier.", ll: [30.0058, 31.2306] },
    ],
    food: ["🍚 Koshari (vasul național)", "🧆 Ta'meya (falafel egiptean)", "🍖 Kofta la grătar", "🍮 Om Ali (desert cald)"],
    transport: "🚇 Metrou ieftin + Uber/taxi; traficul e intens, lasă timp.",
  },

  // ---- America de Sud ----
  rio: {
    name: "Rio de Janeiro", country: "Brazilia", emoji: "🏖", center: [-22.9068, -43.1729],
    blurb: "Plaje legendare, munți verzi și samba — Cidade Maravilhosa.",
    pois: [
      { name: "Cristo Mântuitorul", wiki: "Christ the Redeemer (statue)", emoji: "🗿", tags: ["culture", "family"], dur: 120, hours: "8:00–19:00", cost: 25, tip: "Ia trenulețul prin pădurea Tijuca; vino dimineața, se înnorează repede.", ll: [-22.9519, -43.2105] },
      { name: "Pão de Açúcar", wiki: "Sugarloaf Mountain", emoji: "🚠", tags: ["nature", "family"], dur: 150, hours: "8:00–20:00", cost: 22, tip: "Două telecabine; rămâi pentru apusul de pe vârf.", ll: [-22.9486, -43.1566] },
      { name: "Plaja Copacabana", wiki: "Copacabana, Rio de Janeiro", emoji: "🏖", tags: ["nature", "nightlife", "family"], dur: 120, hours: "non-stop", cost: 0, tip: "Închiriază un scaun, bea apă de cocos; atenție la lucruri.", ll: [-22.9711, -43.1822] },
      { name: "Plaja Ipanema", wiki: "Ipanema", emoji: "🌅", tags: ["nature", "nightlife"], dur: 120, hours: "non-stop", cost: 0, tip: "Apusul de la Arpoador e aplaudat în fiecare seară.", ll: [-22.9871, -43.2045] },
      { name: "Scările Selarón", wiki: "Escadaria Selarón", emoji: "🎨", tags: ["culture"], dur: 30, hours: "non-stop", cost: 0, tip: "215 trepte cu faianță din toată lumea; mergi ziua.", ll: [-22.9153, -43.1791] },
      { name: "Santa Teresa", wiki: "Santa Teresa, Rio de Janeiro", emoji: "🚋", tags: ["culture", "food"], dur: 120, hours: "ziua", cost: 0, tip: "Cartier boem pe deal; ia tramvaiul galben (bondinho).", ll: [-22.9186, -43.1875] },
      { name: "Grădina Botanică", wiki: "Rio de Janeiro Botanical Garden", emoji: "🌴", tags: ["nature", "family"], dur: 90, hours: "8:00–17:00", cost: 12, tip: "Palmieri imperiali uriași și maimuțe; oază verde.", ll: [-22.9674, -43.2237] },
    ],
    food: ["🍢 Churrasco (rodízio)", "🥘 Feijoada sâmbăta", "🧀 Pão de queijo", "🍹 Caipirinha pe plajă"],
    transport: "🚇 Metrou sigur + Uber; evită autobuzele noaptea.",
  },
  buenosaires: {
    name: "Buenos Aires", country: "Argentina", emoji: "💃", center: [-34.6037, -58.3816],
    blurb: "Tango, cartiere colorate și cea mai bună friptură din lume.",
    pois: [
      { name: "Plaza de Mayo & Casa Rosada", emoji: "🏛", tags: ["culture", "family"], dur: 60, hours: "ziua", cost: 0, tip: "Turul gratuit al Casei Roz e doar în weekend, rezervă online.", ll: [-34.6081, -58.3702] },
      { name: "Caminito (La Boca)", emoji: "🎨", tags: ["culture", "shopping"], dur: 90, hours: "10:00–18:00", cost: 0, tip: "Case colorate și tango stradal; rămâi pe străzile turistice.", ll: [-34.6395, -58.3626] },
      { name: "Cimitirul Recoleta", wiki: "La Recoleta Cemetery", emoji: "🏛", tags: ["culture"], dur: 75, hours: "8:00–18:00", cost: 0, tip: "Caută mausoleul Evitei; un oraș în miniatură de marmură.", ll: [-34.5875, -58.3925] },
      { name: "Teatro Colón", emoji: "🎭", tags: ["culture"], dur: 60, hours: "tururi 9:00–17:00", cost: 15, tip: "Una dintre cele mai bune acustici din lume; ia turul ghidat.", ll: [-34.6010, -58.3833] },
      { name: "El Ateneo Grand Splendid", emoji: "📚", tags: ["culture", "shopping"], dur: 45, hours: "9:00–21:00", cost: 0, tip: "Librărie într-un fost teatru; cafea pe scenă.", ll: [-34.5959, -58.3936] },
      { name: "Târgul San Telmo", wiki: "San Telmo", emoji: "🛍", tags: ["shopping", "food"], dur: 120, hours: "duminica", cost: 0, tip: "Antichități și tango live; vino flămând.", ll: [-34.6208, -58.3730] },
      { name: "Parcurile Palermo", wiki: "Palermo, Buenos Aires", emoji: "🌳", tags: ["nature", "family"], dur: 90, hours: "non-stop", cost: 0, tip: "Rosedal-ul (grădina de trandafiri) și bărci pe lac.", ll: [-34.5714, -58.4149] },
    ],
    food: ["🥩 Bife de chorizo la parrilla", "🥟 Empanadas", "🧉 Mate cu localnicii", "🍮 Dulce de leche în orice"],
    transport: "🚇 Subte (metrou) + taxi/Uber; orașul e foarte plimbabil.",
  },

  // ---- USA ----
  newyork: {
    name: "New York", country: "SUA", emoji: "🗽", center: [40.7128, -74.0060],
    blurb: "Orașul care nu doarme — zgârie-nori, Broadway și energie pură.",
    pois: [
      { name: "Statuia Libertății", emoji: "🗽", tags: ["culture", "family"], dur: 180, hours: "9:00–17:00", cost: 24, tip: "Feribotul include Ellis Island; rezervă accesul la coroană din timp.", ll: [40.6892, -74.0445] },
      { name: "Central Park", emoji: "🌳", tags: ["nature", "family"], dur: 120, hours: "6:00–1:00", cost: 0, tip: "Închiriază o bicicletă; vezi Bethesda Terrace și Bow Bridge.", ll: [40.7829, -73.9654] },
      { name: "Times Square", emoji: "🌆", tags: ["culture", "shopping", "nightlife"], dur: 45, hours: "non-stop", cost: 0, tip: "Cel mai spectaculos noaptea; atenție la personajele care cer bani.", ll: [40.7580, -73.9855] },
      { name: "Empire State Building", emoji: "🏙", tags: ["culture", "family"], dur: 90, hours: "10:00–22:00", cost: 42, tip: "Apusul e cel mai cerut; bilet online cu oră fixă.", ll: [40.7484, -73.9857] },
      { name: "Metropolitan Museum", wiki: "Metropolitan Museum of Art", emoji: "🖼", tags: ["culture"], dur: 180, hours: "10:00–17:00", cost: 28, tip: "Prea mare pentru o zi; alege 2-3 secțiuni și acoperișul.", ll: [40.7794, -73.9632] },
      { name: "Podul Brooklyn", emoji: "🌉", tags: ["culture", "family"], dur: 60, hours: "non-stop", cost: 0, tip: "Traversează dinspre Brooklyn spre Manhattan la răsărit.", ll: [40.7061, -73.9969] },
      { name: "The High Line", emoji: "🌿", tags: ["nature", "culture"], dur: 75, hours: "7:00–22:00", cost: 0, tip: "Parc pe o cale ferată suspendată; termină în Chelsea Market.", ll: [40.7480, -74.0048] },
    ],
    food: ["🥯 Bagel cu cream cheese", "🍕 Felie de pizza NY", "🌭 Hot dog de la stradă", "🥟 Dumplings în Chinatown"],
    transport: "🚇 Metroul merge 24/7; ia un card OMNY/contactless.",
  },
  sanfrancisco: {
    name: "San Francisco", country: "SUA", emoji: "🌉", center: [37.7749, -122.4194],
    blurb: "Dealuri abrupte, ceață și podul roșu — capitala tech relaxată.",
    pois: [
      { name: "Golden Gate Bridge", emoji: "🌉", tags: ["culture", "family"], dur: 90, hours: "non-stop", cost: 0, tip: "Plimbă-te sau pedalează; Battery Spencer are cea mai bună poză.", ll: [37.8199, -122.4783] },
      { name: "Alcatraz", wiki: "Alcatraz Island", emoji: "🏝", tags: ["culture", "family"], dur: 180, hours: "9:00–16:30", cost: 41, tip: "Rezervă cu 2-3 săptămâni înainte — se epuizează rapid.", ll: [37.8267, -122.4230] },
      { name: "Fisherman's Wharf", emoji: "🦀", tags: ["food", "family"], dur: 90, hours: "ziua", cost: 0, tip: "Vezi leii de mare de la Pier 39; supă în bol de pâine.", ll: [37.8080, -122.4177] },
      { name: "Golden Gate Park", emoji: "🌳", tags: ["nature", "family"], dur: 120, hours: "non-stop", cost: 0, tip: "Grădina Japoneză de Ceai; mai mare decât Central Park.", ll: [37.7694, -122.4862] },
      { name: "Lombard Street", emoji: "🛣", tags: ["culture"], dur: 30, hours: "non-stop", cost: 0, tip: "Cea mai șerpuită stradă; coboară pe jos pe trotuar.", ll: [37.8021, -122.4187] },
      { name: "Painted Ladies", emoji: "🏠", tags: ["culture"], dur: 30, hours: "non-stop", cost: 0, tip: "Case victoriene din Alamo Square; picnic pe deal.", ll: [37.7763, -122.4329] },
      { name: "Ferry Building", wiki: "San Francisco Ferry Building", emoji: "🛒", tags: ["food", "shopping"], dur: 60, hours: "10:00–19:00", cost: 0, tip: "Piață gourmet; marți/sâmbătă e farmers market afară.", ll: [37.7955, -122.3937] },
    ],
    food: ["🥖 Clam chowder în bol de pâine", "🌯 Burrito în Mission", "🦀 Crab Dungeness", "☕ Cafea de specialitate"],
    transport: "🚋 Cable car iconic + Muni/BART; dealurile obosesc, planifică.",
  },

  // ---- Asia de Sud-Est & Orientul Mijlociu ----
  bali: {
    name: "Bali", country: "Indonezia", emoji: "🌴", center: [-8.5000, 115.2000],
    blurb: "Temple pe stânci, terase de orez și plaje de surf — insula zeilor.",
    pois: [
      { name: "Templul Tanah Lot", wiki: "Tanah Lot", emoji: "🛕", tags: ["culture", "nature"], dur: 90, hours: "7:00–19:00", cost: 4, tip: "Vino la apus, când templul pare că plutește pe ocean.", ll: [-8.6212, 115.0868] },
      { name: "Templul Uluwatu", wiki: "Uluwatu Temple", emoji: "⛩", tags: ["culture", "nature"], dur: 90, hours: "9:00–19:00", cost: 3, tip: "Dansul Kecak la apus e obligatoriu; ține-ți ochelarii de maimuțe.", ll: [-8.8291, 115.0849] },
      { name: "Terasele de orez Tegallalang", emoji: "🌾", tags: ["nature", "family"], dur: 90, hours: "7:00–18:00", cost: 2, tip: "Mergi la 8:00 înainte de autocare; leagănele au taxă separată.", ll: [-8.4312, 115.2779] },
      { name: "Pădurea Maimuțelor din Ubud", wiki: "Ubud Monkey Forest", emoji: "🐒", tags: ["nature", "family"], dur: 60, hours: "9:00–18:00", cost: 5, tip: "Nu ține mâncare la vedere; maimuțele sunt iuți.", ll: [-8.5188, 115.2587] },
      { name: "Cascada Tegenungan", wiki: "Tegenungan Waterfall", emoji: "💦", tags: ["nature"], dur: 75, hours: "8:00–18:00", cost: 2, tip: "Coboară treptele dimineața; poți face baie sub cascadă.", ll: [-8.5755, 115.2894] },
      { name: "Plaja Kuta", wiki: "Kuta Beach", emoji: "🏄", tags: ["nature", "nightlife", "family"], dur: 120, hours: "non-stop", cost: 0, tip: "Perfectă pentru lecții de surf de începători și apus.", ll: [-8.7184, 115.1686] },
      { name: "Răsărit pe Muntele Batur", wiki: "Mount Batur", emoji: "🌋", tags: ["nature"], dur: 240, hours: "trekking noaptea", cost: 30, tip: "Plecare la 3:00 cu ghid; ia geacă, sus e frig.", ll: [-8.2422, 115.3752] },
    ],
    food: ["🍚 Nasi goreng", "🐷 Babi guling (purcel)", "🍢 Satay lilit", "🥥 Nucă de cocos proaspătă"],
    transport: "🛵 Scuter închiriat sau Grab/Gojek; distanțele sunt mari.",
  },
  singapore: {
    name: "Singapore", country: "Singapore", emoji: "🌆", center: [1.3521, 103.8198],
    blurb: "Oraș-grădină futurist: mâncare de stradă premiată și arhitectură nebună.",
    pois: [
      { name: "Gardens by the Bay", emoji: "🌳", tags: ["nature", "family"], dur: 150, hours: "9:00–21:00", cost: 20, tip: "Spectacolul de lumini al Supertree la 19:45 și 20:45 e gratuit.", ll: [1.2816, 103.8636] },
      { name: "Marina Bay Sands SkyPark", emoji: "🏙", tags: ["culture", "family"], dur: 60, hours: "11:00–21:00", cost: 23, tip: "Sau bea ceva la barul de pe acoperiș și scapi de biletul de observație.", ll: [1.2834, 103.8607] },
      { name: "Merlion Park", emoji: "🦁", tags: ["culture", "family"], dur: 30, hours: "non-stop", cost: 0, tip: "Cea mai bună poză cu skyline-ul e de aici, seara.", ll: [1.2868, 103.8545] },
      { name: "Insula Sentosa", wiki: "Sentosa", emoji: "🏝", tags: ["family", "nature"], dur: 180, hours: "ziua", cost: 0, tip: "Plaje, Universal Studios și tiroliană; ia monorailul.", ll: [1.2494, 103.8303] },
      { name: "Chinatown", wiki: "Chinatown, Singapore", emoji: "🏮", tags: ["food", "shopping", "culture"], dur: 90, hours: "ziua", cost: 0, tip: "Mănâncă la Maxwell Food Centre — hawker food ieftin și bun.", ll: [1.2831, 103.8438] },
      { name: "Orchard Road", emoji: "🛍", tags: ["shopping"], dur: 90, hours: "10:00–22:00", cost: 0, tip: "Mall după mall cu aer condiționat — refugiu de căldură.", ll: [1.3040, 103.8318] },
      { name: "Grădina Botanică", wiki: "Singapore Botanic Gardens", emoji: "🌺", tags: ["nature", "family"], dur: 90, hours: "5:00–24:00", cost: 0, tip: "Grădina de orhidee (taxă mică) e printre cele mai frumoase din lume.", ll: [1.3138, 103.8159] },
    ],
    food: ["🍗 Hainanese chicken rice", "🦀 Chili crab", "🍜 Laksa", "🍞 Kaya toast cu ou"],
    transport: "🚈 MRT curat și eficient; ia un card EZ-Link.",
  },
  dubai: {
    name: "Dubai", country: "Emiratele Arabe Unite", emoji: "🏙", center: [25.2048, 55.2708],
    blurb: "Zgârie-nori, deșert și lux — orașul superlativelor.",
    pois: [
      { name: "Burj Khalifa", emoji: "🏙", tags: ["culture", "family"], dur: 90, hours: "9:00–23:00", cost: 40, tip: "Rezervă etajul 124 la apus, online, cu câteva zile înainte.", ll: [25.1972, 55.2744] },
      { name: "Dubai Mall & Fântâna", emoji: "⛲", tags: ["shopping", "family"], dur: 150, hours: "10:00–24:00", cost: 0, tip: "Spectacolul fântânii e din 30 în 30 de minute, seara; gratis.", ll: [25.1985, 55.2796] },
      { name: "Palm Jumeirah & Atlantis", emoji: "🌴", tags: ["family", "nature"], dur: 120, hours: "ziua", cost: 0, tip: "Ia monorailul pe palmier; The Pointe are priveliște la Atlantis.", ll: [25.1124, 55.1390] },
      { name: "Dubai Marina", emoji: "🛥", tags: ["nightlife", "food"], dur: 120, hours: "seara", cost: 0, tip: "Plimbare pe faleză (Marina Walk) și cină cu vedere la iahturi.", ll: [25.0805, 55.1403] },
      { name: "Gold Souk (Deira)", wiki: "Dubai Gold Souk", emoji: "🪙", tags: ["shopping", "culture"], dur: 75, hours: "10:00–22:00", cost: 0, tip: "Traversează creekul cu un abra de 1 dirham; negociază la aur.", ll: [25.2697, 55.2963] },
      { name: "Safari în deșert", emoji: "🐪", tags: ["nature", "nightlife", "family"], dur: 300, hours: "după-amiază", cost: 50, tip: "Dune bashing, cămile și cină cu spectacol sub stele.", ll: [24.9500, 55.5000] },
      { name: "Burj Al Arab", emoji: "⛵", tags: ["culture"], dur: 45, hours: "exterior non-stop", cost: 0, tip: "Cea mai bună poză e de pe plaja Jumeirah (Umm Suqeim).", ll: [25.1412, 55.1853] },
    ],
    food: ["🌯 Shawarma", "🍚 Machboos (orez condimentat)", "🥞 Brunch de weekend", "☕ Curmale și cafea arabă"],
    transport: "🚇 Metrou modern + taxi; orașul e uriaș, planifică distanțele.",
  },

  // ---- Oceania ----
  sydney: {
    name: "Sydney", country: "Australia", emoji: "🌊", center: [-33.8688, 151.2093],
    blurb: "Golf spectaculos, plaje de surf și Opera — cel mai relaxat oraș mare.",
    pois: [
      { name: "Opera din Sydney", emoji: "🎭", tags: ["culture", "family"], dur: 90, hours: "tururi 9:00–17:00", cost: 25, tip: "Turul interior merită; sau bea ceva la Opera Bar cu vedere la pod.", ll: [-33.8568, 151.2153] },
      { name: "Harbour Bridge", wiki: "Sydney Harbour Bridge", emoji: "🌉", tags: ["culture", "nature"], dur: 90, hours: "non-stop", cost: 0, tip: "Urcă gratis pe Pylon Lookout, sau BridgeClimb pentru adrenalină.", ll: [-33.8523, 151.2108] },
      { name: "Plaja Bondi", wiki: "Bondi Beach", emoji: "🏄", tags: ["nature", "nightlife", "family"], dur: 150, hours: "non-stop", cost: 0, tip: "Fă plimbarea pe faleză Bondi–Coogee; superbă și gratis.", ll: [-33.8908, 151.2743] },
      { name: "Cartierul The Rocks", wiki: "The Rocks, Sydney", emoji: "🏘", tags: ["culture", "food"], dur: 90, hours: "ziua", cost: 0, tip: "Cel mai vechi cartier; piață în weekend și pub-uri istorice.", ll: [-33.8599, 151.2090] },
      { name: "Grădina Botanică Regală", wiki: "Royal Botanic Garden, Sydney", emoji: "🌳", tags: ["nature", "family"], dur: 90, hours: "7:00–apus", cost: 0, tip: "Mrs Macquarie's Chair are poza clasică cu Opera și podul.", ll: [-33.8642, 151.2166] },
      { name: "Taronga Zoo", emoji: "🐨", tags: ["family", "nature"], dur: 180, hours: "9:30–17:00", cost: 30, tip: "Ia feribotul până acolo; koala și cangur cu vedere la golf.", ll: [-33.8430, 151.2413] },
      { name: "Darling Harbour", emoji: "🎡", tags: ["family", "nightlife"], dur: 120, hours: "ziua", cost: 0, tip: "Acvariu, restaurante și artificii sâmbăta seara.", ll: [-33.8748, 151.1987] },
    ],
    food: ["🥧 Meat pie", "🐟 Barramundi la grătar", "☕ Flat white", "🥑 Brunch cu avocado toast"],
    transport: "🚆 Trenuri + feriboturi pe golf; ia un card Opal.",
  },
  timisoara: {
    name: "Timișoara", country: "România", emoji: "🌹", center: [45.7539, 21.2253],
    blurb: "Orașul florilor și al piețelor baroce — Capitală Europeană a Culturii 2023.",
    pois: [
      { name: "Piața Victoriei", wiki: "Piața Victoriei din Timișoara", emoji: "🌹", tags: ["culture", "family"], dur: 60, hours: "non-stop", cost: 0, tip: "Bulevardul cu flori dintre Operă și Catedrală — inima orașului, plină de terase.", ll: [45.7537, 21.2257] },
      { name: "Catedrala Mitropolitană", wiki: "Catedrala Mitropolitană din Timișoara", emoji: "⛪", tags: ["culture"], dur: 45, hours: "7:00–20:00", cost: 0, tip: "Turlele colorate sunt simbolul orașului; urcă în turn pentru panoramă.", ll: [45.7514, 21.2249] },
      { name: "Piața Unirii", wiki: "Piața Unirii din Timișoara", emoji: "🏛", tags: ["culture", "food"], dur: 60, hours: "non-stop", cost: 0, tip: "Cea mai veche piață barocă; Palatul Baroc și catedrala catolică o încadrează.", ll: [45.7580, 21.2287] },
      { name: "Piața Libertății", wiki: "Piața Libertății din Timișoara", emoji: "⛲", tags: ["culture"], dur: 30, hours: "non-stop", cost: 0, tip: "Între Unirii și Victoriei — micuță, dar cu clădiri restaurate superb.", ll: [45.7561, 21.2270] },
      { name: "Bastionul Theresia", emoji: "🏰", tags: ["culture", "shopping", "food"], dur: 75, hours: "ziua", cost: 0, tip: "Fortificația austriacă adăpostește acum restaurante, ateliere și muzee.", ll: [45.7575, 21.2318] },
      { name: "Muzeul Național al Banatului (Castelul Huniade)", wiki: "Castelul Huniade", emoji: "🖼", tags: ["culture", "family"], dur: 90, hours: "10:00–18:00", cost: 4, tip: "Cea mai veche clădire a orașului; închis lunea.", ll: [45.7546, 21.2291] },
      { name: "Parcul Rozelor", emoji: "🌷", tags: ["nature", "family"], dur: 60, hours: "non-stop", cost: 0, tip: "Peste 300 de soiuri de trandafiri pe malul Begăi — vino în iunie.", ll: [45.7486, 21.2312] },
      { name: "Sinagoga din Cetate", emoji: "🕍", tags: ["culture"], dur: 45, hours: "10:00–18:00", cost: 3, tip: "Restaurată pentru 2023; una dintre cele mai frumoase din regiune.", ll: [45.7562, 21.2255] },
      { name: "Canalul Bega", emoji: "🚤", tags: ["nature", "nightlife"], dur: 90, hours: "non-stop", cost: 2, tip: "Plimbare pe faleză sau vaporetto electric între cartiere.", ll: [45.7523, 21.2230] },
      { name: "Muzeul Satului Bănățean", emoji: "🏘", tags: ["culture", "family", "nature"], dur: 120, hours: "10:00–18:00", cost: 3, tip: "Case tradiționale în Pădurea Verde, la marginea orașului.", ll: [45.7773, 21.2606] },
    ],
    food: ["🍲 Supă de chimen bănățeană", "🥟 Papricaș cu găluște", "🍰 Prăjituri la Cofetăria Violeta", "☕ Cafenele de specialitate în Cetate"],
    transport: "🚶 Centrul și cele 3 piețe se fac pe jos; tramvai + vaporetto pe Bega pentru distanțe mai mari.",
  },
  arad: {
    name: "Arad", country: "România", emoji: "🏛", center: [46.1740, 21.3170],
    blurb: "Bulevarde largi, palate secession și cea mai mare cetate Vauban din țară.",
    pois: [
      { name: "Cetatea Aradului", emoji: "🏰", tags: ["culture", "family"], dur: 75, hours: "tururi ghidate", cost: 0, tip: "Fortăreață în formă de stea din secolul XVIII; se vizitează cu ghid — verifică programul.", ll: [46.1866, 21.3230] },
      { name: "Palatul Administrativ", wiki: "Palatul Administrativ din Arad", emoji: "🏛", tags: ["culture"], dur: 30, hours: "exterior non-stop", cost: 0, tip: "Primăria cu turn de 54 m; clopotele cântă la fix melodii diferite.", ll: [46.1743, 21.3184] },
      { name: "Bulevardul Revoluției", emoji: "🚶", tags: ["culture", "shopping", "food"], dur: 60, hours: "ziua", cost: 0, tip: "Axa orașului, mărginită de palate și cafenele; ideal pentru o plimbare lentă.", ll: [46.1735, 21.3160] },
      { name: "Palatul Cultural", wiki: "Palatul Cultural din Arad", emoji: "🎻", tags: ["culture"], dur: 75, hours: "10:00–18:00", cost: 4, tip: "Filarmonica + Complexul Muzeal (istorie, artă, științe). Închis lunea.", ll: [46.1723, 21.3172] },
      { name: "Teatrul Clasic Ioan Slavici", emoji: "🎭", tags: ["culture"], dur: 45, hours: "spectacole seara", cost: 0, tip: "Clădire neoclasică în Piața Avram Iancu; frumoasă și pe dinafară.", ll: [46.1731, 21.3134] },
      { name: "Turnul de Apă", wiki: "Turnul de apă din Arad", emoji: "🗼", tags: ["culture"], dur: 30, hours: "ziua", cost: 0, tip: "Turn de cărămidă din 1896, reper al cartierului; uneori găzduiește expoziții.", ll: [46.1760, 21.3118] },
      { name: "Catedrala Ortodoxă Sfânta Treime", wiki: "Catedrala Sfânta Treime din Arad", emoji: "⛪", tags: ["culture"], dur: 40, hours: "8:00–20:00", cost: 0, tip: "Cea mai mare catedrală din vestul țării; interior impresionant.", ll: [46.1747, 21.3205] },
      { name: "Biserica Roșie", wiki: "Biserica Roșie din Arad", emoji: "🧱", tags: ["culture"], dur: 25, hours: "ziua", cost: 0, tip: "Biserică luterană din cărămidă roșie aparentă — neogotic curat.", ll: [46.1736, 21.3082] },
      { name: "Parcul Reconcilierii", emoji: "🕊", tags: ["culture", "nature", "family"], dur: 45, hours: "non-stop", cost: 0, tip: "Statuia Libertății și Arcul de Triumf, față în față — simbol al împăcării româno-maghiare.", ll: [46.1712, 21.3096] },
      { name: "Insula Mureș & Pădurea Ceala", emoji: "🌳", tags: ["nature", "family"], dur: 120, hours: "non-stop", cost: 0, tip: "Zonă verde pe malul Mureșului — plimbări, biciclete, ștrand vara.", ll: [46.1690, 21.2830] },
    ],
    food: ["🍲 Gulaș și papricaș bănățean", "🥩 Grătar la Ceala", "🍦 Înghețată la cofetăriile din centru", "☕ Cafea pe Bulevardul Revoluției"],
    transport: "🚶 Centrul se face pe jos; tramvai spre cetate și mașină/bus pentru Insula Mureș.",
  },
};

const FALLBACK = {
  emoji: "📍", country: "", center: null,
  blurb: "O destinație numai bună de explorat pe îndelete.",
  pois: [
    { name: "Centrul istoric", emoji: "🏛", tags: ["culture", "family"], dur: 120, hours: "ziua", cost: 0, tip: "Începe de la piața principală și lasă-te purtat." },
    { name: "Muzeul orașului", emoji: "🖼", tags: ["culture"], dur: 90, hours: "10:00–18:00", cost: 10, tip: "Multe muzee au intrare gratuită într-o zi pe lună." },
    { name: "Piața centrală & cafenele", emoji: "☕", tags: ["food", "culture"], dur: 60, hours: "ziua", cost: 0, tip: "Cafeaua de dimineață ca localnicii, la tejghea." },
    { name: "Parcul orașului", emoji: "🌳", tags: ["nature", "family"], dur: 75, hours: "non-stop", cost: 0, tip: "Perfect pentru o pauză între obiective." },
    { name: "Piață locală / bazar", emoji: "🛍", tags: ["shopping", "food"], dur: 75, hours: "dimineața", cost: 0, tip: "Cele mai bune gustări sunt la tarabele cu coadă de localnici." },
    { name: "Punct panoramic", emoji: "🌇", tags: ["nature", "nightlife"], dur: 60, hours: "apus", cost: 0, tip: "Urcă la apus pentru cea mai bună fotografie." },
    { name: "Cartierul de seară", emoji: "🍸", tags: ["nightlife", "food"], dur: 120, hours: "seara", cost: 0, tip: "Întreabă recepția hotelului unde ies localnicii." },
  ],
  food: ["🍽 Restaurant tradițional local", "☕ Cafenea de specialitate", "🍦 Înghețată artizanală", "🍷 Bar de vinuri locale"],
  transport: "🚶 Centrul se face pe jos; transport public pentru capete.",
};

// ---- budget model -----------------------------------------------------------
// per-person estimates, EUR
export const BUDGET_TIERS = {
  econom:  { label: "Econom",  emoji: "🎒", meal: 12, transportPerDay: 6 },
  mediu:   { label: "Echilibrat", emoji: "💶", meal: 25, transportPerDay: 10 },
  premium: { label: "Premium", emoji: "💎", meal: 55, transportPerDay: 30 },
};

export function computeBudget(itinerary, days, tierKey) {
  const tier = BUDGET_TIERS[tierKey] || BUDGET_TIERS.mediu;
  const tickets = itinerary.reduce((s, d) => s + d.stops.reduce((a, st) => a + (st.cost || 0), 0), 0);
  const food = tier.meal * 2 * days;          // ~2 mese pe zi
  const transport = tier.transportPerDay * days;
  const total = tickets + food + transport;
  return { tier: tierKey, tickets, food, transport, total, perDay: Math.round(total / days) };
}

// ---- helpers ----------------------------------------------------------------
const START_TIMES = ["9:00", "11:30", "13:30", "15:30", "17:30", "19:30"];

// Date for day N (1-based) of the trip, as ISO yyyy-mm-dd, or null if no start.
// Uses local date parts (not toISOString) to avoid a UTC off-by-one shift.
function dateForDay(startISO, dayIndex) {
  if (!startISO) return null;
  const d = new Date(startISO + "T00:00:00");
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + dayIndex);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const strip = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function resolveDestination(query) {
  // Match on whole words in the destination phrase (the part before the first
  // comma — after it come chip modifiers like ", un weekend"). A plain
  // substring test matched far too much: "România" contains "roma", "Ontario"
  // contains "rio", "Balikpapan" contains "bali" — each hijacked the whole
  // tier ladder and returned a curated itinerary for the wrong city.
  // Ported from the web app, where this was found and fixed first.
  const q = strip((query || "").split(",")[0]);
  const whole = (needle) =>
    !!needle && new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(q);
  for (const key of Object.keys(DESTINATIONS)) {
    const d = DESTINATIONS[key];
    if (whole(strip(key)) || whole(strip(d.name))) return { key, ...d };
  }
  return null;
}

// The generic itinerary. Reached only when a typed destination matches neither
// a curated city nor anything in the 5000-city index with packed objectives.
function genericDestination(query) {
  const name =
    (query || "Destinația ta").trim().split(/[ ,]/)[0].replace(/^\w/, (c) => c.toUpperCase()) ||
    "Destinația ta";
  return { key: "custom", name, ...FALLBACK };
}

// Tier 2: a city from the index, with its real OpenStreetMap objectives.
//
// Mirrors the web app's loadOsmDest (src/aiEngine.js) down to the candidate
// list, because the two must agree on what a typed phrase means. The one
// difference is the source: the web queries a database, this reads the bundle.
function packedDestination(query) {
  const head = (query || "").split(",")[0].trim();
  if (head.length < 2) return null;
  // Try the whole head, then the first one or two words — a destination may
  // carry trailing modifiers like "Timișoara 2 zile".
  const words = head.split(/\s+/);
  const candidates = [head, words.slice(0, 2).join(" "), words[0]]
    .filter((c, i, a) => c && a.indexOf(c) === i);

  let city = null;
  for (const cand of candidates) {
    const m = searchDestinations(cand, 1)[0];
    // nameMatchesCity is alias-aware: "București", "Londra" and "Wien" accept
    // the English-named record rather than dropping to the generic route.
    if (m && nameMatchesCity(cand, m)) { city = m; break; }
  }
  if (!city) return null;

  const payload = loadPackedPois(city.id);
  if (!payload) return null;

  const dest = buildDest(
    { name: city.n, country: city.c, ll: city.ll, emoji: "📍", blurb: "" },
    payload,
    { foodFallback: tStatic("osmFoodFallback"), transport: tStatic("osmTransport") },
  );
  // A city can clear the packing bar and still yield too little to plan with
  // once cafés and restaurants are set aside. An itinerary of two stops with a
  // full budget attached is worse than the generic one.
  if (dest.pois.length < 3) return null;
  return { ...dest, cityId: city.id };
}

function scorePoi(poi, interests) {
  if (!interests || interests.length === 0) return 1;
  const hits = poi.tags.filter((t) => interests.includes(t)).length;
  return hits > 0 ? hits + 1 : 0.2;
}

// normalize legacy budget values to a tier key
function normTier(b) {
  if (b === "low") return "econom";
  if (b === "high") return "premium";
  return BUDGET_TIERS[b] ? b : "mediu";
}

// ---- route assembly ---------------------------------------------------------
// Turns a resolved destination (local DB entry or an AI-generated one — same
// shape) plus prefs into a full route object. Shared by the mock path and the
// real AI path (aiEngine.js) so both produce identical output.
// Spread POIs across `days` days: unique & even when there's enough content,
// cycling (reusing) only when more days are requested than POIs — so no day is
// ever empty. Each day is capped at `perDay` stops.
function planDays(ranked, days, perDay) {
  const N = ranked.length;
  const out = Array.from({ length: days }, () => []);
  if (N === 0 || days <= 0) return out;

  const q = Math.floor(N / days);
  const r = N % days;
  let idx = 0;
  for (let d = 0; d < days; d++) {
    const count = Math.min(perDay, q + (d < r ? 1 : 0));
    for (let k = 0; k < count && idx < N; k++, idx++) out[d].push(ranked[idx]);
  }
  // Place leftover POIs (held back by the perDay cap) wherever there's room.
  while (idx < N) {
    let placed = false;
    for (let d = 0; d < days && idx < N; d++) {
      if (out[d].length < perDay) { out[d].push(ranked[idx++]); placed = true; }
    }
    if (!placed) break;
  }
  // Fill any empty days (only when days > N) by cycling through the list.
  let cyc = 0;
  for (let d = 0; d < days; d++) {
    if (out[d].length === 0) {
      const fill = Math.max(1, Math.min(perDay, Math.ceil(N / days) || 1));
      for (let k = 0; k < fill; k++) out[d].push(ranked[cyc++ % N]);
    }
  }
  return out;
}

export function assembleRoute(dest, prefs) {
  const interests = prefs.interests || [];
  const perDay = prefs.pace === "relaxed" ? 3 : prefs.pace === "packed" ? 5 : 4;
  const tierKey = normTier(prefs.budget);

  const ranked = [...dest.pois]
    .map((p, i) => ({ p, s: scorePoi(p, interests), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
  const N = ranked.length;

  // "Flexibil" (days === "flex") adapts the length to the destination's content;
  // otherwise clamp the requested number of days to 1..7.
  const days = prefs.days === "flex"
    ? Math.max(2, Math.min(5, Math.ceil(N / perDay) || 2))
    : Math.max(1, Math.min(7, prefs.days || 1));

  const buildStop = (poi, k) => ({
    ...poi,
    time: START_TIMES[k] || "—",
    durLabel: poi.dur >= 60 ? `${Math.round((poi.dur / 60) * 10) / 10}h` : `${poi.dur}m`,
    price: poi.cost > 0 ? `€${poi.cost}` : "gratuit",
    // AI/fallback info can be stale/hallucinated → flag for reconfirmation.
    unverified: dest.key === "ai" || dest.key === "custom",
    done: false,
  });

  const itinerary = planDays(ranked, days, perDay)
    .filter((dayStops) => dayStops.length > 0)
    .map((dayStops, d) => ({
      day: d + 1,
      date: dateForDay(prefs.startDate, d),
      stops: dayStops.map(buildStop),
      // `d % 0` is NaN and food is absent entirely on generated destinations,
      // so the unguarded index threw or produced "undefined" in the itinerary.
      lunch: dest.food?.length ? dest.food[d % dest.food.length] : "",
      transport: dest.transport,
    }));

  const totalStops = itinerary.reduce((n, day) => n + day.stops.length, 0);
  const totalHours = Math.round(
    itinerary.reduce((h, day) => h + day.stops.reduce((s, st) => s + st.dur, 0), 0) / 60
  );

  // Theme stored as a key; the display label is localized in the UI (i18n).
  const themeKey =
    interests.includes("food") ? "gourmet"
    : interests.includes("culture") ? "classic"
    : interests.includes("nature") ? "nature"
    : interests.includes("nightlife") ? "evening"
    : "essential";

  const hasMap = dest.key !== "custom" && itinerary.every((d) => d.stops.every((s) => s.ll));

  return {
    id: `${dest.key}-${days}-${Date.now()}`,
    destName: dest.name,
    country: dest.country,
    emoji: dest.emoji,
    blurb: dest.blurb,
    themeKey,
    title: dest.name, // fallback; UI builds the localized title via tripTitle()
    days,
    interests,
    pace: prefs.pace || "balanced",
    startDate: prefs.startDate || null,
    budget: computeBudget(itinerary, days, tierKey),
    center: dest.center,
    hasMap,
    itinerary,
    totalStops,
    totalHours,
  };
}

// Recompute derived fields (totals + budget) after the itinerary is edited
// in-place — used by the stop-editing UI on the Route screen.
export function recomputeRoute(route) {
  const totalStops = route.itinerary.reduce((n, day) => n + day.stops.length, 0);
  const totalHours = Math.round(
    route.itinerary.reduce((h, day) => h + day.stops.reduce((s, st) => s + (st.dur || 0), 0), 0) / 60
  );
  const budget = computeBudget(route.itinerary, route.days, route.budget?.tier || "mediu");
  return { ...route, totalStops, totalHours, budget };
}

// prefs: { destination, days, interests:[], pace, budget }
//
// Async because tier 2 evaluates a ~600 KB shard of packed objectives the first
// time a city in it is opened. App.js already holds the loading screen for a
// minimum of 2.6 seconds, so this is hidden entirely.
export async function generateRoute(prefs) {
  const dest =
    resolveDestination(prefs.destination)
    || packedDestination(prefs.destination)
    || genericDestination(prefs.destination);
  return assembleRoute(dest, prefs);
}

export function needsClarification(prefs) {
  return !prefs.days || !prefs.interests || prefs.interests.length === 0;
}

// `cat` drives the tile's SVG icon (CategoryIcon) now that the UI is emoji-free;
// the emoji stays for text exports/share strings.
// Destination tiles for the Home grid. Kept identical to the web app's list
// (src/mockEngine.js) so both platforms offer the same places. Entries carry an
// ISO country code rather than a pre-translated country name: the old native
// list hard-coded Romanian ("Franța") and showed it to English users too.
export const POPULAR = [
  // Europe
  { q: "Paris",             emoji: "🗼", country: "FR", cat: "culture" },
  { q: "London",            emoji: "🎡", country: "GB", cat: "culture" },
  { q: "Roma",              emoji: "🍕", country: "IT", cat: "food" },
  { q: "Barcelona",         emoji: "🏛", country: "ES", cat: "culture" },
  { q: "Amsterdam",         emoji: "🚲", country: "NL", cat: "culture" },
  { q: "Berlin",            emoji: "🎨", country: "DE", cat: "nightlife" },
  { q: "Prague",            emoji: "🏰", country: "CZ", cat: "culture" },
  { q: "Vienna",            emoji: "🎼", country: "AT", cat: "culture" },
  { q: "Budapest",          emoji: "♨️", country: "HU", cat: "nightlife" },
  { q: "Athens",            emoji: "🏛", country: "GR", cat: "culture" },
  { q: "Lisbon",            emoji: "🚋", country: "PT", cat: "food" },
  { q: "Madrid",            emoji: "💃", country: "ES", cat: "food" },
  { q: "Istanbul",          emoji: "🕌", country: "TR", cat: "culture" },
  { q: "Dublin",            emoji: "🍺", country: "IE", cat: "nightlife" },
  { q: "Copenhagen",        emoji: "🚴", country: "DK", cat: "culture" },
  { q: "Stockholm",         emoji: "🌊", country: "SE", cat: "culture" },
  { q: "Oslo",              emoji: "⛰", country: "NO", cat: "nature" },
  { q: "Helsinki",          emoji: "🧖", country: "FI", cat: "culture" },
  { q: "Reykjavik",         emoji: "🌋", country: "IS", cat: "nature" },
  { q: "Edinburgh",         emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", country: "GB", cat: "culture" },
  { q: "Venice",            emoji: "🛶", country: "IT", cat: "culture" },
  { q: "Florence",          emoji: "🖼", country: "IT", cat: "culture" },
  { q: "Milan",             emoji: "👗", country: "IT", cat: "shopping" },
  { q: "Munich",            emoji: "🍺", country: "DE", cat: "food" },
  { q: "Zurich",            emoji: "🏔", country: "CH", cat: "nature" },
  { q: "Santorini",         emoji: "🌅", country: "GR", cat: "nature" },
  { q: "Mykonos",           emoji: "🏖", country: "GR", cat: "nightlife" },
  { q: "Dubrovnik",         emoji: "⛵", country: "HR", cat: "culture" },
  { q: "Split",             emoji: "🏝", country: "HR", cat: "nature" },
  { q: "Kraków",            emoji: "🏰", country: "PL", cat: "culture" },
  { q: "Warsaw",            emoji: "🎭", country: "PL", cat: "culture" },
  { q: "Bucharest",         emoji: "🎪", country: "RO", cat: "nightlife" },
  { q: "Brașov",            emoji: "🏔", country: "RO", cat: "nature" },
  { q: "Sibiu",             emoji: "🏛", country: "RO", cat: "culture" },
  { q: "Cluj-Napoca",       emoji: "🎓", country: "RO", cat: "nightlife" },
  { q: "Porto",             emoji: "🍷", country: "PT", cat: "food" },
  { q: "Sevilla",           emoji: "💃", country: "ES", cat: "culture" },
  { q: "Granada",           emoji: "🏛", country: "ES", cat: "culture" },
  { q: "Nice",              emoji: "🏖", country: "FR", cat: "nature" },
  { q: "Marseille",         emoji: "⛵", country: "FR", cat: "food" },
  { q: "Bruges",            emoji: "🌉", country: "BE", cat: "culture" },
  { q: "Brussels",          emoji: "🍫", country: "BE", cat: "food" },

  // Asia
  { q: "Tokyo",             emoji: "⛩", country: "JP", cat: "culture" },
  { q: "Kyoto",             emoji: "🌸", country: "JP", cat: "culture" },
  { q: "Osaka",             emoji: "🍜", country: "JP", cat: "food" },
  { q: "Bangkok",           emoji: "🛕", country: "TH", cat: "food" },
  { q: "Chiang Mai",        emoji: "🐘", country: "TH", cat: "nature" },
  { q: "Phuket",            emoji: "🏝", country: "TH", cat: "nature" },
  { q: "Singapore",         emoji: "🌆", country: "SG", cat: "food" },
  { q: "Hong Kong",         emoji: "🌃", country: "HK", cat: "shopping" },
  { q: "Seoul",             emoji: "🎤", country: "KR", cat: "nightlife" },
  { q: "Busan",             emoji: "🌊", country: "KR", cat: "food" },
  { q: "Shanghai",          emoji: "🏙", country: "CN", cat: "shopping" },
  { q: "Beijing",           emoji: "🏯", country: "CN", cat: "culture" },
  { q: "Xi'an",             emoji: "🐎", country: "CN", cat: "culture" },
  { q: "Bali",              emoji: "🌴", country: "ID", cat: "nature" },
  { q: "Jakarta",           emoji: "🕌", country: "ID", cat: "food" },
  { q: "Kuala Lumpur",      emoji: "🏙", country: "MY", cat: "food" },
  { q: "Ho Chi Minh City",  emoji: "🍜", country: "VN", cat: "food" },
  { q: "Hanoi",             emoji: "🛺", country: "VN", cat: "culture" },
  { q: "Mumbai",            emoji: "🎬", country: "IN", cat: "culture" },
  { q: "Delhi",             emoji: "🕌", country: "IN", cat: "culture" },
  { q: "Jaipur",            emoji: "🐘", country: "IN", cat: "culture" },
  { q: "Goa",               emoji: "🏖", country: "IN", cat: "nature" },
  { q: "Taipei",            emoji: "🌃", country: "TW", cat: "food" },
  { q: "Manila",            emoji: "🌊", country: "PH", cat: "nature" },
  { q: "Colombo",           emoji: "🌴", country: "LK", cat: "nature" },
  { q: "Malé",              emoji: "🏝", country: "MV", cat: "nature" },
  { q: "Amman",             emoji: "🏛", country: "JO", cat: "culture" },
  { q: "Tel Aviv",          emoji: "🏖", country: "IL", cat: "nightlife" },
  { q: "Jerusalem",         emoji: "🕍", country: "IL", cat: "culture" },
  { q: "Dubai",             emoji: "🏙", country: "AE", cat: "shopping" },
  { q: "Abu Dhabi",         emoji: "🕌", country: "AE", cat: "family" },
  { q: "Doha",              emoji: "🏙", country: "QA", cat: "family" },
  { q: "Muscat",            emoji: "⛵", country: "OM", cat: "nature" },

  // Americas
  { q: "New York",          emoji: "🗽", country: "US", cat: "shopping" },
  { q: "Los Angeles",       emoji: "🌴", country: "US", cat: "nightlife" },
  { q: "San Francisco",     emoji: "🌉", country: "US", cat: "nature" },
  { q: "Miami",             emoji: "🏖", country: "US", cat: "nightlife" },
  { q: "Las Vegas",         emoji: "🎰", country: "US", cat: "nightlife" },
  { q: "Chicago",           emoji: "🍕", country: "US", cat: "food" },
  { q: "New Orleans",       emoji: "🎷", country: "US", cat: "food" },
  { q: "Washington",        emoji: "🏛", country: "US", cat: "culture" },
  { q: "Boston",            emoji: "📚", country: "US", cat: "culture" },
  { q: "Seattle",           emoji: "☕", country: "US", cat: "food" },
  { q: "Honolulu",          emoji: "🌺", country: "US", cat: "nature" },
  { q: "Toronto",           emoji: "🍁", country: "CA", cat: "culture" },
  { q: "Montreal",          emoji: "🎨", country: "CA", cat: "culture" },
  { q: "Vancouver",          emoji: "🌲", country: "CA", cat: "nature" },
  { q: "Mexico City",       emoji: "🌮", country: "MX", cat: "culture" },
  { q: "Cancún",            emoji: "🏝", country: "MX", cat: "nature" },
  { q: "Havana",            emoji: "🚗", country: "CU", cat: "culture" },
  { q: "Rio de Janeiro",    emoji: "🏖", country: "BR", cat: "nature" },
  { q: "São Paulo",         emoji: "🌆", country: "BR", cat: "food" },
  { q: "Buenos Aires",      emoji: "🍷", country: "AR", cat: "food" },
  { q: "Santiago",          emoji: "🏔", country: "CL", cat: "food" },
  { q: "Lima",              emoji: "🍽", country: "PE", cat: "food" },
  { q: "Cusco",             emoji: "🏔", country: "PE", cat: "culture" },
  { q: "Cartagena",         emoji: "🏰", country: "CO", cat: "culture" },
  { q: "Bogotá",            emoji: "☕", country: "CO", cat: "food" },

  // Africa
  { q: "Marrakech",         emoji: "🕌", country: "MA", cat: "culture" },
  { q: "Fes",               emoji: "🕌", country: "MA", cat: "culture" },
  { q: "Casablanca",        emoji: "🌊", country: "MA", cat: "culture" },
  { q: "Cairo",             emoji: "🐪", country: "EG", cat: "family" },
  { q: "Luxor",             emoji: "🏛", country: "EG", cat: "culture" },
  { q: "Cape Town",         emoji: "⛰", country: "ZA", cat: "nature" },
  { q: "Johannesburg",      emoji: "🦁", country: "ZA", cat: "culture" },
  { q: "Zanzibar",          emoji: "🏖", country: "TZ", cat: "nature" },
  { q: "Nairobi",           emoji: "🦒", country: "KE", cat: "nature" },
  { q: "Tunis",             emoji: "🕌", country: "TN", cat: "culture" },
  { q: "Addis Ababa",       emoji: "☕", country: "ET", cat: "culture" },

  // Oceania
  { q: "Sydney",            emoji: "🌊", country: "AU", cat: "nature" },
  { q: "Melbourne",         emoji: "☕", country: "AU", cat: "food" },
  { q: "Brisbane",          emoji: "🌴", country: "AU", cat: "nature" },
  { q: "Auckland",          emoji: "⛵", country: "NZ", cat: "nature" },
  { q: "Queenstown",        emoji: "🏔", country: "NZ", cat: "nature" },
];
