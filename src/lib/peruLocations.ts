// Compact Peru administrative divisions: Departamento → Provincia.
// Distrito is captured as free text with optional suggestions for high-density areas.
// Source: INEI ubigeo (curated). Used only for UX capture.

export interface PeruDept {
  name: string;
  provinces: string[];
}

export const PERU_DEPARTMENTS: PeruDept[] = [
  { name: "Amazonas", provinces: ["Bagua", "Bongará", "Chachapoyas", "Condorcanqui", "Luya", "Rodríguez de Mendoza", "Utcubamba"] },
  { name: "Áncash", provinces: ["Aija", "Antonio Raymondi", "Asunción", "Bolognesi", "Carhuaz", "Carlos Fermín Fitzcarrald", "Casma", "Corongo", "Huaraz", "Huari", "Huarmey", "Huaylas", "Mariscal Luzuriaga", "Ocros", "Pallasca", "Pomabamba", "Recuay", "Santa", "Sihuas", "Yungay"] },
  { name: "Apurímac", provinces: ["Abancay", "Andahuaylas", "Antabamba", "Aymaraes", "Chincheros", "Cotabambas", "Grau"] },
  { name: "Arequipa", provinces: ["Arequipa", "Camaná", "Caravelí", "Castilla", "Caylloma", "Condesuyos", "Islay", "La Unión"] },
  { name: "Ayacucho", provinces: ["Cangallo", "Huamanga", "Huanca Sancos", "Huanta", "La Mar", "Lucanas", "Parinacochas", "Páucar del Sara Sara", "Sucre", "Víctor Fajardo", "Vilcashuamán"] },
  { name: "Cajamarca", provinces: ["Cajabamba", "Cajamarca", "Celendín", "Chota", "Contumazá", "Cutervo", "Hualgayoc", "Jaén", "San Ignacio", "San Marcos", "San Miguel", "San Pablo", "Santa Cruz"] },
  { name: "Callao", provinces: ["Callao"] },
  { name: "Cusco", provinces: ["Acomayo", "Anta", "Calca", "Canas", "Canchis", "Chumbivilcas", "Cusco", "Espinar", "La Convención", "Paruro", "Paucartambo", "Quispicanchi", "Urubamba"] },
  { name: "Huancavelica", provinces: ["Acobamba", "Angaraes", "Castrovirreyna", "Churcampa", "Huancavelica", "Huaytará", "Tayacaja"] },
  { name: "Huánuco", provinces: ["Ambo", "Dos de Mayo", "Huacaybamba", "Huamalíes", "Huánuco", "Lauricocha", "Leoncio Prado", "Marañón", "Pachitea", "Puerto Inca", "Yarowilca"] },
  { name: "Ica", provinces: ["Chincha", "Ica", "Nazca", "Palpa", "Pisco"] },
  { name: "Junín", provinces: ["Chanchamayo", "Chupaca", "Concepción", "Huancayo", "Jauja", "Junín", "Satipo", "Tarma", "Yauli"] },
  { name: "La Libertad", provinces: ["Ascope", "Bolívar", "Chepén", "Gran Chimú", "Julcán", "Otuzco", "Pacasmayo", "Pataz", "Sánchez Carrión", "Santiago de Chuco", "Trujillo", "Virú"] },
  { name: "Lambayeque", provinces: ["Chiclayo", "Ferreñafe", "Lambayeque"] },
  { name: "Lima", provinces: ["Barranca", "Cajatambo", "Canta", "Cañete", "Huaral", "Huarochirí", "Huaura", "Lima", "Oyón", "Yauyos"] },
  { name: "Loreto", provinces: ["Alto Amazonas", "Datem del Marañón", "Loreto", "Mariscal Ramón Castilla", "Maynas", "Putumayo", "Requena", "Ucayali"] },
  { name: "Madre de Dios", provinces: ["Manu", "Tahuamanu", "Tambopata"] },
  { name: "Moquegua", provinces: ["General Sánchez Cerro", "Ilo", "Mariscal Nieto"] },
  { name: "Pasco", provinces: ["Daniel Alcides Carrión", "Oxapampa", "Pasco"] },
  { name: "Piura", provinces: ["Ayabaca", "Huancabamba", "Morropón", "Paita", "Piura", "Sechura", "Sullana", "Talara"] },
  { name: "Puno", provinces: ["Azángaro", "Carabaya", "Chucuito", "El Collao", "Huancané", "Lampa", "Melgar", "Moho", "Puno", "San Antonio de Putina", "San Román", "Sandia", "Yunguyo"] },
  { name: "San Martín", provinces: ["Bellavista", "El Dorado", "Huallaga", "Lamas", "Mariscal Cáceres", "Moyobamba", "Picota", "Rioja", "San Martín", "Tocache"] },
  { name: "Tacna", provinces: ["Candarave", "Jorge Basadre", "Tacna", "Tarata"] },
  { name: "Tumbes", provinces: ["Contralmirante Villar", "Tumbes", "Zarumilla"] },
  { name: "Ucayali", provinces: ["Atalaya", "Coronel Portillo", "Padre Abad", "Purús"] },
];

// Suggested districts for the most populated provinces (used as datalist hints).
export const DISTRICT_SUGGESTIONS: Record<string, string[]> = {
  "Lima|Lima": [
    "Ate", "Barranco", "Breña", "Chorrillos", "Comas", "El Agustino", "Independencia",
    "Jesús María", "La Molina", "La Victoria", "Lima", "Lince", "Los Olivos",
    "Magdalena del Mar", "Miraflores", "Pueblo Libre", "Puente Piedra", "Rímac",
    "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores",
    "San Luis", "San Martín de Porres", "San Miguel", "Santa Anita",
    "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa María del Triunfo",
  ],
  "Callao|Callao": ["Bellavista", "Callao", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Mi Perú", "Ventanilla"],
  "Arequipa|Arequipa": ["Alto Selva Alegre", "Arequipa", "Cayma", "Cerro Colorado", "Characato", "José Luis Bustamante y Rivero", "Mariano Melgar", "Miraflores", "Paucarpata", "Sachaca", "Socabaya", "Yanahuara"],
  "La Libertad|Trujillo": ["El Porvenir", "Florencia de Mora", "Huanchaco", "La Esperanza", "Laredo", "Moche", "Salaverry", "Trujillo", "Víctor Larco Herrera"],
  "Lambayeque|Chiclayo": ["Chiclayo", "José Leonardo Ortiz", "La Victoria", "Pimentel", "Reque", "Santa Rosa"],
  "Piura|Piura": ["Castilla", "Catacaos", "Cura Mori", "La Arena", "La Unión", "Las Lomas", "Piura", "Tambo Grande", "Veintiséis de Octubre"],
  "Cusco|Cusco": ["Cusco", "San Jerónimo", "San Sebastián", "Santiago", "Wanchaq"],
};
