export const GHANA_REGIONS = [
  "Ahafo Region",
  "Ashanti Region",
  "Bono Region",
  "Bono East Region",
  "Central Region",
  "Eastern Region",
  "Greater Accra Region",
  "North East Region",
  "Northern Region",
  "Oti Region",
  "Savannah Region",
  "Upper East Region",
  "Upper West Region",
  "Volta Region",
  "Western Region",
  "Western North Region",
] as const;

export type GhanaRegion = (typeof GHANA_REGIONS)[number];

export const GHANA_CITIES: Record<string, string[]> = {
  "Ahafo Region": ["Goaso", "Bechem", "Duayaw Nkwanta", "Kenyasi", "Mim"],
  "Ashanti Region": ["Kumasi", "Obuasi", "Ejisu", "Mampong", "Bekwai", "Konongo", "Agogo", "Offinso"],
  "Bono Region": ["Sunyani", "Berekum", "Dormaa Ahenkro", "Wenchi", "Odumase"],
  "Bono East Region": ["Techiman", "Kintampo", "Nkoranza", "Atebubu", "Yeji"],
  "Central Region": ["Cape Coast", "Elmina", "Winneba", "Kasoa", "Swedru", "Mankessim", "Dunkwa"],
  "Eastern Region": ["Koforidua", "Akosombo", "Akim Oda", "Begoro", "Nkawkaw", "Nsawam", "Suhum"],
  "Greater Accra Region": ["Accra", "Tema", "Madina", "Kasoa", "Adenta", "Dansoman", "Ashaiman", "Teshie", "Nungua", "Cantonments"],
  "North East Region": ["Nalerigu", "Gambaga", "Walewale", "Langbinsi", "Chereponi"],
  "Northern Region": ["Tamale", "Yendi", "Damongo", "Salaga", "Bimbilla", "Savelugu"],
  "Oti Region": ["Dambai", "Jasikan", "Nkwanta", "Kadjebi", "Kpassa"],
  "Savannah Region": ["Damongo", "Bole", "Salaga", "Buipe", "Sawla"],
  "Upper East Region": ["Bolgatanga", "Navrongo", "Bawku", "Zebilla", "Paga", "Binduri"],
  "Upper West Region": ["Wa", "Lawra", "Jirapa", "Tumu", "Nandom", "Nadowli"],
  "Volta Region": ["Ho", "Keta", "Hohoe", "Aflao", "Kpando", "Sogakope", "Akatsi"],
  "Western Region": ["Takoradi", "Sekondi", "Tarkwa", "Axim", "Half Assini", "Prestea", "Bogoso"],
  "Western North Region": ["Sefwi Wiawso", "Bibiani", "Enchi", "Juaboso", "Akontombra"],
};
