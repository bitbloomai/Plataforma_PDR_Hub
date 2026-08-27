# Shared Components

Componentes alinhados ao visual do Dashboard atual e aos tokens do `globals.css`.

## Estrutura sugerida no projeto

```text
src/
  components/
    shared/
      Button.jsx
      Portal.jsx
      overlay-hooks.js
      Modal.jsx
      Drawer.jsx
      Form.jsx
      Table.jsx
      utils.js
      index.js
```

## Dependência

Os componentes usam apenas React + `lucide-react`, que já aparece no Dashboard.

```bash
npm i lucide-react
```

## Importação

```jsx
import {
  Button,
  Modal,
  Drawer,
  Form,
  FormField,
  SearchableSelect,
  MultiSelect,
  Switch,
  Checkbox,
  Table,
} from "@/components/shared";
```

## Modal e Drawer

Ambos:

- usam `createPortal(..., document.body)`;
- bloqueiam scroll do body enquanto abertos;
- fecham com `Escape` por padrão;
- restauram foco ao elemento anterior;
- fazem trap básico de foco;
- aceitam `footer` pronto para ações.

O `Drawer` é sempre um bottom-sheet: entra de baixo da viewport e suporta conteúdo rolável.

## Form

O arquivo `Form.jsx` exporta:

- `Form`
- `FormGrid`
- `FormSection`
- `FormField`
- `Input`
- `DateInput`
- `Textarea`
- `Select`
- `CurrencyInput`
- `SearchableSelect`
- `MultiSelect`
- `Switch`
- `Checkbox`
- `RadioGroup`

`CurrencyInput` recebe `currency` e `locale` por props. Nada fica fixo em EUR ou pt-BR.

## Table

A `Table` suporta:

- busca local;
- busca controlada;
- ordenação asc/desc;
- paginação;
- paginação controlada/server-side;
- seleção de linhas;
- loading skeleton;
- empty state;
- toolbar;
- cabeçalho sticky;
- render customizado por coluna;
- alinhamento por coluna;
- nested accessor (`oficina.nome`);
- modo compacto.

### Exemplo de coluna

```jsx
const columns = [
  { key: "data_servico", header: "Data", sortable: true },
  { key: "oficina", header: "Oficina", accessor: "oficina.nome" },
  {
    key: "valor",
    header: "Valor",
    align: "right",
    render: (value) => formatMoney(value),
  },
];
```

Veja `Example.jsx` para um exemplo de uso integrado.
