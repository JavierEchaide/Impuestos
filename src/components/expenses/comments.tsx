"use client";

import { Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { addCommentAction, deleteCommentAction } from "@/lib/actions/comments";
import { commentSchema } from "@/lib/validation/schemas";

export interface CommentView {
  id: string;
  body: string;
  authorName: string;
  authorColor: string;
  createdAtLabel: string;
  canDelete: boolean;
}

export function Comments({
  expenseId,
  comments,
  readOnly = false,
}: {
  expenseId: string;
  comments: CommentView[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = commentSchema.safeParse({ expenseId, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Comentario no válido");
      return;
    }
    startTransition(async () => {
      const result = await addCommentAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCommentAction({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <UserAvatar name={c.authorName} color={c.authorColor} size="sm" />
              <div className="min-w-0 flex-1 rounded-xl bg-secondary px-3 py-2">
                <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.authorName}</span>
                  <span>{c.createdAtLabel}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              {c.canDelete ? (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                  aria-label="Borrar comentario"
                  className="self-start rounded-md p-2 text-muted-foreground hover:bg-secondary"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {readOnly ? null : (
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un comentario…"
          maxLength={1000}
          aria-label="Nuevo comentario"
          className="min-h-16"
        />
        <FormError message={error} />
        <Button type="submit" disabled={pending || body.trim() === ""} className="self-end">
          <Send />
          Comentar
        </Button>
      </form>
      )}
    </div>
  );
}
