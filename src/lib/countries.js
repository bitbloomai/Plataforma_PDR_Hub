/**
 * Países atendidos pela operação (principais mercados de granizo / PDR).
 *
 * `name` é o valor gravado em `contas.pais` (sem acento, compatível com os
 * registros existentes como "Italia"). Os padrões usam `#` para dígito e `*`
 * para letra ou dígito.
 */

const option = (value, label = value) => ({ value, label });
const coded = (code, name) => ({ value: code, label: `${code} - ${name}` });

const BRAZIL_STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"],
  ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
  ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
  ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"], ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
  ["SE", "Sergipe"], ["TO", "Tocantins"],
].map(([code, name]) => coded(code, name));

const ITALY_REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia",
  "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna",
  "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
].map((name) => option(name));

const ARGENTINA_PROVINCES = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones",
  "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
].map((name) => option(name));

const PARAGUAY_DEPARTMENTS = [
  "Asunción (Distrito Capital)", "Alto Paraguay", "Alto Paraná", "Amambay", "Boquerón",
  "Caaguazú", "Caazapá", "Canindeyú", "Central", "Concepción", "Cordillera", "Guairá", "Itapúa",
  "Misiones", "Ñeembucú", "Paraguarí", "Presidente Hayes", "San Pedro",
].map((name) => option(name));

const SPAIN_COMMUNITIES = [
  "Andalucía", "Aragón", "Asturias", "Islas Baleares", "Canarias", "Cantabria",
  "Castilla-La Mancha", "Castilla y León", "Cataluña", "Comunidad Valenciana", "Extremadura",
  "Galicia", "La Rioja", "Comunidad de Madrid", "Región de Murcia", "Navarra", "País Vasco",
  "Ceuta", "Melilla",
].map((name) => option(name));

const GERMANY_STATES = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen",
  "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz",
  "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
].map((name) => option(name));

const SWITZERLAND_CANTONS = [
  ["AG", "Aargau"], ["AI", "Appenzell Innerrhoden"], ["AR", "Appenzell Ausserrhoden"],
  ["BE", "Bern"], ["BL", "Basel-Landschaft"], ["BS", "Basel-Stadt"], ["FR", "Fribourg"],
  ["GE", "Genève"], ["GL", "Glarus"], ["GR", "Graubünden"], ["JU", "Jura"], ["LU", "Luzern"],
  ["NE", "Neuchâtel"], ["NW", "Nidwalden"], ["OW", "Obwalden"], ["SG", "St. Gallen"],
  ["SH", "Schaffhausen"], ["SO", "Solothurn"], ["SZ", "Schwyz"], ["TG", "Thurgau"],
  ["TI", "Ticino"], ["UR", "Uri"], ["VD", "Vaud"], ["VS", "Valais"], ["ZG", "Zug"], ["ZH", "Zürich"],
].map(([code, name]) => coded(code, name));

const FRANCE_REGIONS = [
  "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire", "Corse",
  "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie",
  "Pays de la Loire", "Provence-Alpes-Côte d'Azur", "Guadeloupe", "Guyane", "La Réunion",
  "Martinique", "Mayotte",
].map((name) => option(name));

const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"],
  ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"],
  ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => coded(code, name));

const MEXICO_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato",
  "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
  "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
  "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
].map((name) => option(name));

const TURKEY_PROVINCES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl",
  "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır",
  "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun",
  "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş",
  "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
  "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla",
  "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa",
  "Siirt", "Sinop", "Şırnak", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van",
  "Yalova", "Yozgat", "Zonguldak",
].map((name) => option(name));

export const COUNTRIES = [
  {
    code: "BR", name: "Brasil", label: "Brasil", flag: "🇧🇷", dialCode: "55",
    phonePattern: "(##) #####-####",
    documentLabel: "CNPJ", documentPattern: "##.###.###/####-##",
    postalLabel: "CEP", postalPattern: "#####-###",
    regionLabel: "Estado", regions: BRAZIL_STATES,
    defaults: { locale: "pt-BR", moeda: "BRL", timezone: "America/Sao_Paulo" },
  },
  {
    code: "AR", name: "Argentina", label: "Argentina", flag: "🇦🇷", dialCode: "54",
    phonePattern: "## ####-####",
    documentLabel: "CUIT", documentPattern: "##-########-#",
    postalLabel: "Código postal (CPA)", postalPattern: "********", postalPlaceholder: "C1425ABC",
    regionLabel: "Província", regions: ARGENTINA_PROVINCES,
    defaults: { locale: "es-AR", moeda: "ARS", timezone: "America/Argentina/Buenos_Aires" },
  },
  {
    code: "PY", name: "Paraguai", label: "Paraguai", flag: "🇵🇾", dialCode: "595",
    phonePattern: "### ### ###",
    documentLabel: "RUC", documentPattern: "########-#", documentPlaceholder: "80012345-6",
    postalLabel: "Código postal", postalPattern: "######",
    regionLabel: "Departamento", regions: PARAGUAY_DEPARTMENTS,
    defaults: { timezone: "America/Asuncion" },
  },
  {
    code: "IT", name: "Italia", label: "Itália", flag: "🇮🇹", dialCode: "39",
    phonePattern: "### ### ####",
    documentLabel: "Partita IVA", documentPattern: "###########",
    postalLabel: "CAP", postalPattern: "#####",
    regionLabel: "Região", regions: ITALY_REGIONS,
    defaults: { locale: "it-IT", moeda: "EUR", timezone: "Europe/Rome" },
  },
  {
    code: "ES", name: "Espanha", label: "Espanha", flag: "🇪🇸", dialCode: "34",
    phonePattern: "### ### ###",
    documentLabel: "NIF / CIF", documentPattern: "*********", documentPlaceholder: "B12345678",
    postalLabel: "Código postal", postalPattern: "#####",
    regionLabel: "Comunidade autônoma", regions: SPAIN_COMMUNITIES,
    defaults: { locale: "es-ES", moeda: "EUR", timezone: "Europe/Madrid" },
  },
  {
    code: "DE", name: "Alemanha", label: "Alemanha", flag: "🇩🇪", dialCode: "49",
    phonePattern: "#### #######",
    documentLabel: "USt-IdNr.", documentPattern: "DE#########",
    postalLabel: "PLZ", postalPattern: "#####",
    regionLabel: "Estado (Bundesland)", regions: GERMANY_STATES,
    defaults: { locale: "de-DE", moeda: "EUR", timezone: "Europe/Berlin" },
  },
  {
    code: "CH", name: "Suica", label: "Suíça", flag: "🇨🇭", dialCode: "41",
    phonePattern: "## ### ## ##",
    documentLabel: "UID", documentPattern: "CHE-###.###.###",
    postalLabel: "NPA / PLZ", postalPattern: "####",
    regionLabel: "Cantão", regions: SWITZERLAND_CANTONS,
    defaults: { locale: "de-CH", moeda: "CHF", timezone: "Europe/Zurich" },
  },
  {
    code: "FR", name: "Franca", label: "França", flag: "🇫🇷", dialCode: "33",
    phonePattern: "# ## ## ## ##",
    documentLabel: "SIRET", documentPattern: "### ### ### #####",
    postalLabel: "Code postal", postalPattern: "#####",
    regionLabel: "Região", regions: FRANCE_REGIONS,
    defaults: { locale: "fr-FR", moeda: "EUR", timezone: "Europe/Paris" },
  },
  {
    code: "US", name: "Estados Unidos", label: "Estados Unidos", flag: "🇺🇸", dialCode: "1",
    phonePattern: "(###) ###-####",
    documentLabel: "EIN", documentPattern: "##-#######",
    postalLabel: "ZIP Code", postalPattern: "#####-####", postalPlaceholder: "10001",
    regionLabel: "Estado", regions: US_STATES,
    defaults: { locale: "en-US", moeda: "USD", timezone: "America/Chicago" },
  },
  {
    code: "MX", name: "Mexico", label: "México", flag: "🇲🇽", dialCode: "52",
    phonePattern: "## #### ####",
    documentLabel: "RFC", documentPattern: "*************", documentPlaceholder: "ABC010203XY1",
    postalLabel: "Código postal", postalPattern: "#####",
    regionLabel: "Estado", regions: MEXICO_STATES,
    defaults: { locale: "es-MX", moeda: "MXN", timezone: "America/Mexico_City" },
  },
  {
    code: "TR", name: "Turquia", label: "Turquia", flag: "🇹🇷", dialCode: "90",
    phonePattern: "### ### ## ##",
    documentLabel: "Vergi No (VKN)", documentPattern: "##########",
    postalLabel: "Posta kodu", postalPattern: "#####",
    regionLabel: "Província (İl)", regions: TURKEY_PROVINCES,
    defaults: { timezone: "Europe/Istanbul" },
  },
];

const ALIASES = {
  BR: ["brasil", "brazil", "br"],
  AR: ["argentina", "ar"],
  PY: ["paraguai", "paraguay", "py"],
  IT: ["italia", "italy", "it"],
  ES: ["espanha", "espana", "spain", "es"],
  DE: ["alemanha", "germany", "deutschland", "de"],
  CH: ["suica", "switzerland", "schweiz", "suisse", "svizzera", "ch"],
  FR: ["franca", "france", "fr"],
  US: ["estados unidos", "eua", "usa", "united states", "us"],
  MX: ["mexico", "mx"],
  TR: ["turquia", "turkey", "turkiye", "tr"],
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Encontra o país pelo valor gravado (nome, código ou alias). */
export function findCountry(value) {
  const normalized = normalize(value);
  if (!normalized) return null;
  const code = Object.keys(ALIASES).find((key) => ALIASES[key].includes(normalized));
  return COUNTRIES.find((country) => country.code === code) || null;
}

export function countryOptions() {
  return COUNTRIES.map((country) => ({
    value: country.name,
    label: `${country.flag} ${country.label}`,
  }));
}

/** Aplica um padrão (# dígito, * letra/dígito, demais caracteres literais). */
export function applyPattern(value, pattern) {
  if (!pattern) return String(value ?? "");

  // Prefixos fixos do padrão (ex.: "DE", "CHE-") não precisam ser digitados.
  const prefix = (pattern.match(/^[^#*]*/)?.[0] || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  let source = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (prefix && source.startsWith(prefix)) source = source.slice(prefix.length);
  if (!source) return "";

  let output = "";
  let index = 0;
  for (const token of pattern) {
    if (token === "#" || token === "*") {
      while (token === "#" && index < source.length && !/\d/.test(source[index])) index += 1;
      if (index >= source.length) break;
      output += source[index];
      index += 1;
    } else {
      if (index >= source.length) break;
      output += token;
    }
  }
  return output;
}

/** Separa o telefone gravado ("+39 352 209 5200") no número local formatado. */
export function localPhone(value, country) {
  const meta = findCountry(country);
  const raw = String(value ?? "").trim();
  if (!meta) return raw;
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.startsWith(meta.dialCode)) digits = digits.slice(meta.dialCode.length);
  return applyPattern(digits, meta.phonePattern);
}

/** Monta o telefone para gravar, sempre com o DDI do país. */
export function phoneWithDialCode(local, country) {
  const meta = findCountry(country);
  const formatted = meta ? applyPattern(local, meta.phonePattern) : String(local ?? "").trim();
  if (!formatted) return "";
  return meta ? `+${meta.dialCode} ${formatted}` : formatted;
}
