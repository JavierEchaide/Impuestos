"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createSectionAction } from "@/lib/actions/sections";
import { sectionSchema } from "@/lib/validation/schemas";

export function CreateSectionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = sectionSchema.safeParse({ name, description: description || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos no válidos");
      return;
    }
    startTransition(async () => {
      const result = await createSectionAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Sección creada");
      setOpen(false);
      setName("");
      setDescription("");
      router.push(`/secciones/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus />
          Nueva sección
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Nueva sección</DialogTitle>
            <DialogDescription>
              Una sección es una cuenta con nombre dentro del grupo: «Piso», «Viaje a Lisboa», «Arepas casa Javi»…
              Cada una lleva sus propios saldos.
            </DialogDescription>
          </DialogHeader>
          <Field label="Nombre" htmlFor="section-name">
            <Input id="section-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          </Field>
          <Field label="Descripción (opcional)" htmlFor="section-desc">
            <Input
              id="section-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Creando…" : "Crear sección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
