"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Field, FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/lib/actions/auth";
import { MIN_PASSWORD, changePasswordSchema } from "@/lib/validation/schemas";

type Values = z.input<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      toast.success("Contraseña cambiada");
      router.replace("/");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Contraseña actual" htmlFor="currentPassword" error={errors.currentPassword?.message}>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.currentPassword}
          {...register("currentPassword")}
        />
      </Field>
      <Field
        label="Contraseña nueva"
        htmlFor="newPassword"
        error={errors.newPassword?.message}
        hint={`Mínimo ${MIN_PASSWORD} caracteres. Una frase larga funciona muy bien.`}
      >
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...register("newPassword")}
        />
      </Field>
      <Field label="Repite la contraseña nueva" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
      </Field>
      <FormError message={serverError} />
      <Button type="submit" size="lg" disabled={pending}>
        <KeyRound />
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
