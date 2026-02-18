import React, { createContext, useContext, useState, useEffect } from "react";

// Traducciones ES/EN
const translations = {
  es: {
    // Navegación
    nav: {
      explore: "Explorar",
      map: "Mapa",
      myPanel: "Mi Panel",
      login: "Iniciar Sesión",
      register: "Registrarse",
      logout: "Cerrar Sesión",
      pricing: "Precios",
      contact: "Contacto",
      help: "Ayuda",
    },
    // Feed
    feed: {
      title: "Explorar Tarjetas",
      subtitle: "Descubre tarjetas digitales de profesionales y negocios",
      searchPlaceholder: "Buscar tarjetas...",
      allTypes: "Todos",
      noResults: "No se encontraron tarjetas",
      views: "vistas",
      listView: "Lista",
      gridView: "Cuadrícula",
    },
    // Dashboard
    dashboard: {
      title: "Mi Panel",
      myCards: "Mis Tarjetas",
      createCard: "Crear Tarjeta",
      noCards: "Aún no tienes tarjetas",
      noCardsDesc: "Crea tu primera tarjeta digital y compártela con el mundo",
      edit: "Editar",
      view: "Ver",
      delete: "Eliminar",
      share: "Compartir",
      qrCode: "Código QR",
    },
    // Tarjetas
    cards: {
      types: {
        personal: "Personal",
        empresarial: "Empresarial",
        negocio: "Negocio",
        lugares: "Lugares",
        guardian: "Guardián",
        curriculum: "Curriculum",
        mascotas: "Mascotas",
      },
      typeDescriptions: {
        personal: "Tarjeta de presentación personal",
        empresarial: "Presentación corporativa",
        negocio: "Información de empresa o negocio",
        lugares: "Turismo, información, advertencias",
        guardian: "Para niños, ancianos o personas con necesidades especiales",
        curriculum: "Hoja de vida profesional",
        mascotas: "Para tu mascota: información de contacto si se pierde",
      },
    },
    // Crear/Editar tarjeta
    cardForm: {
      createTitle: "Crear Nueva Tarjeta",
      editTitle: "Editar Tarjeta",
      cardType: "Tipo de Tarjeta",
      selectType: "Selecciona el tipo de tarjeta",
      template: "Plantilla",
      selectTemplate: "Elige el diseño de tu tarjeta",
      images: "Imágenes",
      uploadImages: "Sube tu foto de perfil y banner",
      banner: "Banner",
      avatar: "Foto de Perfil",
      changeBanner: "Cambiar Banner",
      changePhoto: "Cambiar Foto",
      uploadBanner: "Click para subir banner",
      uploadPhoto: "Click para subir foto",
      uploading: "Subiendo...",
      recommended: "Recomendado",
      basicInfo: "Información Básica",
      title: "Título",
      subtitle: "Subtítulo",
      description: "Descripción",
      addDescription: "Agrega una descripción...",
      socialLinks: "Redes Sociales y Contacto",
      socialLinksDesc: "Agrega tus redes sociales, sitio web y formas de contacto",
      location: "Ubicación",
      locationDesc: "Agrega la ubicación de tu tarjeta (opcional)",
      colors: "Colores",
      backgroundColor: "Color de Fondo",
      textColor: "Color de Texto",
      privacy: "Privacidad",
      isPublic: "Tarjeta pública",
      isPublicDesc: "Cualquiera con el enlace puede ver esta tarjeta",
      feedVisibility: "Visibilidad en el Feed",
      showInFeed: "Mostrar en el Feed público",
      showInFeedDesc: "Si está desmarcado, solo se podrá acceder con el enlace directo",
      animation: "Animación",
      isAnimated: "Activar efecto dinámico",
      savedSuccess: "¡Tarjeta guardada exitosamente!",
      updateSuccess: "¡Tarjeta actualizada exitosamente!",
      isAnimatedDesc: "Aplica suaves movimientos tipo burbuja a la tarjeta",
      cancel: "Cancelar",
      create: "Crear Tarjeta",
      creating: "Creando...",
      save: "Guardar Cambios",
      saving: "Guardando...",
      preview: "Vista Previa",
      previewDesc: "Así se verá tu tarjeta",
    },
    // CURRICULUM específico
    curriculum: {
      experience: "Experiencia Laboral",
      addExperience: "Agregar Experiencia",
      education: "Educación",
      addEducation: "Agregar Educación",
      skills: "Habilidades",
      addSkill: "Agregar Habilidad",
      languages: "Idiomas",
      addLanguage: "Agregar Idioma",
      certifications: "Certificaciones",
      addCertification: "Agregar Certificación",
      documents: "Documentos",
      addDocument: "Agregar Documento",
      references: "Referencias Laborales",
      addReference: "Agregar Referencia",
      downloadPDF: "Descargar PDF",
      company: "Empresa",
      position: "Cargo",
      startDate: "Fecha de Inicio",
      endDate: "Fecha de Fin",
      current: "Actualmente",
      institution: "Institución",
      degree: "Título",
      level: "Nivel",
      native: "Nativo",
      fluent: "Fluido",
      intermediate: "Intermedio",
      basic: "Básico",
      referenceName: "Nombre del Contacto",
      referencePosition: "Cargo del Contacto",
      referenceCompany: "Empresa",
      referencePhone: "Teléfono",
      referenceEmail: "Email",
      referenceRelationship: "Relación",
    },
    // Campos específicos por tipo de perfil
    profileFields: {
      // EMPRESARIAL / Corporativo
      empresarial: {
        sectionTitle: "Información Corporativa",
        position: "Cargo / Puesto",
        department: "Departamento",
        employeeId: "ID de Empleado",
        officeLocation: "Ubicación de Oficina",
        directPhone: "Teléfono Directo",
        assistant: "Asistente",
        responsibilities: "Funciones Principales",
        addResponsibility: "Agregar Función",
      },
      // NEGOCIO / Empresa
      negocio: {
        sectionTitle: "Información del Negocio",
        businessType: "Tipo de Negocio",
        foundedYear: "Año de Fundación",
        employeeCount: "Número de Empleados",
        schedule: "Horario de Atención",
        services: "Servicios",
        addService: "Agregar Servicio",
        gallery: "Galería de Fotos",
        addPhoto: "Agregar Foto",
        googleReviews: "Reseñas de Google",
        googleMapsUrl: "URL de Google Maps",
        googlePlaceId: "ID de Google Place",
        websiteUrl: "Sitio Web",
        priceRange: "Rango de Precios",
      },
      // LUGARES
      lugares: {
        sectionTitle: "Información del Lugar",
        locationType: "Tipo de Lugar",
        attractions: "Atracciones",
        addAttraction: "Agregar Atracción",
        openingHours: "Horarios",
        admissionFee: "Costo de Entrada",
        accessibility: "Accesibilidad",
        warnings: "Advertencias",
        addWarning: "Agregar Advertencia",
        nearbyPlaces: "Lugares Cercanos",
        tours: "Tours Disponibles",
      },
      // GUARDIAN
      guardian: {
        sectionTitle: "Información de Guardián",
        personName: "Nombre de la Persona",
        relationship: "Relación",
        bloodType: "Tipo de Sangre",
        allergies: "Alergias",
        addAllergy: "Agregar Alergia",
        medications: "Medicamentos",
        addMedication: "Agregar Medicamento",
        medicalConditions: "Condiciones Médicas",
        emergencyContacts: "Contactos de Emergencia",
        addEmergencyContact: "Agregar Contacto",
        specialNeeds: "Necesidades Especiales",
        doctorInfo: "Información del Médico",
        insuranceInfo: "Información del Seguro",
      },
      // PERSONAL
      personal: {
        sectionTitle: "Información Personal",
        profession: "Profesión",
        company: "Empresa Actual",
        interests: "Intereses",
        addInterest: "Agregar Interés",
        portfolio: "Portafolio",
        availability: "Disponibilidad",
      },
      // MASCOTAS
      mascotas: {
        sectionTitle: "Información de la Mascota",
        petName: "Nombre de la Mascota",
        species: "Especie",
        breed: "Raza",
        age: "Edad",
        color: "Color",
        size: "Tamaño",
        identifyingMarks: "Marcas Distintivas",
        medicalInfo: "Información Médica",
        vaccinated: "Vacunado",
        sterilized: "Esterilizado",
        microchip: "Microchip",
        medicalConditions: "Condiciones Médicas",
        vetInfo: "Veterinario",
        ifLostTitle: "Si Encuentras a Esta Mascota",
        reward: "Recompensa",
        lostInstructions: "Instrucciones si se Pierde",
        ownerContacts: "Contactos del Dueño",
      },
    },
    // Visor de tarjeta
    cardView: {
      share: "Compartir",
      qrCode: "Código QR",
      connectWithMe: "Conecta conmigo",
      gallery: "Galería",
      notFound: "Tarjeta no encontrada",
      backHome: "Volver al inicio",
      loading: "Cargando tarjeta...",
      createMyCard: "Crear mi tarjeta BRUNO",
      createdWith: "Creado con",
      digitalCards: "Tarjetas digitales del futuro",
      downloadQR: "Descargar QR con Logo",
      permanentQR: "QR permanente - nunca cambia, solo actualiza la información de la tarjeta",
      linkCopied: "¡Enlace copiado al portapapeles!",
    },
    // Auth
    auth: {
      login: "Iniciar Sesión",
      register: "Registrarse",
      email: "Email",
      password: "Contraseña",
      name: "Nombre",
      confirmPassword: "Confirmar Contraseña",
      forgotPassword: "¿Olvidaste tu contraseña?",
      noAccount: "¿No tienes cuenta?",
      hasAccount: "¿Ya tienes cuenta?",
      orContinueWith: "O continúa con",
      loginWithGoogle: "Iniciar sesión con Google",
      registerWithGoogle: "Registrarse con Google",
    },
    // Precios
    pricing: {
      title: "Planes para cada necesidad",
      subtitle: "Desde individuos hasta grandes empresas. Encuentra el plan perfecto para ti.",
      free: "Gratis",
      forever: "siempre",
      month: "/mes",
      startFree: "Comenzar Gratis",
      startTrial: "Empezar Prueba",
      contactSales: "Contactar Ventas",
      mostPopular: "Más Popular",
      compareFeatures: "Compara características",
      faq: "Preguntas Frecuentes sobre Planes",
      customPlan: "¿Necesitas un plan personalizado?",
      customPlanDesc: "Para empresas con necesidades específicas, creamos un plan a tu medida",
      talkToSales: "Hablar con Ventas",
    },
    // Editor de imágenes
    imageEditor: {
      title: "Editar Imagen",
      crop: "Recortar",
      rotate: "Rotar",
      flip: "Voltear",
      brightness: "Brillo",
      contrast: "Contraste",
      apply: "Aplicar",
      cancel: "Cancelar",
      rotateLeft: "Rotar Izquierda",
      rotateRight: "Rotar Derecha",
      flipHorizontal: "Voltear Horizontal",
      flipVertical: "Voltear Vertical",
    },
    // General
    common: {
      loading: "Cargando...",
      error: "Error",
      success: "Éxito",
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      edit: "Editar",
      view: "Ver",
      close: "Cerrar",
      confirm: "Confirmar",
      yes: "Sí",
      no: "No",
      search: "Buscar",
      filter: "Filtrar",
      sort: "Ordenar",
      more: "Más",
      less: "Menos",
      all: "Todos",
      none: "Ninguno",
      optional: "opcional",
      required: "requerido",
    },
  },
  en: {
    // Navigation
    nav: {
      explore: "Explore",
      map: "Map",
      myPanel: "My Panel",
      login: "Log In",
      register: "Sign Up",
      logout: "Log Out",
      pricing: "Pricing",
      contact: "Contact",
      help: "Help",
    },
    // Feed
    feed: {
      title: "Explore Cards",
      subtitle: "Discover digital cards from professionals and businesses",
      searchPlaceholder: "Search cards...",
      allTypes: "All",
      noResults: "No cards found",
      views: "views",
      listView: "List",
      gridView: "Grid",
    },
    // Dashboard
    dashboard: {
      title: "My Panel",
      myCards: "My Cards",
      createCard: "Create Card",
      noCards: "You don't have any cards yet",
      noCardsDesc: "Create your first digital card and share it with the world",
      edit: "Edit",
      view: "View",
      delete: "Delete",
      share: "Share",
      qrCode: "QR Code",
    },
    // Cards
    cards: {
      types: {
        personal: "Personal",
        empresarial: "Corporate",
        negocio: "Business",
        lugares: "Places",
        guardian: "Guardian",
        curriculum: "Resume",
        mascotas: "Pets",
      },
      typeDescriptions: {
        personal: "Personal presentation card",
        empresarial: "Corporate presentation",
        negocio: "Company or business information",
        lugares: "Tourism, information, warnings",
        guardian: "For children, elderly or people with special needs",
        curriculum: "Professional resume",
        mascotas: "For your pet: contact info if lost",
      },
    },
    // Create/Edit card
    cardForm: {
      createTitle: "Create New Card",
      editTitle: "Edit Card",
      cardType: "Card Type",
      selectType: "Select the card type",
      template: "Template",
      selectTemplate: "Choose your card design",
      images: "Images",
      uploadImages: "Upload your profile photo and banner",
      banner: "Banner",
      avatar: "Profile Photo",
      changeBanner: "Change Banner",
      changePhoto: "Change Photo",
      uploadBanner: "Click to upload banner",
      uploadPhoto: "Click to upload photo",
      uploading: "Uploading...",
      recommended: "Recommended",
      basicInfo: "Basic Information",
      title: "Title",
      subtitle: "Subtitle",
      description: "Description",
      addDescription: "Add a description...",
      socialLinks: "Social Links & Contact",
      socialLinksDesc: "Add your social networks, website and contact methods",
      location: "Location",
      locationDesc: "Add your card location (optional)",
      colors: "Colors",
      backgroundColor: "Background Color",
      textColor: "Text Color",
      privacy: "Privacy",
      isPublic: "Public card",
      isPublicDesc: "Anyone with the link can view this card",
      feedVisibility: "Feed Visibility",
      showInFeed: "Show in public Feed",
      showInFeedDesc: "If unchecked, can only be accessed with direct link",
      animation: "Animation",
      isAnimated: "Enable dynamic effect",
      isAnimatedDesc: "Apply smooth bubble-like movements to the card",
      cancel: "Cancel",
      create: "Create Card",
      creating: "Creating...",
      save: "Save Changes",
      saving: "Saving...",
      preview: "Preview",
      previewDesc: "This is how your card will look",
    },
    // CURRICULUM specific
    curriculum: {
      experience: "Work Experience",
      addExperience: "Add Experience",
      education: "Education",
      addEducation: "Add Education",
      skills: "Skills",
      addSkill: "Add Skill",
      languages: "Languages",
      addLanguage: "Add Language",
      certifications: "Certifications",
      addCertification: "Add Certification",
      documents: "Documents",
      addDocument: "Add Document",
      references: "Work References",
      addReference: "Add Reference",
      downloadPDF: "Download PDF",
      company: "Company",
      position: "Position",
      startDate: "Start Date",
      endDate: "End Date",
      current: "Currently",
      institution: "Institution",
      degree: "Degree",
      level: "Level",
      native: "Native",
      fluent: "Fluent",
      intermediate: "Intermediate",
      basic: "Basic",
      referenceName: "Contact Name",
      referencePosition: "Contact Position",
      referenceCompany: "Company",
      referencePhone: "Phone",
      referenceEmail: "Email",
      referenceRelationship: "Relationship",
    },
    // Profile-specific fields
    profileFields: {
      // EMPRESARIAL / Corporate
      empresarial: {
        sectionTitle: "Corporate Information",
        position: "Position / Title",
        department: "Department",
        employeeId: "Employee ID",
        officeLocation: "Office Location",
        directPhone: "Direct Phone",
        assistant: "Assistant",
        responsibilities: "Main Responsibilities",
        addResponsibility: "Add Responsibility",
      },
      // NEGOCIO / Business
      negocio: {
        sectionTitle: "Business Information",
        businessType: "Business Type",
        foundedYear: "Founded Year",
        employeeCount: "Number of Employees",
        schedule: "Business Hours",
        services: "Services",
        addService: "Add Service",
        gallery: "Photo Gallery",
        addPhoto: "Add Photo",
        googleReviews: "Google Reviews",
        googleMapsUrl: "Google Maps URL",
        googlePlaceId: "Google Place ID",
        websiteUrl: "Website",
        priceRange: "Price Range",
      },
      // LUGARES / Places
      lugares: {
        sectionTitle: "Place Information",
        locationType: "Location Type",
        attractions: "Attractions",
        addAttraction: "Add Attraction",
        openingHours: "Opening Hours",
        admissionFee: "Admission Fee",
        accessibility: "Accessibility",
        warnings: "Warnings",
        addWarning: "Add Warning",
        nearbyPlaces: "Nearby Places",
        tours: "Available Tours",
      },
      // GUARDIAN
      guardian: {
        sectionTitle: "Guardian Information",
        personName: "Person's Name",
        relationship: "Relationship",
        bloodType: "Blood Type",
        allergies: "Allergies",
        addAllergy: "Add Allergy",
        medications: "Medications",
        addMedication: "Add Medication",
        medicalConditions: "Medical Conditions",
        emergencyContacts: "Emergency Contacts",
        addEmergencyContact: "Add Contact",
        specialNeeds: "Special Needs",
        doctorInfo: "Doctor Information",
        insuranceInfo: "Insurance Information",
      },
      // PERSONAL
      personal: {
        sectionTitle: "Personal Information",
        profession: "Profession",
        company: "Current Company",
        interests: "Interests",
        addInterest: "Add Interest",
        portfolio: "Portfolio",
        availability: "Availability",
      },
      // MASCOTAS / Pets
      mascotas: {
        sectionTitle: "Pet Information",
        petName: "Pet Name",
        species: "Species",
        breed: "Breed",
        age: "Age",
        color: "Color",
        size: "Size",
        identifyingMarks: "Identifying Marks",
        medicalInfo: "Medical Information",
        vaccinated: "Vaccinated",
        sterilized: "Sterilized",
        microchip: "Microchip",
        medicalConditions: "Medical Conditions",
        vetInfo: "Veterinarian",
        ifLostTitle: "If You Find This Pet",
        reward: "Reward",
        lostInstructions: "Instructions if Lost",
        ownerContacts: "Owner Contacts",
      },
    },
    // Card viewer
    cardView: {
      share: "Share",
      qrCode: "QR Code",
      connectWithMe: "Connect with me",
      gallery: "Gallery",
      notFound: "Card not found",
      backHome: "Back to home",
      loading: "Loading card...",
      createMyCard: "Create my BRUNO card",
      createdWith: "Created with",
      digitalCards: "Digital cards of the future",
      downloadQR: "Download QR with Logo",
      permanentQR: "Permanent QR - never changes, only updates card information",
      linkCopied: "Link copied to clipboard!",
    },
    // Auth
    auth: {
      login: "Log In",
      register: "Sign Up",
      email: "Email",
      password: "Password",
      name: "Name",
      confirmPassword: "Confirm Password",
      forgotPassword: "Forgot your password?",
      noAccount: "Don't have an account?",
      hasAccount: "Already have an account?",
      orContinueWith: "Or continue with",
      loginWithGoogle: "Log in with Google",
      registerWithGoogle: "Sign up with Google",
    },
    // Pricing
    pricing: {
      title: "Plans for every need",
      subtitle: "From individuals to large companies. Find the perfect plan for you.",
      free: "Free",
      forever: "forever",
      month: "/month",
      startFree: "Start Free",
      startTrial: "Start Trial",
      contactSales: "Contact Sales",
      mostPopular: "Most Popular",
      compareFeatures: "Compare features",
      faq: "Frequently Asked Questions about Plans",
      customPlan: "Need a custom plan?",
      customPlanDesc: "For companies with specific needs, we create a plan tailored to you",
      talkToSales: "Talk to Sales",
    },
    // Image editor
    imageEditor: {
      title: "Edit Image",
      crop: "Crop",
      rotate: "Rotate",
      flip: "Flip",
      brightness: "Brightness",
      contrast: "Contrast",
      apply: "Apply",
      cancel: "Cancel",
      rotateLeft: "Rotate Left",
      rotateRight: "Rotate Right",
      flipHorizontal: "Flip Horizontal",
      flipVertical: "Flip Vertical",
    },
    // General
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      view: "View",
      close: "Close",
      confirm: "Confirm",
      yes: "Yes",
      no: "No",
      search: "Search",
      filter: "Filter",
      sort: "Sort",
      more: "More",
      less: "Less",
      all: "All",
      none: "None",
      optional: "optional",
      required: "required",
    },
  },
};

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Prioridad: localStorage > navegador > español por defecto
    const saved = localStorage.getItem("bruno_language");
    if (saved && (saved === "es" || saved === "en")) {
      return saved;
    }
    
    // Auto-detectar idioma del navegador
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith("en")) {
      return "en";
    }
    return "es"; // Español por defecto
  });

  useEffect(() => {
    localStorage.setItem("bruno_language", language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (path) => {
    const keys = path.split(".");
    let result = translations[language];
    
    for (const key of keys) {
      if (result && result[key] !== undefined) {
        result = result[key];
      } else {
        // Fallback al español si no encuentra la traducción
        result = translations.es;
        for (const k of keys) {
          if (result && result[k] !== undefined) {
            result = result[k];
          } else {
            return path; // Retorna la clave si no encuentra traducción
          }
        }
        break;
      }
    }
    
    return result;
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "es" ? "en" : "es"));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
