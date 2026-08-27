// Country names in all 16 app languages. GENERATED — do not edit by hand.
// Regenerate with:  node scripts/gen-country-names.mjs
//
// Source: Node's full-ICU CLDR data, the same dataset browsers and phones use.
// Frozen into a table because Hermes (the native JS engine) ships no
// Intl.DisplayNames — the web app looks these up live, the native app cannot.
//
// 61 countries × 16 languages.

const NAMES = {
  AE: { en: "United Arab Emirates", ro: "Emiratele Arabe Unite", fr: "Émirats arabes unis", es: "Emiratos Árabes Unidos", it: "Emirati Arabi Uniti", de: "Vereinigte Arabische Emirate", pl: "Zjednoczone Emiraty Arabskie", ru: "ОАЭ", zh: "阿拉伯联合酋长国", ja: "アラブ首長国連邦", pt: "Emirados Árabes Unidos", nl: "Verenigde Arabische Emiraten", tr: "Birleşik Arap Emirlikleri", el: "Ηνωμένα Αραβικά Εμιράτα", uk: "Обʼєднані Арабські Емірати", ko: "아랍에미리트" },
  AR: { en: "Argentina", ro: "Argentina", fr: "Argentine", es: "Argentina", it: "Argentina", de: "Argentinien", pl: "Argentyna", ru: "Аргентина", zh: "阿根廷", ja: "アルゼンチン", pt: "Argentina", nl: "Argentinië", tr: "Arjantin", el: "Αργεντινή", uk: "Аргентина", ko: "아르헨티나" },
  AT: { en: "Austria", ro: "Austria", fr: "Autriche", es: "Austria", it: "Austria", de: "Österreich", pl: "Austria", ru: "Австрия", zh: "奥地利", ja: "オーストリア", pt: "Áustria", nl: "Oostenrijk", tr: "Avusturya", el: "Αυστρία", uk: "Австрія", ko: "오스트리아" },
  AU: { en: "Australia", ro: "Australia", fr: "Australie", es: "Australia", it: "Australia", de: "Australien", pl: "Australia", ru: "Австралия", zh: "澳大利亚", ja: "オーストラリア", pt: "Austrália", nl: "Australië", tr: "Avustralya", el: "Αυστραλία", uk: "Австралія", ko: "오스트레일리아" },
  BE: { en: "Belgium", ro: "Belgia", fr: "Belgique", es: "Bélgica", it: "Belgio", de: "Belgien", pl: "Belgia", ru: "Бельгия", zh: "比利时", ja: "ベルギー", pt: "Bélgica", nl: "België", tr: "Belçika", el: "Βέλγιο", uk: "Бельгія", ko: "벨기에" },
  BR: { en: "Brazil", ro: "Brazilia", fr: "Brésil", es: "Brasil", it: "Brasile", de: "Brasilien", pl: "Brazylia", ru: "Бразилия", zh: "巴西", ja: "ブラジル", pt: "Brasil", nl: "Brazilië", tr: "Brezilya", el: "Βραζιλία", uk: "Бразилія", ko: "브라질" },
  CA: { en: "Canada", ro: "Canada", fr: "Canada", es: "Canadá", it: "Canada", de: "Kanada", pl: "Kanada", ru: "Канада", zh: "加拿大", ja: "カナダ", pt: "Canadá", nl: "Canada", tr: "Kanada", el: "Καναδάς", uk: "Канада", ko: "캐나다" },
  CH: { en: "Switzerland", ro: "Elveția", fr: "Suisse", es: "Suiza", it: "Svizzera", de: "Schweiz", pl: "Szwajcaria", ru: "Швейцария", zh: "瑞士", ja: "スイス", pt: "Suíça", nl: "Zwitserland", tr: "İsviçre", el: "Ελβετία", uk: "Швейцарія", ko: "스위스" },
  CL: { en: "Chile", ro: "Chile", fr: "Chili", es: "Chile", it: "Cile", de: "Chile", pl: "Chile", ru: "Чили", zh: "智利", ja: "チリ", pt: "Chile", nl: "Chili", tr: "Şili", el: "Χιλή", uk: "Чилі", ko: "칠레" },
  CN: { en: "China", ro: "China", fr: "Chine", es: "China", it: "Cina", de: "China", pl: "Chiny", ru: "Китай", zh: "中国", ja: "中国", pt: "China", nl: "China", tr: "Çin", el: "Κίνα", uk: "Китай", ko: "중국" },
  CO: { en: "Colombia", ro: "Columbia", fr: "Colombie", es: "Colombia", it: "Colombia", de: "Kolumbien", pl: "Kolumbia", ru: "Колумбия", zh: "哥伦比亚", ja: "コロンビア", pt: "Colômbia", nl: "Colombia", tr: "Kolombiya", el: "Κολομβία", uk: "Колумбія", ko: "콜롬비아" },
  CU: { en: "Cuba", ro: "Cuba", fr: "Cuba", es: "Cuba", it: "Cuba", de: "Kuba", pl: "Kuba", ru: "Куба", zh: "古巴", ja: "キューバ", pt: "Cuba", nl: "Cuba", tr: "Küba", el: "Κούβα", uk: "Куба", ko: "쿠바" },
  CZ: { en: "Czechia", ro: "Cehia", fr: "Tchéquie", es: "Chequia", it: "Cechia", de: "Tschechien", pl: "Czechy", ru: "Чехия", zh: "捷克", ja: "チェコ", pt: "Tchéquia", nl: "Tsjechië", tr: "Çekya", el: "Τσεχία", uk: "Чехія", ko: "체코" },
  DE: { en: "Germany", ro: "Germania", fr: "Allemagne", es: "Alemania", it: "Germania", de: "Deutschland", pl: "Niemcy", ru: "Германия", zh: "德国", ja: "ドイツ", pt: "Alemanha", nl: "Duitsland", tr: "Almanya", el: "Γερμανία", uk: "Німеччина", ko: "독일" },
  DK: { en: "Denmark", ro: "Danemarca", fr: "Danemark", es: "Dinamarca", it: "Danimarca", de: "Dänemark", pl: "Dania", ru: "Дания", zh: "丹麦", ja: "デンマーク", pt: "Dinamarca", nl: "Denemarken", tr: "Danimarka", el: "Δανία", uk: "Данія", ko: "덴마크" },
  EG: { en: "Egypt", ro: "Egipt", fr: "Égypte", es: "Egipto", it: "Egitto", de: "Ägypten", pl: "Egipt", ru: "Египет", zh: "埃及", ja: "エジプト", pt: "Egito", nl: "Egypte", tr: "Mısır", el: "Αίγυπτος", uk: "Єгипет", ko: "이집트" },
  ES: { en: "Spain", ro: "Spania", fr: "Espagne", es: "España", it: "Spagna", de: "Spanien", pl: "Hiszpania", ru: "Испания", zh: "西班牙", ja: "スペイン", pt: "Espanha", nl: "Spanje", tr: "İspanya", el: "Ισπανία", uk: "Іспанія", ko: "스페인" },
  ET: { en: "Ethiopia", ro: "Etiopia", fr: "Éthiopie", es: "Etiopía", it: "Etiopia", de: "Äthiopien", pl: "Etiopia", ru: "Эфиопия", zh: "埃塞俄比亚", ja: "エチオピア", pt: "Etiópia", nl: "Ethiopië", tr: "Etiyopya", el: "Αιθιοπία", uk: "Ефіопія", ko: "에티오피아" },
  FI: { en: "Finland", ro: "Finlanda", fr: "Finlande", es: "Finlandia", it: "Finlandia", de: "Finnland", pl: "Finlandia", ru: "Финляндия", zh: "芬兰", ja: "フィンランド", pt: "Finlândia", nl: "Finland", tr: "Finlandiya", el: "Φινλανδία", uk: "Фінляндія", ko: "핀란드" },
  FR: { en: "France", ro: "Franța", fr: "France", es: "Francia", it: "Francia", de: "Frankreich", pl: "Francja", ru: "Франция", zh: "法国", ja: "フランス", pt: "França", nl: "Frankrijk", tr: "Fransa", el: "Γαλλία", uk: "Франція", ko: "프랑스" },
  GB: { en: "United Kingdom", ro: "Regatul Unit", fr: "Royaume-Uni", es: "Reino Unido", it: "Regno Unito", de: "Vereinigtes Königreich", pl: "Wielka Brytania", ru: "Великобритания", zh: "英国", ja: "イギリス", pt: "Reino Unido", nl: "Verenigd Koninkrijk", tr: "Birleşik Krallık", el: "Ηνωμένο Βασίλειο", uk: "Велика Британія", ko: "영국" },
  GR: { en: "Greece", ro: "Grecia", fr: "Grèce", es: "Grecia", it: "Grecia", de: "Griechenland", pl: "Grecja", ru: "Греция", zh: "希腊", ja: "ギリシャ", pt: "Grécia", nl: "Griekenland", tr: "Yunanistan", el: "Ελλάδα", uk: "Греція", ko: "그리스" },
  HK: { en: "Hong Kong SAR China", ro: "R.A.S. Hong Kong, China", fr: "R.A.S. chinoise de Hong Kong", es: "RAE de Hong Kong (China)", it: "RAS di Hong Kong", de: "Sonderverwaltungsregion Hongkong", pl: "SRA Hongkong (Chiny)", ru: "Гонконг (САР)", zh: "中国香港特别行政区", ja: "中華人民共和国香港特別行政区", pt: "Hong Kong, RAE da China", nl: "Hongkong SAR van China", tr: "Çin Hong Kong ÖİB", el: "Χονγκ Κονγκ ΕΔΠ Κίνας", uk: "Гонконг, ОАР Китаю", ko: "홍콩(중국 특별행정구)" },
  HR: { en: "Croatia", ro: "Croația", fr: "Croatie", es: "Croacia", it: "Croazia", de: "Kroatien", pl: "Chorwacja", ru: "Хорватия", zh: "克罗地亚", ja: "クロアチア", pt: "Croácia", nl: "Kroatië", tr: "Hırvatistan", el: "Κροατία", uk: "Хорватія", ko: "크로아티아" },
  HU: { en: "Hungary", ro: "Ungaria", fr: "Hongrie", es: "Hungría", it: "Ungheria", de: "Ungarn", pl: "Węgry", ru: "Венгрия", zh: "匈牙利", ja: "ハンガリー", pt: "Hungria", nl: "Hongarije", tr: "Macaristan", el: "Ουγγαρία", uk: "Угорщина", ko: "헝가리" },
  ID: { en: "Indonesia", ro: "Indonezia", fr: "Indonésie", es: "Indonesia", it: "Indonesia", de: "Indonesien", pl: "Indonezja", ru: "Индонезия", zh: "印度尼西亚", ja: "インドネシア", pt: "Indonésia", nl: "Indonesië", tr: "Endonezya", el: "Ινδονησία", uk: "Індонезія", ko: "인도네시아" },
  IE: { en: "Ireland", ro: "Irlanda", fr: "Irlande", es: "Irlanda", it: "Irlanda", de: "Irland", pl: "Irlandia", ru: "Ирландия", zh: "爱尔兰", ja: "アイルランド", pt: "Irlanda", nl: "Ierland", tr: "İrlanda", el: "Ιρλανδία", uk: "Ірландія", ko: "아일랜드" },
  IL: { en: "Israel", ro: "Israel", fr: "Israël", es: "Israel", it: "Israele", de: "Israel", pl: "Izrael", ru: "Израиль", zh: "以色列", ja: "イスラエル", pt: "Israel", nl: "Israël", tr: "İsrail", el: "Ισραήλ", uk: "Ізраїль", ko: "이스라엘" },
  IN: { en: "India", ro: "India", fr: "Inde", es: "India", it: "India", de: "Indien", pl: "Indie", ru: "Индия", zh: "印度", ja: "インド", pt: "Índia", nl: "India", tr: "Hindistan", el: "Ινδία", uk: "Індія", ko: "인도" },
  IS: { en: "Iceland", ro: "Islanda", fr: "Islande", es: "Islandia", it: "Islanda", de: "Island", pl: "Islandia", ru: "Исландия", zh: "冰岛", ja: "アイスランド", pt: "Islândia", nl: "IJsland", tr: "İzlanda", el: "Ισλανδία", uk: "Ісландія", ko: "아이슬란드" },
  IT: { en: "Italy", ro: "Italia", fr: "Italie", es: "Italia", it: "Italia", de: "Italien", pl: "Włochy", ru: "Италия", zh: "意大利", ja: "イタリア", pt: "Itália", nl: "Italië", tr: "İtalya", el: "Ιταλία", uk: "Італія", ko: "이탈리아" },
  JO: { en: "Jordan", ro: "Iordania", fr: "Jordanie", es: "Jordania", it: "Giordania", de: "Jordanien", pl: "Jordania", ru: "Иордания", zh: "约旦", ja: "ヨルダン", pt: "Jordânia", nl: "Jordanië", tr: "Ürdün", el: "Ιορδανία", uk: "Йорданія", ko: "요르단" },
  JP: { en: "Japan", ro: "Japonia", fr: "Japon", es: "Japón", it: "Giappone", de: "Japan", pl: "Japonia", ru: "Япония", zh: "日本", ja: "日本", pt: "Japão", nl: "Japan", tr: "Japonya", el: "Ιαπωνία", uk: "Японія", ko: "일본" },
  KE: { en: "Kenya", ro: "Kenya", fr: "Kenya", es: "Kenia", it: "Kenya", de: "Kenia", pl: "Kenia", ru: "Кения", zh: "肯尼亚", ja: "ケニア", pt: "Quênia", nl: "Kenia", tr: "Kenya", el: "Κένυα", uk: "Кенія", ko: "케냐" },
  KR: { en: "South Korea", ro: "Coreea de Sud", fr: "Corée du Sud", es: "Corea del Sur", it: "Corea del Sud", de: "Südkorea", pl: "Korea Południowa", ru: "Республика Корея", zh: "韩国", ja: "韓国", pt: "Coreia do Sul", nl: "Zuid-Korea", tr: "Güney Kore", el: "Νότια Κορέα", uk: "Південна Корея", ko: "대한민국" },
  LK: { en: "Sri Lanka", ro: "Sri Lanka", fr: "Sri Lanka", es: "Sri Lanka", it: "Sri Lanka", de: "Sri Lanka", pl: "Sri Lanka", ru: "Шри-Ланка", zh: "斯里兰卡", ja: "スリランカ", pt: "Sri Lanka", nl: "Sri Lanka", tr: "Sri Lanka", el: "Σρι Λάνκα", uk: "Шрі-Ланка", ko: "스리랑카" },
  MA: { en: "Morocco", ro: "Maroc", fr: "Maroc", es: "Marruecos", it: "Marocco", de: "Marokko", pl: "Maroko", ru: "Марокко", zh: "摩洛哥", ja: "モロッコ", pt: "Marrocos", nl: "Marokko", tr: "Fas", el: "Μαρόκο", uk: "Марокко", ko: "모로코" },
  MV: { en: "Maldives", ro: "Maldive", fr: "Maldives", es: "Maldivas", it: "Maldive", de: "Malediven", pl: "Malediwy", ru: "Мальдивы", zh: "马尔代夫", ja: "モルディブ", pt: "Maldivas", nl: "Maldiven", tr: "Maldivler", el: "Μαλδίβες", uk: "Мальдіви", ko: "몰디브" },
  MX: { en: "Mexico", ro: "Mexic", fr: "Mexique", es: "México", it: "Messico", de: "Mexiko", pl: "Meksyk", ru: "Мексика", zh: "墨西哥", ja: "メキシコ", pt: "México", nl: "Mexico", tr: "Meksika", el: "Μεξικό", uk: "Мексика", ko: "멕시코" },
  MY: { en: "Malaysia", ro: "Malaysia", fr: "Malaisie", es: "Malasia", it: "Malaysia", de: "Malaysia", pl: "Malezja", ru: "Малайзия", zh: "马来西亚", ja: "マレーシア", pt: "Malásia", nl: "Maleisië", tr: "Malezya", el: "Μαλαισία", uk: "Малайзія", ko: "말레이시아" },
  NL: { en: "Netherlands", ro: "Țările de Jos", fr: "Pays-Bas", es: "Países Bajos", it: "Paesi Bassi", de: "Niederlande", pl: "Holandia", ru: "Нидерланды", zh: "荷兰", ja: "オランダ", pt: "Países Baixos", nl: "Nederland", tr: "Hollanda", el: "Κάτω Χώρες", uk: "Нідерланди", ko: "네덜란드" },
  NO: { en: "Norway", ro: "Norvegia", fr: "Norvège", es: "Noruega", it: "Norvegia", de: "Norwegen", pl: "Norwegia", ru: "Норвегия", zh: "挪威", ja: "ノルウェー", pt: "Noruega", nl: "Noorwegen", tr: "Norveç", el: "Νορβηγία", uk: "Норвегія", ko: "노르웨이" },
  NZ: { en: "New Zealand", ro: "Noua Zeelandă", fr: "Nouvelle-Zélande", es: "Nueva Zelanda", it: "Nuova Zelanda", de: "Neuseeland", pl: "Nowa Zelandia", ru: "Новая Зеландия", zh: "新西兰", ja: "ニュージーランド", pt: "Nova Zelândia", nl: "Nieuw-Zeeland", tr: "Yeni Zelanda", el: "Νέα Ζηλανδία", uk: "Нова Зеландія", ko: "뉴질랜드" },
  OM: { en: "Oman", ro: "Oman", fr: "Oman", es: "Omán", it: "Oman", de: "Oman", pl: "Oman", ru: "Оман", zh: "阿曼", ja: "オマーン", pt: "Omã", nl: "Oman", tr: "Umman", el: "Ομάν", uk: "Оман", ko: "오만" },
  PE: { en: "Peru", ro: "Peru", fr: "Pérou", es: "Perú", it: "Perù", de: "Peru", pl: "Peru", ru: "Перу", zh: "秘鲁", ja: "ペルー", pt: "Peru", nl: "Peru", tr: "Peru", el: "Περού", uk: "Перу", ko: "페루" },
  PH: { en: "Philippines", ro: "Filipine", fr: "Philippines", es: "Filipinas", it: "Filippine", de: "Philippinen", pl: "Filipiny", ru: "Филиппины", zh: "菲律宾", ja: "フィリピン", pt: "Filipinas", nl: "Filipijnen", tr: "Filipinler", el: "Φιλιππίνες", uk: "Філіппіни", ko: "필리핀" },
  PL: { en: "Poland", ro: "Polonia", fr: "Pologne", es: "Polonia", it: "Polonia", de: "Polen", pl: "Polska", ru: "Польша", zh: "波兰", ja: "ポーランド", pt: "Polônia", nl: "Polen", tr: "Polonya", el: "Πολωνία", uk: "Польща", ko: "폴란드" },
  PT: { en: "Portugal", ro: "Portugalia", fr: "Portugal", es: "Portugal", it: "Portogallo", de: "Portugal", pl: "Portugalia", ru: "Португалия", zh: "葡萄牙", ja: "ポルトガル", pt: "Portugal", nl: "Portugal", tr: "Portekiz", el: "Πορτογαλία", uk: "Португалія", ko: "포르투갈" },
  QA: { en: "Qatar", ro: "Qatar", fr: "Qatar", es: "Catar", it: "Qatar", de: "Katar", pl: "Katar", ru: "Катар", zh: "卡塔尔", ja: "カタール", pt: "Catar", nl: "Qatar", tr: "Katar", el: "Κατάρ", uk: "Катар", ko: "카타르" },
  RO: { en: "Romania", ro: "România", fr: "Roumanie", es: "Rumanía", it: "Romania", de: "Rumänien", pl: "Rumunia", ru: "Румыния", zh: "罗马尼亚", ja: "ルーマニア", pt: "Romênia", nl: "Roemenië", tr: "Romanya", el: "Ρουμανία", uk: "Румунія", ko: "루마니아" },
  RU: { en: "Russia", ro: "Rusia", fr: "Russie", es: "Rusia", it: "Russia", de: "Russland", pl: "Rosja", ru: "Россия", zh: "俄罗斯", ja: "ロシア", pt: "Rússia", nl: "Rusland", tr: "Rusya", el: "Ρωσία", uk: "Росія", ko: "러시아" },
  SE: { en: "Sweden", ro: "Suedia", fr: "Suède", es: "Suecia", it: "Svezia", de: "Schweden", pl: "Szwecja", ru: "Швеция", zh: "瑞典", ja: "スウェーデン", pt: "Suécia", nl: "Zweden", tr: "İsveç", el: "Σουηδία", uk: "Швеція", ko: "스웨덴" },
  SG: { en: "Singapore", ro: "Singapore", fr: "Singapour", es: "Singapur", it: "Singapore", de: "Singapur", pl: "Singapur", ru: "Сингапур", zh: "新加坡", ja: "シンガポール", pt: "Singapura", nl: "Singapore", tr: "Singapur", el: "Σιγκαπούρη", uk: "Сінгапур", ko: "싱가포르" },
  TH: { en: "Thailand", ro: "Thailanda", fr: "Thaïlande", es: "Tailandia", it: "Thailandia", de: "Thailand", pl: "Tajlandia", ru: "Таиланд", zh: "泰国", ja: "タイ", pt: "Tailândia", nl: "Thailand", tr: "Tayland", el: "Ταϊλάνδη", uk: "Таїланд", ko: "태국" },
  TN: { en: "Tunisia", ro: "Tunisia", fr: "Tunisie", es: "Túnez", it: "Tunisia", de: "Tunesien", pl: "Tunezja", ru: "Тунис", zh: "突尼斯", ja: "チュニジア", pt: "Tunísia", nl: "Tunesië", tr: "Tunus", el: "Τυνησία", uk: "Туніс", ko: "튀니지" },
  TR: { en: "Türkiye", ro: "Turcia", fr: "Turquie", es: "Turquía", it: "Turchia", de: "Türkei", pl: "Turcja", ru: "Турция", zh: "土耳其", ja: "トルコ", pt: "Turquia", nl: "Turkije", tr: "Türkiye", el: "Τουρκία", uk: "Туреччина", ko: "튀르키예" },
  TW: { en: "Taiwan", ro: "Taiwan", fr: "Taïwan", es: "Taiwán", it: "Taiwan", de: "Taiwan", pl: "Tajwan", ru: "Тайвань", zh: "台湾", ja: "台湾", pt: "Taiwan", nl: "Taiwan", tr: "Tayvan", el: "Ταϊβάν", uk: "Тайвань", ko: "대만" },
  TZ: { en: "Tanzania", ro: "Tanzania", fr: "Tanzanie", es: "Tanzania", it: "Tanzania", de: "Tansania", pl: "Tanzania", ru: "Танзания", zh: "坦桑尼亚", ja: "タンザニア", pt: "Tanzânia", nl: "Tanzania", tr: "Tanzanya", el: "Τανζανία", uk: "Танзанія", ko: "탄자니아" },
  US: { en: "United States", ro: "Statele Unite ale Americii", fr: "États-Unis", es: "Estados Unidos", it: "Stati Uniti", de: "Vereinigte Staaten", pl: "Stany Zjednoczone", ru: "Соединенные Штаты", zh: "美国", ja: "アメリカ合衆国", pt: "Estados Unidos", nl: "Verenigde Staten", tr: "Amerika Birleşik Devletleri", el: "Ηνωμένες Πολιτείες", uk: "Сполучені Штати", ko: "미국" },
  VN: { en: "Vietnam", ro: "Vietnam", fr: "Viêt Nam", es: "Vietnam", it: "Vietnam", de: "Vietnam", pl: "Wietnam", ru: "Вьетнам", zh: "越南", ja: "ベトナム", pt: "Vietnã", nl: "Vietnam", tr: "Vietnam", el: "Βιετνάμ", uk: "Вʼєтнам", ko: "베트남" },
  ZA: { en: "South Africa", ro: "Africa de Sud", fr: "Afrique du Sud", es: "Sudáfrica", it: "Sudafrica", de: "Südafrika", pl: "Republika Południowej Afryki", ru: "Южно-Африканская Республика", zh: "南非", ja: "南アフリカ", pt: "África do Sul", nl: "Zuid-Afrika", tr: "Güney Afrika", el: "Νότια Αφρική", uk: "Південно-Африканська Республіка", ko: "남아프리카" },
};

// The curated destination data stores Romanian country names, and COUNTRY_INFO
// in locale.js is keyed by them. This bridges those keys to ISO codes so both
// the Home tiles (which carry ISO) and routes/trips (which carry names) can use
// one lookup. Resolved against CLDR's Romanian names, not by hand.
const RO_TO_ISO = {
  "Argentina": "AR",
  "Australia": "AU",
  "Austria": "AT",
  "Brazilia": "BR",
  "China": "CN",
  "Egipt": "EG",
  "Elveția": "CH",
  "Emiratele Arabe": "AE",
  "Emiratele Arabe Unite": "AE",
  "Franța": "FR",
  "Germania": "DE",
  "Grecia": "GR",
  "India": "IN",
  "Indonezia": "ID",
  "Israel": "IL",
  "Italia": "IT",
  "Japonia": "JP",
  "Marea Britanie": "GB",
  "Maroc": "MA",
  "Olanda": "NL",
  "Polonia": "PL",
  "Portugalia": "PT",
  "România": "RO",
  "Rusia": "RU",
  "Singapore": "SG",
  "Spania": "ES",
  "SUA": "US",
  "Thailanda": "TH",
  "Turcia": "TR",
};

// ISO 3166-1 alpha-2 → flag, by mapping each letter to its regional indicator.
export const flagOf = (cc) =>
  (cc || "").toUpperCase().replace(/[A-Z]/g, (ch) =>
    String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65));

// Accepts either an ISO code ("FR") or the Romanian name the trip data stores
// ("Franța"), and returns the name in `lang`. Falls back to English, then to
// whatever was passed in — an unknown country should still print something.
export function countryName(country, lang = "en") {
  if (!country) return "";
  const cc = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : RO_TO_ISO[country];
  const row = NAMES[cc];
  if (!row) return country;
  return row[lang] || row.en || country;
}

// The flag for either key shape, for callers that render both together.
export function countryFlagOf(country) {
  if (!country) return "";
  const cc = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : RO_TO_ISO[country];
  return cc ? flagOf(cc) : "";
}
