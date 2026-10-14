"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, Modal } from "@/components/shared";
import {
  logAudit,
  removeAvatarFromStorage,
  technicianAuditSnapshot,
} from "@/lib/technicians";
import { toast } from "@/lib/toast";

/**
 * Exclui o técnico somente quando não existe histórico operacional ou financeiro.
 */
export function TechnicianDeleteModal({ target, me, supabase, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const contaId = me?.usuario?.conta_id;

  async function confirmDelete() {
    if (!target || !contaId) return;
    setDeleting(true);

    try {
      const [servicesCountResult, movementsCountResult] = await Promise.all([
        supabase
          .from("servicos_tecnicos")
          .select("id", { count: "exact", head: true })
          .eq("conta_id", contaId)
          .eq("tecnico_id", target.id),
        supabase
          .from("movimentacoes_financeiras")
          .select("id", { count: "exact", head: true })
          .eq("conta_id", contaId)
          .eq("tecnico_id", target.id),
      ]);

      if (servicesCountResult.error) throw servicesCountResult.error;
      if (movementsCountResult.error) throw movementsCountResult.error;

      const hasHistory =
        (servicesCountResult.count || 0) > 0 ||
        (movementsCountResult.count || 0) > 0;

      if (hasHistory) {
        toast.warning(
          "Técnico possui histórico",
          "Existem serviços ou movimentações vinculadas. Para preservar o histórico, edite o técnico e marque como inativo."
        );
        onClose?.();
        return;
      }

      const before = technicianAuditSnapshot(target);
      const avatarToDelete = target.foto_url;

      const { error: deleteError } = await supabase
        .from("tecnicos")
        .delete()
        .eq("id", target.id)
        .eq("conta_id", contaId);

      if (deleteError) throw deleteError;

      if (avatarToDelete) await removeAvatarFromStorage(supabase, avatarToDelete);

      await logAudit(supabase, me, {
        action: "excluir",
        recordId: target.id,
        description: `Técnico ${target.nome} excluído.`,
        before,
      });

      toast.success("Técnico excluído", "O cadastro foi removido com sucesso.");
      onDeleted?.(target);
    } catch (deleteError) {
      console.error("Excluir técnico", deleteError);
      toast.error("Não foi possível excluir", deleteError?.message || "Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={() => {
        if (!deleting) onClose?.();
      }}
      title="Excluir técnico"
      description="A exclusão é permitida apenas quando não existe histórico operacional ou financeiro."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="danger" loading={deleting} leftIcon={Trash2} onClick={confirmDelete}>
            Excluir técnico
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        Deseja realmente excluir{" "}
        <strong className="font-semibold text-foreground">{target?.nome}</strong>? Se já houver
        serviços ou repasses, o sistema preservará o cadastro e pedirá para inativá-lo.
      </p>
    </Modal>
  );
}
