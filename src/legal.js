// Single source of truth for every legal document in the product.
//
// Rendered in-app by components/LegalSheet.jsx and compiled into the public
// pages (privacy / terms / account deletion) by scripts/build-legal-pages.mjs,
// which both stores require as hosted URLs. Keeping one copy means the app and
// the website can never drift apart.
//
// Written to describe THIS app as it actually behaves: no backend, no ads, no
// analytics, no payments. If a behaviour changes, change it here first.
//
// ⚠️ Honest template, not legal advice — have a lawyer review before a
// commercial launch, especially the liability and governing-law sections.

export const LEGAL_UPDATED = { en: "Last updated: July 2026", ro: "Ultima actualizare: iulie 2026" };
export const LEGAL_CONTACT_EMAIL = "rancea.alexandru99@gmail.com";

export const LEGAL = {
  en: {
    updated: LEGAL_UPDATED.en,
    contact: `Contact: ${LEGAL_CONTACT_EMAIL}`,

    privacyTitle: "Privacy Policy",
    privacy: [
      ["The short version", "Your trips, photos, searches, preferences and account live on your device and are never uploaded to us. We run no ads, no analytics and no tracking, and we never sell data. If you buy a subscription, the app store handles the payment — we never see your card."],
      ["What we store on your device", "Saved trips, recent searches, language and theme preferences, and a local account if you create one. Photos you add are stored in your device's own storage. Nothing here leaves the device unless you explicitly share a trip."],
      ["Your account", "An account is optional — you can use the app as a guest. If you create one, the email, display name and a salted SHA-256 hash of your password are stored on your device only. We never see your password, and there is no server holding your account."],
      ["Location", "Only if you tap “From here”: we ask the device for your position once, to build directions from where you are. It is used in that moment, never stored and never sent to us."],
      ["Camera and photos", "Only if you allow it, and only to attach photos to your trip gallery. Photos stay on your device; we cannot see them."],
      ["Services we call", "To build and enrich routes the app contacts, as needed: OpenStreetMap Overpass (overpass-api.de, overpass.kumi.systems, maps.mail.ru) for real attractions; OpenStreetMap Nominatim for place search; Open-Meteo for weather; Wikipedia and Wikimedia Commons for photos; CARTO for map tiles; and — only in builds configured with an API key — Anthropic's Claude API for AI-generated itineraries. These requests carry the destination and preferences needed to answer them, plus your IP address as with any web request. Each provider has its own privacy policy."],
      ["Sharing a trip", "Sharing encodes the trip into a link or QR code. Anyone holding that link can open that trip. Personal notes, ratings and visited marks are stripped before sharing. Links are not registered with us — we cannot see, list or revoke them, so only share with people you trust."],
      ["Purchases", "Subscriptions are sold and processed by Google Play or the Apple App Store. They are the ones handling your payment method and billing record; we never receive your card number or billing address. To know whether to unlock paid features, the app asks the store whether your purchase is active — that check involves a purchase identifier issued by the store, not your identity. We do not build a profile from it and it is not linked to your trips."],
      ["Crash reports", "The app keeps a small log of its own errors on your device so problems can be diagnosed. If a build is configured with a crash-reporting endpoint, technical error details (message, stack trace, app version, device type) may be sent — never trip content or anything you typed."],
      ["Children", "The app is not directed at children under 16 and we do not knowingly collect data from them. Since no data reaches us at all, there is nothing for us to collect."],
      ["Your rights (GDPR)", "Because everything is stored locally, you already hold your data directly. Access and portability: your trips are visible in-app and exportable as PDF, calendar or a share link. Erasure: delete a trip or photo individually, delete your account, or erase everything from the Me screen. Contact us for any request you cannot complete yourself."],
      ["Deleting your account", "Me → Delete account removes the account, its name and its password hash from this device and signs you out. Saved trips and photos stay on the device unless you also choose Erase all data, which removes everything, permanently and immediately."],
      ["Retention", "We hold nothing, so we retain nothing. Data on your device stays until you delete it or uninstall the app."],
      ["Changes", "If this policy changes, the date above changes and the updated text appears in the app. Material changes will be highlighted on first launch after the update."],
    ],

    termsTitle: "Terms of Use",
    terms: [
      ["Agreement", "By using the app you accept these terms. If you do not agree, please do not use it."],
      ["What the app is", "A travel-planning tool. It proposes itineraries built from open data and, in some builds, from AI. It is not a booking service, a travel agency or a guide service: we do not sell, reserve or arrange travel, tickets or accommodation, and we are not a party to anything you book elsewhere."],
      ["Accuracy — read this one", "Attractions, opening hours, prices, durations and travel times are estimates from open data or generated automatically. They can be outdated or simply wrong. Ticket prices shown with a “~” are our per-category estimates, not quoted prices. Always reconfirm with the official source before you travel, book or spend money."],
      ["Your responsibility", "You are responsible for your own safety, bookings, documents and decisions, and for complying with local law at your destination. Check official travel, health and safety advice yourself."],
      ["Acceptable use", "Use the app for personal trip planning. Do not use the share feature to distribute unlawful content, and do not attempt to disrupt, overload or reverse-engineer the app or the third-party services it relies on."],
      ["Accounts", "Accounts are local to your device. Keep your password to yourself. Because there is no server, we cannot recover a lost password or restore data from a lost or reset device — treat your device as the only copy."],
      ["Subscriptions and payments", "The app is free to install and use. Some features may require a paid subscription; exactly which ones, and the price for your country including VAT, are shown in the app before you confirm anything. Purchases are processed only by Google Play or the Apple App Store — we never see, receive or store your card details. A subscription renews automatically for the same period and price until you cancel, and the store charges you shortly before each renewal."],
      ["Cancelling and refunds", "Cancel at any time from your store account's subscription settings — on Google Play under Payments & subscriptions, on iOS under Settings → your name → Subscriptions. Cancelling stops the next renewal; your access continues until the end of the period you already paid for, and no partial refund is due for that period. Deleting the app does NOT cancel a subscription. Refunds are handled by the store under its own policy. If a free trial is offered it turns into a paid subscription unless you cancel before it ends."],
      ["Price changes and your rights", "We will tell you before any price increase, and it takes effect only from a renewal after that notice — you can always cancel instead. EU right of withdrawal: digital services normally carry 14 days to withdraw; by starting a subscription you ask for immediate access and accept that this right ends once access begins. That does not affect the store's refund policy or any statutory right that cannot be waived. If a subscription lapses, your trips, photos and account stay on your device and the app keeps working — only the paid features stop. Features that are free today will not be taken away and resold."],
      ["Content and licences", "Attraction data comes from OpenStreetMap, © OpenStreetMap contributors, licensed ODbL. City data comes from Wikidata (CC0). Photos come from Wikipedia and Wikimedia Commons under their respective Creative Commons licences — tap the “via Wikipedia” tag on a photo to reach the source article, its author and its licence. Map tiles are © CARTO. Respect those licences if you reuse anything."],
      ["Availability", "The app is provided “as is”, without warranty. Features that depend on third-party services can slow down or fail when those services do; saved trips remain readable offline. We may change or discontinue features."],
      ["Liability", "To the extent permitted by law, we are not liable for indirect or consequential loss arising from use of the app, including missed visits, closed venues, wasted expense or travel disruption. Nothing here limits liability that cannot be limited by law, and your statutory consumer rights are unaffected."],
      ["Changes and governing law", "These terms may change; the date above will change with them. They are governed by Romanian law, and if you are a consumer in the EU you keep the protections of your country of residence."],
    ],
  },

  ro: {
    updated: LEGAL_UPDATED.ro,
    contact: `Contact: ${LEGAL_CONTACT_EMAIL}`,

    privacyTitle: "Politica de confidențialitate",
    privacy: [
      ["Pe scurt", "Traseele, pozele, căutările, preferințele și contul tău stau pe dispozitivul tău și nu ajung niciodată la noi. Nu avem reclame, nu avem analytics, nu te urmărim și nu vindem date. Dacă îți iei un abonament, magazinul de aplicații se ocupă de plată — noi nu îți vedem niciodată cardul."],
      ["Ce se stochează pe dispozitivul tău", "Traseele salvate, căutările recente, limba și tema, plus un cont local dacă îți creezi unul. Pozele adăugate stau în stocarea dispozitivului. Nimic nu pleacă de acolo decât dacă partajezi tu explicit un traseu."],
      ["Contul tău", "Contul e opțional — poți folosi aplicația ca invitat. Dacă îl creezi, emailul, numele afișat și un hash SHA-256 cu sare al parolei sunt păstrate doar pe dispozitiv. Nu îți vedem niciodată parola și nu există un server care să îți țină contul."],
      ["Locația", "Doar dacă apeși „De aici”: cerem o singură dată poziția dispozitivului, ca să construim direcții de unde te afli. E folosită pe loc, nu e stocată și nu ne e trimisă."],
      ["Camera și pozele", "Doar dacă permiți, și doar ca să atașezi poze la galeria călătoriei. Pozele rămân pe dispozitiv; noi nu le putem vedea."],
      ["Serviciile pe care le apelăm", "Ca să construiască și să îmbogățească traseele, aplicația contactează, după caz: OpenStreetMap Overpass (overpass-api.de, overpass.kumi.systems, maps.mail.ru) pentru atracții reale; OpenStreetMap Nominatim pentru căutarea locurilor; Open-Meteo pentru vreme; Wikipedia și Wikimedia Commons pentru poze; CARTO pentru dalele hărții; și — doar în versiunile configurate cu o cheie API — API-ul Claude de la Anthropic pentru itinerarii generate cu AI. Aceste cereri conțin destinația și preferințele necesare pentru a răspunde, plus adresa ta IP, ca la orice cerere web. Fiecare furnizor are propria politică de confidențialitate."],
      ["Partajarea unui traseu", "Partajarea codifică traseul într-un link sau cod QR. Oricine are linkul poate deschide traseul. Notițele personale, rating-urile și bifele de „vizitat” sunt eliminate înainte de partajare. Linkurile nu sunt înregistrate la noi — nu le putem vedea, lista sau revoca, deci partajează doar cu oameni în care ai încredere."],
      ["Cumpărături", "Abonamentele sunt vândute și procesate de Google Play sau Apple App Store. Ei sunt cei care îți gestionează metoda de plată și istoricul de facturare; noi nu primim niciodată numărul cardului sau adresa de facturare. Ca să știe dacă deblochează funcțiile plătite, aplicația întreabă magazinul dacă achiziția ta e activă — verificarea folosește un identificator de achiziție emis de magazin, nu identitatea ta. Nu construim niciun profil din el și nu e legat de traseele tale."],
      ["Rapoartele de eroare", "Aplicația păstrează pe dispozitiv un jurnal mic cu propriile erori, ca problemele să poată fi diagnosticate. Dacă o versiune e configurată cu un serviciu de raportare, pot fi trimise detalii tehnice (mesaj, stivă de apel, versiunea aplicației, tipul dispozitivului) — niciodată conținutul traseelor sau ce ai scris tu."],
      ["Copii", "Aplicația nu se adresează copiilor sub 16 ani și nu colectăm cu bună știință date de la ei. Cum nu ajunge niciun fel de date la noi, nu avem ce colecta."],
      ["Drepturile tale (GDPR)", "Pentru că totul e stocat local, îți deții deja datele direct. Acces și portabilitate: traseele sunt vizibile în aplicație și pot fi exportate ca PDF, calendar sau link de partajare. Ștergere: șterge un traseu sau o poză individual, șterge-ți contul, ori șterge tot din ecranul Eu. Scrie-ne pentru orice cerere pe care nu o poți rezolva singur."],
      ["Ștergerea contului", "Eu → Șterge contul elimină contul, numele și hash-ul parolei de pe acest dispozitiv și te deconectează. Traseele și pozele salvate rămân pe dispozitiv, dacă nu alegi și Șterge toate datele, care elimină tot, definitiv și imediat."],
      ["Păstrarea datelor", "Nu deținem nimic, deci nu păstrăm nimic. Datele de pe dispozitiv rămân până le ștergi tu sau dezinstalezi aplicația."],
      ["Modificări", "Dacă această politică se schimbă, se schimbă și data de mai sus, iar textul actualizat apare în aplicație. Modificările importante vor fi semnalate la prima deschidere după actualizare."],
    ],

    termsTitle: "Termeni de utilizare",
    terms: [
      ["Acord", "Prin folosirea aplicației accepți acești termeni. Dacă nu ești de acord, te rugăm să nu o folosești."],
      ["Ce este aplicația", "Un instrument de planificare a călătoriilor. Propune itinerarii construite din date deschise și, în unele versiuni, cu AI. Nu e serviciu de rezervări, agenție de turism sau serviciu de ghid: nu vindem, nu rezervăm și nu intermediem călătorii, bilete sau cazare, și nu suntem parte în nimic din ce rezervi în altă parte."],
      ["Acuratețea — citește asta", "Atracțiile, programul, prețurile, duratele și timpii de deplasare sunt estimări din date deschise sau generate automat. Pot fi neactualizate sau pur și simplu greșite. Prețurile afișate cu „~” sunt estimările noastre pe categorie, nu prețuri oficiale. Reconfirmă mereu din sursa oficială înainte să pleci, să rezervi sau să cheltui bani."],
      ["Responsabilitatea ta", "Ești responsabil de siguranța, rezervările, documentele și deciziile tale, precum și de respectarea legilor locale la destinație. Verifică singur avertismentele oficiale de călătorie, sănătate și siguranță."],
      ["Utilizare acceptabilă", "Folosește aplicația pentru planificare personală. Nu folosi partajarea pentru conținut ilegal și nu încerca să perturbi, să suprasoliciți sau să faci inginerie inversă asupra aplicației ori a serviciilor terțe pe care se bazează."],
      ["Conturi", "Conturile sunt locale, pe dispozitivul tău. Păstrează parola pentru tine. Cum nu există server, nu putem recupera o parolă pierdută și nu putem restaura date de pe un dispozitiv pierdut sau resetat — tratează dispozitivul ca pe singura copie."],
      ["Abonamente și plăți", "Aplicația se instalează și se folosește gratuit. Unele funcții pot necesita un abonament plătit; exact care sunt acelea și prețul pentru țara ta, cu TVA inclus, îți sunt arătate în aplicație înainte să confirmi ceva. Plățile sunt procesate exclusiv de Google Play sau Apple App Store — noi nu îți vedem, nu primim și nu stocăm datele cardului. Abonamentul se reînnoiește automat pentru aceeași perioadă și același preț până îl anulezi, iar magazinul îți face plata cu puțin timp înainte de fiecare reînnoire."],
      ["Anulare și rambursări", "Poți anula oricând din setările de abonament ale contului tău de magazin — pe Google Play la Plăți și abonamente, pe iOS la Setări → numele tău → Abonamente. Anularea oprește următoarea reînnoire; accesul continuă până la finalul perioadei deja plătite și nu se restituie proporțional pentru acea perioadă. Ștergerea aplicației NU anulează abonamentul. Rambursările sunt gestionate de magazin, după politica lui. Dacă e oferită o perioadă de probă gratuită, ea devine abonament plătit dacă nu anulezi înainte să se termine."],
      ["Modificări de preț și drepturile tale", "Te anunțăm înainte de orice majorare de preț, iar ea se aplică doar de la o reînnoire ulterioară acelei notificări — poți oricând să anulezi în schimb. Dreptul de retragere în UE: serviciile digitale au în mod normal 14 zile de retragere; pornind un abonament ceri acces imediat și accepți că acest drept încetează odată ce accesul începe. Asta nu afectează politica de rambursare a magazinului și nici vreun drept legal care nu poate fi renunțat. Dacă abonamentul expiră, traseele, pozele și contul rămân pe dispozitiv, iar aplicația funcționează în continuare — se opresc doar funcțiile plătite. Funcțiile gratuite de azi nu vor fi retrase ca să fie revândute."],
      ["Conținut și licențe", "Datele despre atracții provin din OpenStreetMap, © contribuitorii OpenStreetMap, sub licența ODbL. Datele despre orașe provin din Wikidata (CC0). Pozele provin din Wikipedia și Wikimedia Commons, sub licențele Creative Commons corespunzătoare — apasă eticheta „via Wikipedia” de pe o poză ca să ajungi la articolul-sursă, autor și licență. Dalele hărții sunt © CARTO. Respectă aceste licențe dacă refolosești ceva."],
      ["Disponibilitate", "Aplicația e oferită „ca atare”, fără garanții. Funcțiile care depind de servicii terțe pot încetini sau eșua când acele servicii au probleme; traseele salvate rămân accesibile offline. Putem modifica sau retrage funcții."],
      ["Răspundere", "În limita permisă de lege, nu răspundem pentru pierderi indirecte sau subsecvente rezultate din folosirea aplicației, inclusiv vizite ratate, obiective închise, cheltuieli inutile sau perturbări de călătorie. Nimic de aici nu limitează răspunderea care nu poate fi limitată legal, iar drepturile tale de consumator rămân neatinse."],
      ["Modificări și legea aplicabilă", "Acești termeni se pot schimba; data de mai sus se va schimba odată cu ei. Sunt guvernați de legea română, iar dacă ești consumator în UE păstrezi protecțiile din țara ta de reședință."],
    ],
  },
};

// Standalone account-deletion instructions. Google Play requires a publicly
// reachable URL describing exactly this, reviewed independently of the app.
export const ACCOUNT_DELETION = {
  en: {
    title: "Deleting your account and data",
    intro: "“Turism, dar simplu!” stores your account and all your data on your own device. There is no server-side copy, so deletion is immediate and complete — nothing has to be requested from us.",
    steps: [
      ["Delete your account", "Open the app → Me → Delete account. This removes your email, display name and password hash from the device and signs you out. Your saved trips and photos remain on the device."],
      ["Delete everything", "Open the app → Me → Erase all data. This permanently removes the account, all saved trips, searches, preferences, consent state and every photo in the trip gallery. It cannot be undone."],
      ["Uninstalling", "Uninstalling the app also removes all of its local data, with the same effect as Erase all data."],
    ],
    retention: "What we keep afterwards: nothing. We hold no account records, no trip data and no backups, because none of it ever reaches us. Trip links you shared before deleting remain readable by whoever already has them — they contain the trip itself and are not registered with us, so they cannot be revoked.",
    help: `If you cannot access the app and need help, write to ${LEGAL_CONTACT_EMAIL} and we will explain how to clear the app's local data on your device.`,
  },
  ro: {
    title: "Ștergerea contului și a datelor",
    intro: "„Turism, dar simplu!” păstrează contul și toate datele tale pe propriul dispozitiv. Nu există o copie pe server, așa că ștergerea e imediată și completă — nu trebuie să ceri nimic de la noi.",
    steps: [
      ["Șterge contul", "Deschide aplicația → Eu → Șterge contul. Elimină emailul, numele afișat și hash-ul parolei de pe dispozitiv și te deconectează. Traseele și pozele salvate rămân pe dispozitiv."],
      ["Șterge tot", "Deschide aplicația → Eu → Șterge toate datele. Elimină definitiv contul, toate traseele salvate, căutările, preferințele, acordul și fiecare poză din galerie. Nu se poate anula."],
      ["Dezinstalarea", "Dezinstalarea aplicației îi șterge de asemenea toate datele locale, cu același efect ca Șterge toate datele."],
    ],
    retention: "Ce păstrăm după aceea: nimic. Nu deținem înregistrări de cont, date despre trasee sau copii de rezervă, pentru că nimic din toate acestea nu ajunge vreodată la noi. Linkurile de traseu partajate înainte de ștergere rămân accesibile celor care le au deja — conțin traseul în ele și nu sunt înregistrate la noi, deci nu pot fi revocate.",
    help: `Dacă nu poți accesa aplicația și ai nevoie de ajutor, scrie la ${LEGAL_CONTACT_EMAIL} și îți explicăm cum să ștergi datele locale ale aplicației de pe dispozitiv.`,
  },
};
