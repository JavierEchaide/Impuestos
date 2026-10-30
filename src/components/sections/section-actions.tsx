"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { setSectionArchivedAction, updateSectionAction } from "@/lib/actions/sections";
import { sectionUpdateSchema } from "@/lib/validation/schemas";

/** Renombrar y archivar/desarchivar una sección (solo quien la creó o el admin). */
export function SectionActions({
  id,
  name,
  description,
  archived,
}: {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameValue, setName] = useState(name);
  const [descValue, setDescription] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = sectionUpdateSchema.safeParse({ id, name: nameValue, description: descValue || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    startTransition(async () => {
      const result = await updateSectionAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Sección actualizada");
      setOpen(false);
      router.refresh();
    });
  }

  function toggleArchive() {
    startTransition(async () => {
      const result = await setSectionArchivedAction({ id, archived: !archived });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? "Sección desarchivada" : "Sección archivada");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Pencil />
            Editar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={save} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Editar sección</DialogTitle>
            </DialogHeader>
            <Field label="Nombre" htmlFor="edit-section-name">
              <Input id="edit-section-name" value={nameValue} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <Field label="Descripción" htmlFor="edit-section-desc">
              <Input id="edit-section-desc" value={descValue} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
            </Field>
            <FormError message={error} />
            <DialogFooter>
              <Button type="submit" size="lg" disabled={pending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Button type="button" variant="outline" size="sm" onClick={toggleArchive} disabled={pending}>
        {archived ? <ArchiveRestore /> : <Archive />}
        {archived ? "Desarchivar" : "Archivar"}
      </Button>
    </div>
  );
}
