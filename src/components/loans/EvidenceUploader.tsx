import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const EVIDENCE_CATEGORIES = ["DNI", "Comprobante", "Garantía", "Entrega de producto", "Otros"] as const;
export type EvidenceCategory = typeof EVIDENCE_CATEGORIES[number];

export interface PendingEvidence {
  id: string;
  file: File;
  previewUrl?: string;
  category?: EvidenceCategory;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

interface Props {
  evidences: PendingEvidence[];
  onChange: (evidences: PendingEvidence[]) => void;
}

export function EvidenceUploader({ evidences, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...evidences];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_FILES) {
        toast({ title: "Límite alcanzado", description: `Máximo ${MAX_FILES} archivos.`, variant: "destructive" });
        break;
      }
      if (!ACCEPTED.includes(file.type)) {
        toast({ title: "Tipo no permitido", description: `${file.name}: solo JPG, PNG o PDF.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast({ title: "Archivo muy grande", description: `${file.name} supera 5 MB.`, variant: "destructive" });
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      });
    }
    onChange(next);
  };

  const remove = (id: string) => {
    const target = evidences.find((e) => e.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(evidences.filter((e) => e.id !== id));
  };

  const setCategory = (id: string, category: EvidenceCategory) => {
    onChange(evidences.map((e) => (e.id === id ? { ...e, category: e.category === category ? undefined : category } : e)));
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`w-full rounded-xl border-2 border-dashed p-5 flex flex-col items-center gap-2 transition-colors ${
          dragOver ? "border-primary bg-primary/10" : "border-muted bg-muted/20 hover:border-primary/50"
        }`}
      >
        <Upload className="w-5 h-5 text-primary" />
        <p className="text-sm font-medium">Agregar archivos</p>
        <p className="text-[11px] text-muted-foreground text-center">
          JPG, PNG o PDF · máx 5 MB · hasta {MAX_FILES} archivos
        </p>
      </button>

      <AnimatePresence initial={false}>
        {evidences.map((ev) => (
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-xl border border-border bg-muted/20 p-3 space-y-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {ev.previewUrl ? (
                  <img src={ev.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : ev.file.type === "application/pdf" ? (
                  <FileText className="w-5 h-5 text-primary" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{ev.file.name}</p>
                <p className="text-[11px] text-muted-foreground">{(ev.file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => remove(ev.id)}
                className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Eliminar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {EVIDENCE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(ev.id, cat)}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-all ${
                    ev.category === cat
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {evidences.length > 0 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Paperclip className="w-3 h-3" />
          {evidences.length} archivo{evidences.length === 1 ? "" : "s"} listo{evidences.length === 1 ? "" : "s"} para subir
        </p>
      )}
    </div>
  );
}
