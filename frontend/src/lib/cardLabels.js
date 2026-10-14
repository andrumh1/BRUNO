/* Etiquetas internas de las tarjetas BRUNO en 5 idiomas. Fuente = texto en español tal como aparece en los módulos. */
import { createContext, useContext } from "react";

export const CARD_LANGS = [
  { id: "es", label: "Español", short: "ES" },
  { id: "en", label: "English", short: "EN" },
  { id: "pt", label: "Português", short: "PT" },
  { id: "fr", label: "Français", short: "FR" },
  { id: "it", label: "Italiano", short: "IT" },
];
const IDS = CARD_LANGS.map((l) => l.id);
export const CARD_LANG_KEY = "bruno_card_lang";

const D = {
  "Conecta conmigo": ["Connect with me", "Conecte-se comigo", "Restons en contact", "Connettiti con me"],
  "Galería": ["Gallery", "Galeria", "Galerie", "Galleria"],
  "Ubicación": ["Location", "Localização", "Localisation", "Posizione"],
  "Destacado": ["Featured", "Destaque", "À la une", "In evidenza"],
  "Datos profesionales": ["Professional details", "Dados profissionais", "Infos professionnelles", "Dati professionali"],
  "Contacto por finalidad": ["Contact by purpose", "Contato por finalidade", "Contact par objet", "Contatto per finalità"],
  "Llamar": ["Call", "Ligar", "Appeler", "Chiama"],
  "SMS": ["SMS", "SMS", "SMS", "SMS"],
  "Email": ["Email", "E-mail", "E-mail", "Email"],
  "WhatsApp": ["WhatsApp", "WhatsApp", "WhatsApp", "WhatsApp"],
  "Sitio web": ["Website", "Site", "Site web", "Sito web"],
  "Escanea para guardar": ["Scan to save", "Escaneie para salvar", "Scannez pour enregistrer", "Scansiona per salvare"],
  "Abre esta tarjeta al instante desde cualquier cámara.": ["Open this card instantly from any camera.", "Abra este cartão na hora com qualquer câmera.", "Ouvrez cette carte instantanément depuis n'importe quel appareil photo.", "Apri questa scheda all'istante da qualsiasi fotocamera."],
  "Experiencia": ["Experience", "Experiência", "Expérience", "Esperienza"],
  "Educación": ["Education", "Educação", "Formation", "Formazione"],
  "Habilidades": ["Skills", "Habilidades", "Compétences", "Competenze"],
  "Idiomas": ["Languages", "Idiomas", "Langues", "Lingue"],
  "Certificaciones": ["Certifications", "Certificações", "Certifications", "Certificazioni"],
  "Detalles": ["Details", "Detalhes", "Détails", "Dettagli"],
  "Información": ["Information", "Informações", "Informations", "Informazioni"],
  "Servicios": ["Services", "Serviços", "Services", "Servizi"],
  "Productos": ["Products", "Produtos", "Produits", "Prodotti"],
  "Equipo": ["Team", "Equipe", "Équipe", "Team"],
  "Horario": ["Opening hours", "Horário", "Horaires", "Orari"],
  "Qué encontrarás": ["What you'll find", "O que você vai encontrar", "Ce que vous trouverez", "Cosa troverai"],
  "Intereses": ["Interests", "Interesses", "Centres d'intérêt", "Interessi"],
  "Contactos de emergencia": ["Emergency contacts", "Contatos de emergência", "Contacts d'urgence", "Contatti di emergenza"],
  "Contacto del dueño": ["Owner contact", "Contato do dono", "Contact du propriétaire", "Contatto del proprietario"],
  "Medicación": ["Medication", "Medicação", "Médication", "Farmaci"],
  "Alergias": ["Allergies", "Alergias", "Allergies", "Allergie"],
  "Condiciones médicas": ["Medical conditions", "Condições médicas", "Conditions médicales", "Condizioni mediche"],
  "Beneficios": ["Benefits", "Benefícios", "Avantages", "Benefici"],
  "Profesión": ["Profession", "Profissão", "Profession", "Professione"],
  "Empresa": ["Company", "Empresa", "Entreprise", "Azienda"],
  "Disponibilidad": ["Availability", "Disponibilidade", "Disponibilité", "Disponibilità"],
  "Cargo": ["Position", "Cargo", "Poste", "Ruolo"],
  "Departamento": ["Department", "Departamento", "Service", "Reparto"],
  "Oficina": ["Office", "Escritório", "Bureau", "Ufficio"],
  "Teléfono directo": ["Direct phone", "Telefone direto", "Ligne directe", "Telefono diretto"],
  "Tipo": ["Type", "Tipo", "Type", "Tipo"],
  "Desde": ["Since", "Desde", "Depuis", "Dal"],
  "Precios": ["Prices", "Preços", "Tarifs", "Prezzi"],
  "Tipo de lugar": ["Place type", "Tipo de lugar", "Type de lieu", "Tipo di luogo"],
  "Entrada": ["Admission", "Entrada", "Entrée", "Ingresso"],
  "Accesibilidad": ["Accessibility", "Acessibilidade", "Accessibilité", "Accessibilità"],
  "Avisos": ["Notices", "Avisos", "Avertissements", "Avvisi"],
  "Nombre": ["Name", "Nome", "Nom", "Nome"],
  "Edad": ["Age", "Idade", "Âge", "Età"],
  "Grupo sanguíneo": ["Blood type", "Tipo sanguíneo", "Groupe sanguin", "Gruppo sanguigno"],
  "Especie": ["Species", "Espécie", "Espèce", "Specie"],
  "Raza": ["Breed", "Raça", "Race", "Razza"],
  "Color": ["Color", "Cor", "Couleur", "Colore"],
  "Tamaño": ["Size", "Tamanho", "Taille", "Taglia"],
  "Microchip": ["Microchip", "Microchip", "Puce", "Microchip"],
  "Señas": ["Identifying marks", "Sinais", "Signes distinctifs", "Segni particolari"],
  "Si se pierde": ["If lost", "Se perder", "En cas de perte", "Se si perde"],
  "Recompensa": ["Reward", "Recompensa", "Récompense", "Ricompensa"],
  "Vacunado": ["Vaccinated", "Vacinado", "Vacciné", "Vaccinato"],
  "Esterilizado": ["Neutered", "Castrado", "Stérilisé", "Sterilizzato"],
  "Responsabilidades": ["Responsibilities", "Responsabilidades", "Responsabilités", "Responsabilità"],
  "Ciudad": ["City", "Cidade", "Ville", "Città"],
  "Agencia": ["Agency", "Agência", "Agence", "Agenzia"],
  "Contrataciones": ["Bookings", "Contratações", "Réservations", "Ingaggi"],
  "Colaboraciones": ["Collaborations", "Colaborações", "Collaborations", "Collaborazioni"],
  "Prensa": ["Press", "Imprensa", "Presse", "Stampa"],
  "Sí": ["Yes", "Sim", "Oui", "Sì"],
  "No": ["No", "Não", "Non", "No"],
  "Urgente": ["Urgent", "Urgente", "Urgent", "Urgente"],
  "vacantes": ["openings", "vagas", "postes", "posti"],
  "Ejemplo ficticio": ["Fictional example", "Exemplo fictício", "Exemple fictif", "Esempio fittizio"],
  "Idioma de la tarjeta": ["Card language", "Idioma do cartão", "Langue de la carte", "Lingua della scheda"],
};

export const translateCardLabel = (text, lang) => {
  if (typeof text !== "string" || !lang || lang === "es") return text;
  const i = IDS.indexOf(lang) - 1;
  const row = D[text];
  return row && row[i] ? row[i] : text;
};

/** Idioma inicial: ?lang= → preferencia guardada → idioma del dispositivo → es. */
export const detectCardLang = (search) => {
  try {
    const q = new URLSearchParams(search || window.location.search).get("lang");
    if (q && IDS.includes(q)) return q;
    const saved = localStorage.getItem(CARD_LANG_KEY);
    if (saved && IDS.includes(saved)) return saved;
    const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
    return IDS.includes(nav) ? nav : "es";
  } catch { return "es"; }
};

export const CardLangContext = createContext("es");
export const useCardLang = () => useContext(CardLangContext);
export const useCardT = () => { const lang = useCardLang(); return (text) => translateCardLabel(text, lang); };
