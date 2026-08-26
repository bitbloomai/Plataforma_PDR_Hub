create table if not exists public.contas (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    nome_fantasia text,
    foto_url text,
    email text,
    telefone text,
    documento text,
    endereco text,
    cidade text,
    estado_regiao text,
    cep text,
    pais text,
    ativo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.usuarios (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    nome text not null,
    email text not null,
    foto_url text,
    ativo boolean not null default true,
    ultimo_acesso timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.configuracoes (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null unique references public.contas(id) on delete cascade,
    moeda text not null default 'EUR',
    locale text not null default 'pt-BR',
    timezone text not null default 'Europe/Rome',
    formato_data text not null default 'DD/MM/YYYY',
    nome_sistema text default 'Gestão de Serviços',
    dias_vencimento_servico integer default 0,
    observacoes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.oficinas (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    nome text not null,
    responsavel text,
    email text,
    telefone text,
    endereco text,
    cidade text,
    estado_regiao text,
    cep text,
    pais text,
    observacoes text,
    ativo boolean not null default true,
    created_by uuid references public.usuarios(id) on delete set null,
    updated_by uuid references public.usuarios(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.tecnicos (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    nome text not null,
    email text,
    telefone text,
    documento text,
    dados_pagamento text,
    foto_url text,
    observacoes text,
    ativo boolean not null default true,
    created_by uuid references public.usuarios(id) on delete set null,
    updated_by uuid references public.usuarios(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.veiculos (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    placa text not null,
    marca text,
    modelo text,
    ano integer,
    cor text,
    chassi text,
    observacoes text,
    created_by uuid references public.usuarios(id) on delete set null,
    updated_by uuid references public.usuarios(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (conta_id, placa)
);


create table if not exists public.servicos (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    oficina_id uuid not null references public.oficinas(id),
    veiculo_id uuid not null references public.veiculos(id),
    data_servico date not null,
    valor numeric(14,2) not null,
    descricao text,
    observacoes text,
    created_by uuid references public.usuarios(id) on delete set null,
    updated_by uuid references public.usuarios(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.servicos_tecnicos (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    servico_id uuid not null references public.servicos(id) on delete cascade,
    tecnico_id uuid not null references public.tecnicos(id),
    percentual numeric(7,4) not null,
    valor_repasse numeric(14,2) not null,
    created_by uuid references public.usuarios(id) on delete set null,
    created_at timestamptz not null default now(),
    unique (servico_id, tecnico_id)
);


create table if not exists public.categorias_financeiras (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    nome text not null,
    tipo text not null,
    grupo_dre text,
    ativo boolean not null default true,
    created_by uuid references public.usuarios(id) on delete set null,
    updated_by uuid references public.usuarios(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (conta_id, tipo, nome)
);


create table if not exists public.movimentacoes_financeiras (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    categoria_id uuid references public.categorias_financeiras(id) on delete set null,
    servico_id uuid references public.servicos(id) on delete cascade,
    tecnico_id uuid references public.tecnicos(id) on delete set null,
    oficina_id uuid references public.oficinas(id) on delete set null,

    tipo text not null,
    origem text not null,
    descricao text not null,

    valor numeric(14,2) not null,

    status text not null default 'pendente',

    data_competencia date not null,
    data_vencimento date,
    data_pagamento date,

    forma_pagamento text,
    observacoes text,

    created_by uuid references public.usuarios(id) on delete set null,
    updated_by uuid references public.usuarios(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


create table if not exists public.auditoria (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references public.contas(id) on delete cascade,
    usuario_id uuid references public.usuarios(id) on delete set null,

    entidade text not null,
    acao text not null,
    registro_id uuid,

    descricao text,

    dados_anteriores jsonb,
    dados_novos jsonb,

    ip text,
    user_agent text,

    created_at timestamptz not null default now()
);


create index if not exists idx_usuarios_conta
on public.usuarios(conta_id);


create index if not exists idx_oficinas_conta
on public.oficinas(conta_id);


create index if not exists idx_tecnicos_conta
on public.tecnicos(conta_id);


create index if not exists idx_veiculos_conta
on public.veiculos(conta_id);


create index if not exists idx_veiculos_placa
on public.veiculos(conta_id, placa);


create index if not exists idx_servicos_conta_data
on public.servicos(conta_id, data_servico);


create index if not exists idx_servicos_oficina
on public.servicos(oficina_id);


create index if not exists idx_servicos_veiculo
on public.servicos(veiculo_id);


create index if not exists idx_servicos_tecnicos_servico
on public.servicos_tecnicos(servico_id);


create index if not exists idx_servicos_tecnicos_tecnico
on public.servicos_tecnicos(tecnico_id);


create index if not exists idx_financeiro_conta_data
on public.movimentacoes_financeiras(conta_id, data_competencia);


create index if not exists idx_financeiro_status
on public.movimentacoes_financeiras(conta_id, status);


create index if not exists idx_financeiro_servico
on public.movimentacoes_financeiras(servico_id);


create index if not exists idx_financeiro_tecnico
on public.movimentacoes_financeiras(tecnico_id);


create index if not exists idx_auditoria_conta_data
on public.auditoria(conta_id, created_at);


create index if not exists idx_auditoria_usuario
on public.auditoria(usuario_id);


create unique index if not exists idx_financeiro_receita_servico_unica
on public.movimentacoes_financeiras(servico_id)
where origem = 'servico'
and servico_id is not null;


create unique index if not exists idx_financeiro_repasse_tecnico_unico
on public.movimentacoes_financeiras(servico_id, tecnico_id)
where origem = 'repasse_tecnico'
and servico_id is not null
and tecnico_id is not null;


insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'perfis',
    'perfis',
    true,
    5242880,
    array[
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
on conflict (id) do update
set
    name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;