"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  CurrencyInput,
  DateInput,
  Drawer,
  Form,
  FormField,
  FormGrid,
  FormSection,
  Input,
  Modal,
  MultiSelect,
  RadioGroup,
  SearchableSelect,
  Switch,
  Table,
  Textarea,
} from "./index";

const offices = [
  { value: "1", label: "MARCHESINA", description: "Milano" },
  { value: "2", label: "SEFCAR", description: "Bergamo" },
];

const technicians = [
  { value: "mateus", label: "Mateus" },
  { value: "charles", label: "Charles" },
  { value: "augusto", label: "Augusto" },
];

const rows = [
  { id: "1", date: "26/08/2026", office: "MARCHESINA", vehicle: "Renault Captur", plate: "HC287KC", value: 500 },
  { id: "2", date: "25/08/2026", office: "SEFCAR", vehicle: "Fiat 500", plate: "AB123CD", value: 350 },
];

export default function SharedComponentsExample() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [office, setOffice] = useState("");
  const [techs, setTechs] = useState([]);
  const [active, setActive] = useState(true);
  const [selected, setSelected] = useState([]);
  const [amount, setAmount] = useState(500);

  const columns = [
    { key: "date", header: "Data", sortable: true },
    { key: "office", header: "Oficina", sortable: true },
    {
      key: "vehicle",
      header: "Veículo",
      render: (_, row) => (
        <div>
          <p className="font-medium text-foreground">{row.vehicle}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.plate}</p>
        </div>
      ),
    },
    {
      key: "value",
      header: "Valor",
      align: "right",
      sortable: true,
      render: (value) => (
        <span className="font-semibold text-foreground">
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(value)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      sortable: false,
      searchable: false,
      render: () => (
        <Button variant="ghost" size="iconSm" aria-label="Excluir">
          <Trash2 className="size-4 text-danger" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap gap-2">
        <Button leftIcon={Plus} onClick={() => setDrawerOpen(true)}>Novo serviço</Button>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>Abrir modal</Button>
      </div>

      <Table
        data={rows}
        columns={columns}
        searchable
        searchKeys={["office", "vehicle", "plate"]}
        selectable
        selectedRows={selected}
        onSelectionChange={setSelected}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirmar exclusão"
        description="Essa ação não poderá ser desfeita."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="danger">Excluir</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Confirme somente depois de validar os registros financeiros vinculados.
        </p>
      </Modal>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Novo serviço"
        description="Cadastre o atendimento e os técnicos responsáveis."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button leftIcon={Save}>Salvar serviço</Button>
          </>
        }
      >
        <Form onSubmit={(event) => event.preventDefault()}>
          <FormSection title="Dados do serviço">
            <FormGrid>
              <FormField label="Oficina" required>
                <SearchableSelect value={office} onChange={setOffice} options={offices} placeholder="Selecione a oficina" />
              </FormField>
              <FormField label="Data" required>
                <DateInput defaultValue="2026-08-26" />
              </FormField>
              <FormField label="Placa" required>
                <Input placeholder="HC287KC" />
              </FormField>
              <FormField label="Valor" required>
                <CurrencyInput value={amount} onValueChange={setAmount} currency="EUR" locale="pt-BR" />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Equipe">
            <FormField label="Técnicos" required>
              <MultiSelect value={techs} onChange={setTechs} options={technicians} placeholder="Selecione um ou mais técnicos" />
            </FormField>
          </FormSection>

          <FormSection title="Outros exemplos">
            <FormGrid>
              <FormField label="Status">
                <Switch checked={active} onCheckedChange={setActive} label="Ativo" description="Disponível para novos registros" />
              </FormField>
              <FormField label="Tipo de pagamento">
                <RadioGroup value="pix" onChange={() => {}} options={[{ value: "pix", label: "PIX" }, { value: "transfer", label: "Transferência" }]} />
              </FormField>
            </FormGrid>
            <Checkbox label="Confirmo os dados informados" />
            <FormField label="Observações">
              <Textarea placeholder="Informações adicionais..." />
            </FormField>
          </FormSection>
        </Form>
      </Drawer>
    </div>
  );
}
