import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SocialLinkSelector from "@/components/SocialLinkSelector";
import TemplateSelector from "@/components/TemplateSelector";
import LocationSelector from "@/components/LocationSelector";
import ImageEditor from "@/components/ImageEditor";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ProfileSpecificFields from "@/components/ProfileSpecificFields";
import BubbleSelect from "@/components/BubbleSelect";
import axios from "axios";
import { ArrowLeft, Save, Upload, Image as ImageIcon, Plus, Trash2, Briefcase, GraduationCap, Award, Languages, FileText } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CreateCardPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  
  // Image editor state
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageType, setEditingImageType] = useState(null);
  const [tempImageUrl, setTempImageUrl] = useState(null);
  
  const cardTypes = [
    { value: "personal", label: t("cards.types.personal"), desc: t("cards.typeDescriptions.personal") },
    { value: "empresarial", label: t("cards.types.empresarial"), desc: t("cards.typeDescriptions.empresarial") },
    { value: "negocio", label: t("cards.types.negocio"), desc: t("cards.typeDescriptions.negocio") },
    { value: "lugares", label: t("cards.types.lugares"), desc: t("cards.typeDescriptions.lugares") },
    { value: "guardian", label: t("cards.types.guardian"), desc: t("cards.typeDescriptions.guardian") },
    { value: "curriculum", label: t("cards.types.curriculum"), desc: t("cards.typeDescriptions.curriculum") },
    { value: "mascotas", label: t("cards.types.mascotas"), desc: t("cards.typeDescriptions.mascotas") },
  ];

  const [formData, setFormData] = useState({
    card_type: "personal",
    title: "",
    subtitle: "",
    description: "",
    avatar_url: "",
    banner_url: "",
    background_color: "#FF5A00",
    text_color: "#FFFFFF",
    social_links: [],
    location: null,
    template_id: "personal_classic",
    is_public: true,
    show_in_feed: true,
    is_animated: true,
    custom_fields: {
      experience: [],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
      documents: [],
      references: []
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleCardTypeChange = (type) => {
    const defaultTemplates = {
      personal: "personal_classic",
      empresarial: "empresarial_pro",
      negocio: "negocio_showcase",
      lugares: "lugares_tour",
      guardian: "guardian_safe",
      curriculum: "curriculum_clean",
      mascotas: "mascotas_friend",
    };
    
    setFormData({
      ...formData,
      card_type: type,
      template_id: defaultTemplates[type]
    });
  };

  // Handle file selection and open editor
  const handleFileSelect = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setTempImageUrl(event.target.result);
      setEditingImageType(type);
      setShowImageEditor(true);
    };
    reader.readAsDataURL(file);
  };

  // Handle edited image save
  const handleImageEditorSave = async (file, dataUrl) => {
    setShowImageEditor(false);
    const type = editingImageType;
    
    const uploadSetter = type === "avatar" ? setUploadingAvatar : setUploadingBanner;
    uploadSetter(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const endpoint = type === "avatar" ? "/upload/avatar" : "/upload/banner";
      const response = await axios.post(`${API}${endpoint}`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setFormData({
        ...formData,
        [`${type}_url`]: response.data.url,
      });
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(t("common.error") + ": " + t("cardForm.uploading"));
    } finally {
      uploadSetter(false);
      setEditingImageType(null);
      setTempImageUrl(null);
    }
  };

  // CURRICULUM specific handlers
  const addCurriculumItem = (field) => {
    const newItem = getEmptyItem(field);
    setFormData({
      ...formData,
      custom_fields: {
        ...formData.custom_fields,
        [field]: [...formData.custom_fields[field], newItem]
      }
    });
  };

  const updateCurriculumItem = (field, index, key, value) => {
    const updated = [...formData.custom_fields[field]];
    updated[index] = { ...updated[index], [key]: value };
    setFormData({
      ...formData,
      custom_fields: {
        ...formData.custom_fields,
        [field]: updated
      }
    });
  };

  const removeCurriculumItem = (field, index) => {
    const updated = formData.custom_fields[field].filter((_, i) => i !== index);
    setFormData({
      ...formData,
      custom_fields: {
        ...formData.custom_fields,
        [field]: updated
      }
    });
  };

  const getEmptyItem = (field) => {
    switch (field) {
      case "experience":
        return { company: "", position: "", startDate: "", endDate: "", current: false, description: "" };
      case "education":
        return { institution: "", degree: "", startDate: "", endDate: "", description: "" };
      case "skills":
        return { name: "", level: 80 };
      case "languages":
        return { name: "", level: "intermediate" };
      case "certifications":
        return { name: "", issuer: "", date: "", url: "" };
      case "documents":
        return { name: "", url: "", type: "pdf" };
      case "references":
        return { name: "", position: "", company: "", relationship: "", phone: "", email: "" };
      default:
        return {};
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/cards`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate(`/dashboard`);
    } catch (error) {
      console.error("Error creating card:", error);
      alert(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src="/bruno-mascot.png" alt="BRUNO" className="bruno-logo-sm" />
            <div className="hidden sm:block">
              <h1 className="text-lg sm:text-xl font-bold">{t("cardForm.createTitle")}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{t("cardForm.selectType")}</p>
            </div>
          </div>
          <LanguageSwitcher variant="minimal" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Tarjeta - Dropdown */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.cardType")}</CardTitle>
                  <CardDescription>{t("cardForm.selectType")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <select
                    value={formData.card_type}
                    onChange={(e) => handleCardTypeChange(e.target.value)}
                    className="flex h-12 w-full rounded-xl border-2 border-input bg-background px-4 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                  >
                    {cardTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label} - {type.desc}
                      </option>
                    ))}
                  </select>
                  
                  {/* Preview del tipo seleccionado */}
                  <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="font-medium text-primary">
                      {cardTypes.find(t => t.value === formData.card_type)?.label}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {cardTypes.find(t => t.value === formData.card_type)?.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Plantilla */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.template")}</CardTitle>
                  <CardDescription>{t("cardForm.selectTemplate")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateSelector
                    cardType={formData.card_type}
                    selectedTemplate={formData.template_id}
                    onChange={(template) => setFormData({ ...formData, template_id: template })}
                  />
                </CardContent>
              </Card>

              {/* Imágenes */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.images")}</CardTitle>
                  <CardDescription>{t("cardForm.uploadImages")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Banner */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("cardForm.banner")} (1200x400px)</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                      {formData.banner_url ? (
                        <div className="space-y-2">
                          <img
                            src={formData.banner_url}
                            alt="Banner"
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData({ ...formData, banner_url: "" })}
                          >
                            {t("cardForm.changeBanner")}
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e, "banner")}
                            className="hidden"
                            disabled={uploadingBanner}
                          />
                          <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium mb-1">
                            {uploadingBanner ? t("cardForm.uploading") : t("cardForm.uploadBanner")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("cardForm.recommended")}: 1200x400px
                          </p>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("cardForm.avatar")} (400x400px)</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                      {formData.avatar_url ? (
                        <div className="space-y-2">
                          <img
                            src={formData.avatar_url}
                            alt="Avatar"
                            className="w-32 h-32 object-cover rounded-full mx-auto"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData({ ...formData, avatar_url: "" })}
                          >
                            {t("cardForm.changePhoto")}
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e, "avatar")}
                            className="hidden"
                            disabled={uploadingAvatar}
                          />
                          <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium mb-1">
                            {uploadingAvatar ? t("cardForm.uploading") : t("cardForm.uploadPhoto")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("cardForm.recommended")}: 400x400px
                          </p>
                        </label>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Información Básica */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.basicInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("cardForm.title")} *</label>
                    <Input
                      name="title"
                      placeholder="Juan Pérez"
                      value={formData.title}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("cardForm.subtitle")}</label>
                    <Input
                      name="subtitle"
                      placeholder="UX Designer @ Tech Co"
                      value={formData.subtitle}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("cardForm.description")}</label>
                    <textarea
                      name="description"
                      placeholder={t("cardForm.addDescription")}
                      value={formData.description}
                      onChange={handleChange}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* CURRICULUM Fields */}
              {formData.card_type === "curriculum" && (
                <>
                  {/* Experiencia Laboral */}
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-primary" />
                          <CardTitle>{t("curriculum.experience")}</CardTitle>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCurriculumItem("experience")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("curriculum.addExperience")}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {formData.custom_fields.experience.map((exp, index) => (
                        <div key={index} className="p-4 border border-border rounded-lg space-y-3 relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 text-destructive"
                            onClick={() => removeCurriculumItem("experience", index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder={t("curriculum.company")}
                              value={exp.company}
                              onChange={(e) => updateCurriculumItem("experience", index, "company", e.target.value)}
                            />
                            <Input
                              placeholder={t("curriculum.position")}
                              value={exp.position}
                              onChange={(e) => updateCurriculumItem("experience", index, "position", e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              type="date"
                              placeholder={t("curriculum.startDate")}
                              value={exp.startDate}
                              onChange={(e) => updateCurriculumItem("experience", index, "startDate", e.target.value)}
                            />
                            <Input
                              type="date"
                              placeholder={t("curriculum.endDate")}
                              value={exp.endDate}
                              onChange={(e) => updateCurriculumItem("experience", index, "endDate", e.target.value)}
                              disabled={exp.current}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={exp.current}
                              onChange={(e) => updateCurriculumItem("experience", index, "current", e.target.checked)}
                            />
                            {t("curriculum.current")}
                          </label>
                          <textarea
                            placeholder={t("cardForm.description")}
                            value={exp.description}
                            onChange={(e) => updateCurriculumItem("experience", index, "description", e.target.value)}
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                      ))}
                      {formData.custom_fields.experience.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("curriculum.addExperience")} para comenzar
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Educación */}
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-5 h-5 text-primary" />
                          <CardTitle>{t("curriculum.education")}</CardTitle>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCurriculumItem("education")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("curriculum.addEducation")}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {formData.custom_fields.education.map((edu, index) => (
                        <div key={index} className="p-4 border border-border rounded-lg space-y-3 relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 text-destructive"
                            onClick={() => removeCurriculumItem("education", index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder={t("curriculum.institution")}
                              value={edu.institution}
                              onChange={(e) => updateCurriculumItem("education", index, "institution", e.target.value)}
                            />
                            <Input
                              placeholder={t("curriculum.degree")}
                              value={edu.degree}
                              onChange={(e) => updateCurriculumItem("education", index, "degree", e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              type="date"
                              value={edu.startDate}
                              onChange={(e) => updateCurriculumItem("education", index, "startDate", e.target.value)}
                            />
                            <Input
                              type="date"
                              value={edu.endDate}
                              onChange={(e) => updateCurriculumItem("education", index, "endDate", e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                      {formData.custom_fields.education.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("curriculum.addEducation")} para comenzar
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Habilidades */}
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-primary" />
                          <CardTitle>{t("curriculum.skills")}</CardTitle>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCurriculumItem("skills")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("curriculum.addSkill")}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {formData.custom_fields.skills.map((skill, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <Input
                            placeholder={t("curriculum.skills")}
                            value={skill.name}
                            onChange={(e) => updateCurriculumItem("skills", index, "name", e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={skill.level}
                            onChange={(e) => updateCurriculumItem("skills", index, "level", parseInt(e.target.value))}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeCurriculumItem("skills", index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Idiomas */}
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Languages className="w-5 h-5 text-primary" />
                          <CardTitle>{t("curriculum.languages")}</CardTitle>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCurriculumItem("languages")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("curriculum.addLanguage")}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {formData.custom_fields.languages.map((lang, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <Input
                            placeholder={t("curriculum.languages")}
                            value={lang.name}
                            onChange={(e) => updateCurriculumItem("languages", index, "name", e.target.value)}
                            className="flex-1"
                          />
                          <select
                            value={lang.level}
                            onChange={(e) => updateCurriculumItem("languages", index, "level", e.target.value)}
                            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                          >
                            <option value="native">{t("curriculum.native")}</option>
                            <option value="fluent">{t("curriculum.fluent")}</option>
                            <option value="intermediate">{t("curriculum.intermediate")}</option>
                            <option value="basic">{t("curriculum.basic")}</option>
                          </select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeCurriculumItem("languages", index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Documentos */}
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary" />
                          <CardTitle>{t("curriculum.documents")}</CardTitle>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCurriculumItem("documents")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("curriculum.addDocument")}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {formData.custom_fields.documents.map((doc, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <Input
                            placeholder="Nombre del documento"
                            value={doc.name}
                            onChange={(e) => updateCurriculumItem("documents", index, "name", e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="URL del documento"
                            value={doc.url}
                            onChange={(e) => updateCurriculumItem("documents", index, "url", e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeCurriculumItem("documents", index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Referencias Laborales */}
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-primary" />
                          <CardTitle>{t("curriculum.references")}</CardTitle>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCurriculumItem("references")}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("curriculum.addReference")}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {formData.custom_fields.references.map((ref, index) => (
                        <div key={index} className="p-4 border border-border rounded-lg space-y-3 relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 text-destructive"
                            onClick={() => removeCurriculumItem("references", index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              placeholder={t("curriculum.referenceName")}
                              value={ref.name}
                              onChange={(e) => updateCurriculumItem("references", index, "name", e.target.value)}
                            />
                            <Input
                              placeholder={t("curriculum.referencePosition")}
                              value={ref.position}
                              onChange={(e) => updateCurriculumItem("references", index, "position", e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              placeholder={t("curriculum.referenceCompany")}
                              value={ref.company}
                              onChange={(e) => updateCurriculumItem("references", index, "company", e.target.value)}
                            />
                            <Input
                              placeholder={t("curriculum.referenceRelationship")}
                              value={ref.relationship}
                              onChange={(e) => updateCurriculumItem("references", index, "relationship", e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              placeholder={t("curriculum.referencePhone")}
                              value={ref.phone}
                              onChange={(e) => updateCurriculumItem("references", index, "phone", e.target.value)}
                            />
                            <Input
                              type="email"
                              placeholder={t("curriculum.referenceEmail")}
                              value={ref.email}
                              onChange={(e) => updateCurriculumItem("references", index, "email", e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                      {formData.custom_fields.references.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t("curriculum.addReference")} para comenzar
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Profile-specific fields for non-curriculum types */}
              {formData.card_type !== "curriculum" && (
                <ProfileSpecificFields
                  cardType={formData.card_type}
                  customFields={formData.custom_fields}
                  onChange={(fields) => setFormData({ ...formData, custom_fields: fields })}
                />
              )}

              {/* Redes Sociales y Contacto */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.socialLinks")}</CardTitle>
                  <CardDescription>{t("cardForm.socialLinksDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SocialLinkSelector
                    links={formData.social_links}
                    onChange={(links) => setFormData({ ...formData, social_links: links })}
                  />
                </CardContent>
              </Card>

              {/* Ubicación */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.location")}</CardTitle>
                  <CardDescription>{t("cardForm.locationDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <LocationSelector
                    location={formData.location}
                    onChange={(location) => setFormData({ ...formData, location })}
                  />
                </CardContent>
              </Card>

              {/* Colores */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.colors")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("cardForm.backgroundColor")}</label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          name="background_color"
                          value={formData.background_color}
                          onChange={handleChange}
                          className="h-10 w-20"
                        />
                        <Input
                          type="text"
                          name="background_color"
                          value={formData.background_color}
                          onChange={handleChange}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("cardForm.textColor")}</label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          name="text_color"
                          value={formData.text_color}
                          onChange={handleChange}
                          className="h-10 w-20"
                        />
                        <Input
                          type="text"
                          name="text_color"
                          value={formData.text_color}
                          onChange={handleChange}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Privacidad */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.privacy")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_public"
                      checked={formData.is_public}
                      onChange={handleChange}
                      className="w-4 h-4 accent-primary"
                    />
                    <div>
                      <div className="font-medium">{t("cardForm.isPublic")}</div>
                      <div className="text-sm text-muted-foreground">{t("cardForm.isPublicDesc")}</div>
                    </div>
                  </label>
                </CardContent>
              </Card>

              {/* Visibilidad en Feed */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.feedVisibility")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="show_in_feed"
                      checked={formData.show_in_feed}
                      onChange={handleChange}
                      className="w-4 h-4 accent-primary"
                    />
                    <div>
                      <div className="font-medium">{t("cardForm.showInFeed")}</div>
                      <div className="text-sm text-muted-foreground">{t("cardForm.showInFeedDesc")}</div>
                    </div>
                  </label>
                </CardContent>
              </Card>

              {/* Animación */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t("cardForm.animation")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_animated"
                      checked={formData.is_animated}
                      onChange={handleChange}
                      className="w-4 h-4 accent-primary"
                    />
                    <div>
                      <div className="font-medium">{t("cardForm.isAnimated")}</div>
                      <div className="text-sm text-muted-foreground">{t("cardForm.isAnimatedDesc")}</div>
                    </div>
                  </label>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/dashboard")}
                >
                  {t("cardForm.cancel")}
                </Button>
                <Button type="submit" className="flex-1" disabled={loading || uploadingAvatar || uploadingBanner}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? t("cardForm.creating") : t("cardForm.create")}
                </Button>
              </div>
            </form>
          </div>

          {/* Preview */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{t("cardForm.preview")}</CardTitle>
                <CardDescription>{t("cardForm.previewDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`rounded-2xl shadow-lg relative overflow-hidden ${
                    formData.is_animated ? "card-bubble-animated" : "card-bubble-static"
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${formData.background_color}, ${formData.background_color}dd)`,
                    color: formData.text_color,
                  }}
                >
                  {/* Banner */}
                  {formData.banner_url && (
                    <div 
                      className="h-32 bg-cover bg-center"
                      style={{ backgroundImage: `url(${formData.banner_url})` }}
                    />
                  )}

                  <div className="p-8">
                    {/* Avatar */}
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt="Avatar"
                        className="w-24 h-24 rounded-full object-cover border-4 mb-4"
                        style={{ borderColor: formData.text_color }}
                      />
                    ) : (
                      <div
                        className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 border-4"
                        style={{
                          backgroundColor: `${formData.text_color}20`,
                          borderColor: formData.text_color
                        }}
                      >
                        {formData.title.charAt(0) || "?"}
                      </div>
                    )}

                    <h3 className="text-2xl font-bold mb-2">{formData.title || t("cardForm.title")}</h3>
                    {formData.subtitle && <p className="mb-4 opacity-90">{formData.subtitle}</p>}
                    {formData.description && (
                      <p className="text-sm opacity-75 mb-4">{formData.description}</p>
                    )}

                    {/* Social Links Preview */}
                    {formData.social_links.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {formData.social_links.map((link, index) => (
                          <div
                            key={index}
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${formData.text_color}20` }}
                          >
                            <span className="text-xs font-bold">
                              {link.type.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Curriculum Preview Badges */}
                    {formData.card_type === "curriculum" && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {formData.custom_fields.experience.length > 0 && (
                          <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: `${formData.text_color}20` }}>
                            {formData.custom_fields.experience.length} {t("curriculum.experience")}
                          </span>
                        )}
                        {formData.custom_fields.education.length > 0 && (
                          <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: `${formData.text_color}20` }}>
                            {formData.custom_fields.education.length} {t("curriculum.education")}
                          </span>
                        )}
                        {formData.custom_fields.skills.length > 0 && (
                          <span className="px-2 py-1 rounded-full text-xs" style={{ backgroundColor: `${formData.text_color}20` }}>
                            {formData.custom_fields.skills.length} {t("curriculum.skills")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Image Editor Modal */}
      {showImageEditor && tempImageUrl && (
        <ImageEditor
          imageUrl={tempImageUrl}
          onSave={handleImageEditorSave}
          onCancel={() => {
            setShowImageEditor(false);
            setTempImageUrl(null);
            setEditingImageType(null);
          }}
        />
      )}
    </div>
  );
};

export default CreateCardPage;
