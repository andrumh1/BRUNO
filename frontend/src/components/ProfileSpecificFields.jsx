import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Building2, Store, MapPin, Heart, User, Star, Clock, Camera, Link as LinkIcon, AlertTriangle, Phone, Pill } from "lucide-react";

const ProfileSpecificFields = ({ cardType, customFields, onChange }) => {
  const { t } = useLanguage();

  const updateField = (fieldName, value) => {
    onChange({
      ...customFields,
      [fieldName]: value
    });
  };

  const addArrayItem = (fieldName, defaultItem) => {
    const current = customFields[fieldName] || [];
    updateField(fieldName, [...current, defaultItem]);
  };

  const updateArrayItem = (fieldName, index, key, value) => {
    const current = [...(customFields[fieldName] || [])];
    current[index] = { ...current[index], [key]: value };
    updateField(fieldName, current);
  };

  const removeArrayItem = (fieldName, index) => {
    const current = (customFields[fieldName] || []).filter((_, i) => i !== index);
    updateField(fieldName, current);
  };

  // PERSONAL fields
  if (cardType === "personal") {
    return (
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <CardTitle>{t("profileFields.personal.sectionTitle")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.personal.profession")}</label>
              <Input
                placeholder="Diseñador UX, Abogado, etc."
                value={customFields.profession || ""}
                onChange={(e) => updateField("profession", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.personal.company")}</label>
              <Input
                placeholder="Empresa actual"
                value={customFields.company || ""}
                onChange={(e) => updateField("company", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("profileFields.personal.availability")}</label>
            <Input
              placeholder="Disponible para proyectos freelance"
              value={customFields.availability || ""}
              onChange={(e) => updateField("availability", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("profileFields.personal.portfolio")}</label>
            <Input
              placeholder="https://miportafolio.com"
              value={customFields.portfolio || ""}
              onChange={(e) => updateField("portfolio", e.target.value)}
            />
          </div>
          {/* Interests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("profileFields.personal.interests")}</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem("interests", { name: "" })}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t("profileFields.personal.addInterest")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(customFields.interests || []).map((interest, index) => (
                <div key={index} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1">
                  <Input
                    className="h-6 w-24 border-0 bg-transparent p-0 text-sm"
                    placeholder="Interés"
                    value={interest.name}
                    onChange={(e) => updateArrayItem("interests", index, "name", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeArrayItem("interests", index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // EMPRESARIAL / Corporate fields
  if (cardType === "empresarial") {
    return (
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle>{t("profileFields.empresarial.sectionTitle")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.empresarial.position")} *</label>
              <Input
                placeholder="Director de Marketing"
                value={customFields.position || ""}
                onChange={(e) => updateField("position", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.empresarial.department")}</label>
              <Input
                placeholder="Marketing, Ventas, IT..."
                value={customFields.department || ""}
                onChange={(e) => updateField("department", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.empresarial.officeLocation")}</label>
              <Input
                placeholder="Piso 5, Oficina 501"
                value={customFields.officeLocation || ""}
                onChange={(e) => updateField("officeLocation", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.empresarial.directPhone")}</label>
              <Input
                placeholder="+1 234 567 8900"
                value={customFields.directPhone || ""}
                onChange={(e) => updateField("directPhone", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("profileFields.empresarial.assistant")}</label>
            <Input
              placeholder="Nombre del asistente"
              value={customFields.assistant || ""}
              onChange={(e) => updateField("assistant", e.target.value)}
            />
          </div>
          {/* Responsibilities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("profileFields.empresarial.responsibilities")}</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem("responsibilities", { text: "" })}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t("profileFields.empresarial.addResponsibility")}
              </Button>
            </div>
            {(customFields.responsibilities || []).map((resp, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Responsabilidad o función"
                  value={resp.text}
                  onChange={(e) => updateArrayItem("responsibilities", index, "text", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArrayItem("responsibilities", index)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // NEGOCIO / Business fields
  if (cardType === "negocio") {
    return (
      <>
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              <CardTitle>{t("profileFields.negocio.sectionTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.negocio.businessType")}</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={customFields.businessType || ""}
                  onChange={(e) => updateField("businessType", e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="restaurant">Restaurante</option>
                  <option value="retail">Tienda / Retail</option>
                  <option value="service">Servicios</option>
                  <option value="healthcare">Salud</option>
                  <option value="education">Educación</option>
                  <option value="technology">Tecnología</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.negocio.foundedYear")}</label>
                <Input
                  type="number"
                  placeholder="2020"
                  value={customFields.foundedYear || ""}
                  onChange={(e) => updateField("foundedYear", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.negocio.schedule")}</label>
                <Input
                  placeholder="Lun-Vie 9am-6pm"
                  value={customFields.schedule || ""}
                  onChange={(e) => updateField("schedule", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.negocio.priceRange")}</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={customFields.priceRange || ""}
                  onChange={(e) => updateField("priceRange", e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="$">$ - Económico</option>
                  <option value="$$">$$ - Moderado</option>
                  <option value="$$$">$$$ - Premium</option>
                  <option value="$$$$">$$$$ - Lujo</option>
                </select>
              </div>
            </div>
            {/* Services */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("profileFields.negocio.services")}</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem("services", { name: "", price: "" })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("profileFields.negocio.addService")}
                </Button>
              </div>
              {(customFields.services || []).map((service, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Nombre del servicio"
                    value={service.name}
                    onChange={(e) => updateArrayItem("services", index, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Precio"
                    value={service.price}
                    onChange={(e) => updateArrayItem("services", index, "price", e.target.value)}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArrayItem("services", index)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Google Reviews Integration */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              <CardTitle>{t("profileFields.negocio.googleReviews")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.negocio.googleMapsUrl")}</label>
              <Input
                placeholder="https://maps.google.com/?cid=..."
                value={customFields.googleMapsUrl || ""}
                onChange={(e) => updateField("googleMapsUrl", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Copia el enlace de tu negocio en Google Maps para mostrar reseñas
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.negocio.websiteUrl")}</label>
              <Input
                placeholder="https://minegocio.com"
                value={customFields.websiteUrl || ""}
                onChange={(e) => updateField("websiteUrl", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Gallery */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <CardTitle>{t("profileFields.negocio.gallery")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Fotos del negocio</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem("gallery", { url: "", caption: "" })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("profileFields.negocio.addPhoto")}
                </Button>
              </div>
              {(customFields.gallery || []).map((photo, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="URL de la imagen"
                    value={photo.url}
                    onChange={(e) => updateArrayItem("gallery", index, "url", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Descripción"
                    value={photo.caption}
                    onChange={(e) => updateArrayItem("gallery", index, "caption", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArrayItem("gallery", index)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  // LUGARES / Places fields
  if (cardType === "lugares") {
    return (
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <CardTitle>{t("profileFields.lugares.sectionTitle")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.lugares.locationType")}</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={customFields.locationType || ""}
                onChange={(e) => updateField("locationType", e.target.value)}
              >
                <option value="">Seleccionar...</option>
                <option value="tourist">Turístico</option>
                <option value="historical">Histórico</option>
                <option value="natural">Natural</option>
                <option value="cultural">Cultural</option>
                <option value="religious">Religioso</option>
                <option value="recreational">Recreacional</option>
                <option value="warning">Zona de Advertencia</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.lugares.admissionFee")}</label>
              <Input
                placeholder="Gratis / $10 USD"
                value={customFields.admissionFee || ""}
                onChange={(e) => updateField("admissionFee", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("profileFields.lugares.openingHours")}</label>
            <Input
              placeholder="Todos los días 8am-6pm"
              value={customFields.openingHours || ""}
              onChange={(e) => updateField("openingHours", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("profileFields.lugares.accessibility")}</label>
            <Input
              placeholder="Acceso para sillas de ruedas, estacionamiento..."
              value={customFields.accessibility || ""}
              onChange={(e) => updateField("accessibility", e.target.value)}
            />
          </div>
          {/* Attractions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("profileFields.lugares.attractions")}</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem("attractions", { name: "", description: "" })}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t("profileFields.lugares.addAttraction")}
              </Button>
            </div>
            {(customFields.attractions || []).map((attraction, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Nombre de la atracción"
                  value={attraction.name}
                  onChange={(e) => updateArrayItem("attractions", index, "name", e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArrayItem("attractions", index)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          {/* Warnings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                {t("profileFields.lugares.warnings")}
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem("warnings", { text: "" })}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t("profileFields.lugares.addWarning")}
              </Button>
            </div>
            {(customFields.warnings || []).map((warning, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Advertencia de seguridad"
                  value={warning.text}
                  onChange={(e) => updateArrayItem("warnings", index, "text", e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeArrayItem("warnings", index)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // GUARDIAN fields
  if (cardType === "guardian") {
    return (
      <>
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <CardTitle>{t("profileFields.guardian.sectionTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.guardian.personName")} *</label>
                <Input
                  placeholder="Nombre de la persona"
                  value={customFields.personName || ""}
                  onChange={(e) => updateField("personName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.guardian.relationship")}</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={customFields.relationship || ""}
                  onChange={(e) => updateField("relationship", e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="child">Hijo/a</option>
                  <option value="parent">Padre/Madre</option>
                  <option value="grandparent">Abuelo/a</option>
                  <option value="spouse">Esposo/a</option>
                  <option value="sibling">Hermano/a</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.guardian.bloodType")}</label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={customFields.bloodType || ""}
                  onChange={(e) => updateField("bloodType", e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("profileFields.guardian.specialNeeds")}</label>
                <Input
                  placeholder="Necesidades especiales"
                  value={customFields.specialNeeds || ""}
                  onChange={(e) => updateField("specialNeeds", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Info */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              <CardTitle>Información Médica</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Allergies */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("profileFields.guardian.allergies")}</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem("allergies", { name: "", severity: "moderate" })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("profileFields.guardian.addAllergy")}
                </Button>
              </div>
              {(customFields.allergies || []).map((allergy, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Alergia"
                    value={allergy.name}
                    onChange={(e) => updateArrayItem("allergies", index, "name", e.target.value)}
                    className="flex-1"
                  />
                  <select
                    className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={allergy.severity}
                    onChange={(e) => updateArrayItem("allergies", index, "severity", e.target.value)}
                  >
                    <option value="mild">Leve</option>
                    <option value="moderate">Moderada</option>
                    <option value="severe">Severa</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArrayItem("allergies", index)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {/* Medications */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("profileFields.guardian.medications")}</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem("medications", { name: "", dosage: "", frequency: "" })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("profileFields.guardian.addMedication")}
                </Button>
              </div>
              {(customFields.medications || []).map((med, index) => (
                <div key={index} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <Input
                    placeholder="Medicamento"
                    value={med.name}
                    onChange={(e) => updateArrayItem("medications", index, "name", e.target.value)}
                    className="flex-1 min-w-[120px]"
                  />
                  <Input
                    placeholder="Dosis"
                    value={med.dosage}
                    onChange={(e) => updateArrayItem("medications", index, "dosage", e.target.value)}
                    className="w-24"
                  />
                  <Input
                    placeholder="Frecuencia"
                    value={med.frequency}
                    onChange={(e) => updateArrayItem("medications", index, "frequency", e.target.value)}
                    className="w-28"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArrayItem("medications", index)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("profileFields.guardian.medicalConditions")}</label>
              <textarea
                placeholder="Condiciones médicas importantes"
                value={customFields.medicalConditions || ""}
                onChange={(e) => updateField("medicalConditions", e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contacts */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              <CardTitle>{t("profileFields.guardian.emergencyContacts")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Contactos en caso de emergencia</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrayItem("emergencyContacts", { name: "", phone: "", relationship: "" })}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t("profileFields.guardian.addEmergencyContact")}
              </Button>
            </div>
            {(customFields.emergencyContacts || []).map((contact, index) => (
              <div key={index} className="p-3 border border-border rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Nombre"
                    value={contact.name}
                    onChange={(e) => updateArrayItem("emergencyContacts", index, "name", e.target.value)}
                  />
                  <Input
                    placeholder="Teléfono"
                    value={contact.phone}
                    onChange={(e) => updateArrayItem("emergencyContacts", index, "phone", e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Relación"
                      value={contact.relationship}
                      onChange={(e) => updateArrayItem("emergencyContacts", index, "relationship", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeArrayItem("emergencyContacts", index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </>
    );
  }

  return null;
};

export default ProfileSpecificFields;
