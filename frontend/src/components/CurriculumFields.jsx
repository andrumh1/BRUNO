import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BubbleSelect from "@/components/BubbleSelect";
import {
  Plus,
  Trash2,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  FileText,
  Users,
} from "lucide-react";

const CurriculumFields = ({ formData, setFormData, addCurriculumItem, updateCurriculumItem, removeCurriculumItem }) => {
  const { t } = useLanguage();

  if (formData.card_type !== "curriculum") return null;

  return (
    <>
      {/* Experiencia Laboral */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              <CardTitle>{t("curriculum.experience")}</CardTitle>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => addCurriculumItem("experience")}>
              <Plus className="w-4 h-4 mr-1" /> {t("curriculum.addExperience")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.custom_fields.experience.map((exp, index) => (
            <div key={exp._key || `exp-${index}`} className="p-4 border border-border rounded-lg space-y-3 relative">
              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeCurriculumItem("experience", index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("curriculum.company")} value={exp.company} onChange={(e) => updateCurriculumItem("experience", index, "company", e.target.value)} />
                <Input placeholder={t("curriculum.position")} value={exp.position} onChange={(e) => updateCurriculumItem("experience", index, "position", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" placeholder={t("curriculum.startDate")} value={exp.startDate} onChange={(e) => updateCurriculumItem("experience", index, "startDate", e.target.value)} />
                <Input type="date" placeholder={t("curriculum.endDate")} value={exp.endDate} onChange={(e) => updateCurriculumItem("experience", index, "endDate", e.target.value)} disabled={exp.current} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={exp.current} onChange={(e) => updateCurriculumItem("experience", index, "current", e.target.checked)} className="rounded" />
                {t("curriculum.currentPosition")}
              </label>
              <textarea placeholder={t("curriculum.description")} value={exp.description} onChange={(e) => updateCurriculumItem("experience", index, "description", e.target.value)} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          ))}
          {formData.custom_fields.experience.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("curriculum.addExperience")} para comenzar</p>
          )}
        </CardContent>
      </Card>

      {/* Educacion */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              <CardTitle>{t("curriculum.education")}</CardTitle>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => addCurriculumItem("education")}>
              <Plus className="w-4 h-4 mr-1" /> {t("curriculum.addEducation")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.custom_fields.education.map((edu, index) => (
            <div key={edu._key || `edu-${index}`} className="p-4 border border-border rounded-lg space-y-3 relative">
              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeCurriculumItem("education", index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("curriculum.institution")} value={edu.institution} onChange={(e) => updateCurriculumItem("education", index, "institution", e.target.value)} />
                <Input placeholder={t("curriculum.degree")} value={edu.degree} onChange={(e) => updateCurriculumItem("education", index, "degree", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={edu.startDate} onChange={(e) => updateCurriculumItem("education", index, "startDate", e.target.value)} />
                <Input type="date" value={edu.endDate} onChange={(e) => updateCurriculumItem("education", index, "endDate", e.target.value)} />
              </div>
              <textarea placeholder={t("curriculum.description")} value={edu.description} onChange={(e) => updateCurriculumItem("education", index, "description", e.target.value)} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          ))}
          {formData.custom_fields.education.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("curriculum.addEducation")} para comenzar</p>
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
            <Button type="button" variant="outline" size="sm" onClick={() => addCurriculumItem("skills")}>
              <Plus className="w-4 h-4 mr-1" /> {t("curriculum.addSkill")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.custom_fields.skills.map((skill, index) => (
            <div key={skill._key || `skill-${index}`} className="flex items-center gap-3">
              <Input placeholder={t("curriculum.skillName")} value={skill.name} onChange={(e) => updateCurriculumItem("skills", index, "name", e.target.value)} className="flex-1" />
              <input type="range" min="0" max="100" value={skill.level} onChange={(e) => updateCurriculumItem("skills", index, "level", parseInt(e.target.value))} className="w-24 sm:w-32" />
              <span className="text-xs w-8 text-right">{skill.level}%</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeCurriculumItem("skills", index)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
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
            <Button type="button" variant="outline" size="sm" onClick={() => addCurriculumItem("languages")}>
              <Plus className="w-4 h-4 mr-1" /> {t("curriculum.addLanguage")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.custom_fields.languages.map((lang, index) => (
            <div key={lang._key || `lang-${index}`} className="flex items-center gap-3">
              <Input placeholder={t("curriculum.languageName")} value={lang.name} onChange={(e) => updateCurriculumItem("languages", index, "name", e.target.value)} className="flex-1" />
              <BubbleSelect
                value={lang.level}
                onChange={(value) => updateCurriculumItem("languages", index, "level", value)}
                options={[
                  { value: "native", label: t("curriculum.levels.native") },
                  { value: "advanced", label: t("curriculum.levels.advanced") },
                  { value: "intermediate", label: t("curriculum.levels.intermediate") },
                  { value: "basic", label: t("curriculum.levels.basic") },
                ]}
                placeholder={t("curriculum.level")}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeCurriculumItem("languages", index)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
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
            <Button type="button" variant="outline" size="sm" onClick={() => addCurriculumItem("documents")}>
              <Plus className="w-4 h-4 mr-1" /> {t("curriculum.addDocument")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.custom_fields.documents.map((doc, index) => (
            <div key={doc._key || `doc-${index}`} className="flex items-center gap-3">
              <Input placeholder={t("curriculum.documentName")} value={doc.name} onChange={(e) => updateCurriculumItem("documents", index, "name", e.target.value)} className="flex-1" />
              <Input placeholder={t("curriculum.documentUrl")} value={doc.url} onChange={(e) => updateCurriculumItem("documents", index, "url", e.target.value)} className="flex-1" />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeCurriculumItem("documents", index)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Referencias */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>{t("curriculum.references")}</CardTitle>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => addCurriculumItem("references")}>
              <Plus className="w-4 h-4 mr-1" /> {t("curriculum.addReference")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.custom_fields.references.map((ref, index) => (
            <div key={ref._key || `ref-${index}`} className="p-4 border border-border rounded-lg space-y-3 relative">
              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeCurriculumItem("references", index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("curriculum.referenceName")} value={ref.name} onChange={(e) => updateCurriculumItem("references", index, "name", e.target.value)} />
                <Input placeholder={t("curriculum.referencePosition")} value={ref.position} onChange={(e) => updateCurriculumItem("references", index, "position", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("curriculum.referenceCompany")} value={ref.company} onChange={(e) => updateCurriculumItem("references", index, "company", e.target.value)} />
                <Input placeholder={t("curriculum.referenceRelationship")} value={ref.relationship} onChange={(e) => updateCurriculumItem("references", index, "relationship", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("curriculum.referencePhone")} value={ref.phone} onChange={(e) => updateCurriculumItem("references", index, "phone", e.target.value)} />
                <Input placeholder={t("curriculum.referenceEmail")} value={ref.email} onChange={(e) => updateCurriculumItem("references", index, "email", e.target.value)} />
              </div>
            </div>
          ))}
          {formData.custom_fields.references.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("curriculum.addReference")} para comenzar</p>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export { CurriculumFields };
