const groups = [
  ["India", "Chennai|Semmozhi Poonga;Coimbatore|VOC Park;Madurai|Rajaji Park;Trichy|Kallanai Green Corridor;Salem|Mookaneri Lake Park;Bengaluru|Cubbon Park;Mumbai|Sanjay Gandhi National Park;Delhi|Lodhi Garden;Hyderabad|KBR National Park;Kolkata|Maidan;Pune|Empress Botanical Garden;Ahmedabad|Riverfront Garden"],
  ["USA", "New York|Central Park;Los Angeles|Griffith Park;Chicago|Lincoln Park;Houston|Hermann Park;Phoenix|Encanto Park;Philadelphia|Fairmount Park;San Diego|Balboa Park;Dallas|White Rock Lake Park;San Jose|Alum Rock Park;Austin|Zilker Park;Seattle|Discovery Park;Miami|Bayfront Park"],
  ["UK", "London|Hyde Park;Birmingham|Cannon Hill Park;Manchester|Heaton Park;Glasgow|Kelvingrove Park;Liverpool|Sefton Park;Leeds|Roundhay Park;Edinburgh|The Meadows;Bristol|Ashton Court Estate;Sheffield|Endcliffe Park;Cardiff|Bute Park;Belfast|Botanic Gardens;Newcastle|Jesmond Dene"],
  ["Canada", "Toronto|High Park;Montreal|Mount Royal Park;Vancouver|Stanley Park;Calgary|Prince's Island Park;Edmonton|Hawrelak Park;Ottawa|Major's Hill Park;Winnipeg|Assiniboine Park;Quebec City|Plains of Abraham;Hamilton|Gage Park;Kitchener|Victoria Park;Halifax|Point Pleasant Park;Victoria|Beacon Hill Park"],
  ["Australia", "Sydney|Royal Botanic Garden;Melbourne|Royal Park;Brisbane|South Bank Parklands;Perth|Kings Park;Adelaide|Botanic Park;Canberra|Commonwealth Park;Gold Coast|Broadwater Parklands;Newcastle|King Edward Park;Wollongong|Stuart Park;Geelong|Eastern Park;Hobart|Royal Tasmanian Botanical Gardens;Darwin|Bicentennial Park"],
  ["Japan", "Tokyo|Yoyogi Park;Osaka|Osaka Castle Park;Kyoto|Maruyama Park;Yokohama|Yamashita Park;Nagoya|Hisaya Odori Park;Sapporo|Odori Park;Fukuoka|Ohori Park;Kobe|Meriken Park;Kawasaki|Ikuta Ryokuchi;Hiroshima|Peace Memorial Park;Sendai|Nishi Park;Nara|Nara Park"],
  ["China", "Beijing|Olympic Forest Park;Shanghai|Century Park;Guangzhou|Yuexiu Park;Shenzhen|Lianhuashan Park;Chengdu|People's Park;Wuhan|East Lake Greenway;Hangzhou|West Lake Park;Nanjing|Xuanwu Lake Park;Tianjin|Water Park;Chongqing|Elong Park;Xi'an|Xingqing Palace Park;Suzhou|Jinji Lake Park"],
  ["Germany", "Berlin|Tiergarten;Hamburg|Planten un Blomen;Munich|Englischer Garten;Cologne|Rheinpark;Frankfurt|Palmengarten;Stuttgart|Schlossgarten;Dusseldorf|Hofgarten;Leipzig|Clara Zetkin Park;Dortmund|Westfalenpark;Essen|Grugapark;Bremen|Buergerpark;Dresden|Grosser Garten"],
  ["France", "Paris|Luxembourg Garden;Marseille|Parc Borely;Lyon|Parc de la Tete d'Or;Toulouse|Jardin des Plantes;Nice|Promenade du Paillon;Nantes|Parc de la Beaujoire;Strasbourg|Parc de l'Orangerie;Montpellier|Jardin des Plantes;Bordeaux|Jardin Public;Lille|Citadelle Park;Rennes|Parc du Thabor;Grenoble|Paul Mistral Park"],
  ["Italy", "Rome|Villa Borghese;Milan|Sempione Park;Naples|Villa Comunale;Turin|Valentino Park;Palermo|Foro Italico;Genoa|Villetta Di Negro;Bologna|Giardini Margherita;Florence|Cascine Park;Bari|Parco 2 Giugno;Catania|Villa Bellini;Venice|Giardini della Biennale;Verona|Giardino Giusti"],
  ["Spain", "Madrid|Retiro Park;Barcelona|Ciutadella Park;Valencia|Turia Garden;Seville|Maria Luisa Park;Zaragoza|Jose Antonio Labordeta Park;Malaga|Parque de Malaga;Murcia|Floridablanca Garden;Palma|Parc de la Mar;Bilbao|Dona Casilda Park;Alicante|El Palmeral Park;Cordoba|Jardines de la Victoria;Valladolid|Campo Grande"],
  ["Brazil", "Sao Paulo|Ibirapuera Park;Rio de Janeiro|Flamengo Park;Brasilia|City Park;Salvador|Dique do Tororo;Fortaleza|Coco Park;Belo Horizonte|Municipal Park;Manaus|Mindú Park;Curitiba|Barigui Park;Recife|Jaqueira Park;Porto Alegre|Farroupilha Park;Goiania|Flamboyant Park;Belem|Mangal das Garcas"],
  ["Russia", "Moscow|Gorky Park;Saint Petersburg|Summer Garden;Novosibirsk|Zaeltsovsky Park;Yekaterinburg|Mayakovsky Park;Kazan|Gorky Central Park;Nizhny Novgorod|Switzerland Park;Chelyabinsk|Gagarin Park;Samara|Strukovsky Garden;Omsk|Green Island Park;Rostov-on-Don|Gorky Park;Ufa|Kashkadan Park;Krasnoyarsk|Tatyshev Island"],
  ["South Africa", "Johannesburg|Johannesburg Botanical Garden;Cape Town|Company's Garden;Durban|People's Park;Pretoria|Freedom Park;Port Elizabeth|Settlers Park;Bloemfontein|Kings Park;East London|Gonubie Park;Polokwane|Savannah Mall Greenbelt;Nelspruit|Lowveld Botanical Garden;Kimberley|William Kemp Park;Rustenburg|Kloof Park;Pietermaritzburg|Alexandra Park"],
  ["UAE", "Dubai|Safa Park;Abu Dhabi|Umm Al Emarat Park;Sharjah|Al Majaz Waterfront;Al Ain|Al Jahili Park;Ajman|Al Zorah Nature Reserve;Ras Al Khaimah|Saqr Park;Fujairah|Madhab Park;Umm Al Quwain|Falaj Al Mualla Park;Khor Fakkan|Al Rafisah Park;Jebel Ali|Dubai South Park;Dibba|Dibba Park;Madinat Zayed|Public Garden"],
  ["Singapore", "Singapore|Gardens by the Bay;Tampines|Bedok Reservoir Park;Jurong East|Jurong Lake Gardens;Woodlands|Admiralty Park;Punggol|Punggol Waterway Park;Sengkang|Sengkang Riverside Park;Toa Payoh|Toa Payoh Town Park;Ang Mo Kio|Bishan Ang Mo Kio Park;Clementi|West Coast Park;Pasir Ris|Pasir Ris Park;Yishun|Yishun Park;Bukit Batok|Bukit Batok Nature Park"],
  ["Malaysia", "Kuala Lumpur|KLCC Park;George Town|Penang Botanical Gardens;Johor Bahru|Hutan Bandar MBJB;Shah Alam|Taman Botani Negara;Ipoh|D R Seenivasagam Park;Malacca City|Taman Merdeka;Kota Kinabalu|Tanjung Aru Park;Kuching|Friendship Park;Putrajaya|Taman Botani Putrajaya;Petaling Jaya|Taman Jaya;Kuantan|Taman Gelora;Seremban|Lake Gardens"],
  ["Thailand", "Bangkok|Lumphini Park;Chiang Mai|Nong Buak Haad Park;Pattaya|Nong Nooch Garden;Phuket|Saphan Hin Park;Hat Yai|Hat Yai Municipal Park;Khon Kaen|Bueng Kaen Nakhon;Nakhon Ratchasima|Bung Ta Lua Park;Udon Thani|Nong Prajak Park;Surat Thani|Ko Lamphu Park;Ayutthaya|Bueng Phraram Park;Hua Hin|Queen Sirikit Park;Chiang Rai|Mae Fah Luang Garden"],
  ["Indonesia", "Jakarta|Suropati Park;Surabaya|Bungkul Park;Bandung|Taman Hutan Raya;Medan|Ahmad Yani Park;Semarang|Indonesia Kaya Park;Makassar|Losari Green Space;Yogyakarta|Gembira Loka Park;Denpasar|Puputan Badung Park;Palembang|Kambang Iwak Park;Bekasi|Taman Kota Bekasi;Bogor|Bogor Botanical Gardens;Malang|Taman Merdeka"],
  ["South Korea", "Seoul|Seoul Forest;Busan|Yongdusan Park;Incheon|Songdo Central Park;Daegu|Duryu Park;Daejeon|Hanbat Arboretum;Gwangju|Jungoe Park;Suwon|Gwanggyo Lake Park;Ulsan|Taehwagang Park;Seongnam|Yuldong Park;Goyang|Ilsan Lake Park;Yongin|Gyeonggi Children's Park;Jeonju|Deokjin Park"],
  ["Mexico", "Mexico City|Chapultepec Park;Guadalajara|Bosque Los Colomos;Monterrey|Fundidora Park;Puebla|Ecoparque Metropolitano;Tijuana|Morelos Park;Leon|Metropolitan Park;Juarez|Central Park;Merida|Parque de las Americas;Queretaro|Alameda Hidalgo;Cancun|Kabah Park;San Luis Potosi|Tangamanga Park;Aguascalientes|Rodolfo Landeros Park"],
  ["Turkey", "Istanbul|Yildiz Park;Ankara|Genclik Park;Izmir|Kulturpark;Bursa|Resat Oyal Park;Antalya|Ataturk Culture Park;Adana|Merkez Park;Konya|Alaeddin Hill Park;Gaziantep|Botanic Garden;Kayseri|Erciyes Park;Mersin|Kultur Park;Eskisehir|Sazova Park;Diyarbakir|Kosuyolu Park"],
  ["Saudi Arabia", "Riyadh|King Abdullah Park;Jeddah|Al Salam Park;Mecca|Al Faisaliah Park;Medina|King Fahd Central Park;Dammam|King Fahd Park;Khobar|Prince Saud Bin Naif Park;Taif|King Fahd Garden;Tabuk|Prince Fahd Bin Sultan Park;Abha|Abha Dam Lake Park;Buraydah|King Khalid Park;Jubail|Al Nakheel Park;Hail|Al Samra Park"],
  ["Argentina", "Buenos Aires|Bosques de Palermo;Cordoba|Sarmiento Park;Rosario|Independencia Park;Mendoza|General San Martin Park;La Plata|Paseo del Bosque;Tucuman|9 de Julio Park;Mar del Plata|San Martin Square;Salta|San Bernardo Park;Santa Fe|Federal Park;San Juan|May 25 Park;Neuquen|Central Park;Corrientes|Mitre Park"],
  ["Egypt", "Cairo|Al Azhar Park;Alexandria|Montaza Palace Gardens;Giza|Orman Garden;Luxor|Al Andalus Park;Aswan|Feryal Garden;Sharm El Sheikh|Peace Park;Hurghada|El Dahar Park;Mansoura|Al Gamaa Garden;Tanta|Al Andalus Garden;Ismailia|Al Mallaha Park;Suez|Al Salam Park;Port Said|Ferial Garden"],
];

const transports = ["Walk / local bus", "Metro + short walk", "Auto / taxi", "Cycle / walk"];

const coolingZones = groups.flatMap(([country, entries]) => entries.split(";").map((entry, index) => {
  const [city, coolingZone] = entry.split("|");
  return {
    city,
    country,
    coolingZone,
    distance: `${(1.2 + (index % 6) * 0.6).toFixed(1)} km`,
    travelTime: `${7 + (index % 6) * 3} min`,
    transport: transports[index % transports.length],
    coolingDifference: `${(3.5 + (index % 5) * 0.4).toFixed(1)}°C cooler`,
  };
}));

export function findCoolingZone(city) {
  const normalizedCity = String(city || "").split(",")[0].trim().toLocaleLowerCase();
  return coolingZones.find((entry) => entry.city.toLocaleLowerCase() === normalizedCity) || null;
}

export default coolingZones;
