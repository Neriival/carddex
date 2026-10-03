-- docs/supabase.sql
-- Cole TUDO no Supabase → SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (não apaga nada).

-- ============ CONTAS ============
-- Uma linha por conta (criada sozinha pelo gatilho abaixo).
-- nick e avatar aparecem para todos no ranking; e-mail e sexo só o dono e os admins veem.
create table if not exists public.perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text,
  email text,
  nick text check (nick ~ '^[A-Za-z0-9_.]{3,16}$'),
  sexo text check (sexo in ('masculino', 'feminino', 'nao_informar')),
  avatar text check (avatar in ('menino', 'menina')),
  criado_em timestamptz not null default now()
);
create unique index if not exists perfis_nick_unico on public.perfis (lower(nick));

-- Foto de perfil (opcional; sem foto, aparece o personagem). Só aceita foto guardada no Storage
-- deste projeto, na pasta da própria pessoa (troque o endereço se recriar o projeto).
alter table public.perfis add column if not exists foto text;
alter table public.perfis drop constraint if exists perfis_foto_check;
alter table public.perfis add constraint perfis_foto_check check (foto is null or
  foto like 'https://fqynjcaiwmeprxkzfwed.supabase.co/storage/v1/object/public/fotos/' || id::text || '/%');

-- Quem pode abrir o painel adm
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

-- ============ CARTAS MARCADAS ============
-- Uma linha por conta: tenho = { "me04": ["me04-001", ...], ... } (o mesmo formato do navegador)
create or replace function public.contar_cartas(j jsonb) returns integer
language sql immutable as $$
  select coalesce(sum(jsonb_array_length(value)), 0)::int from jsonb_each(coalesce(j, '{}'::jsonb)) where jsonb_typeof(value) = 'array';
$$;

create table if not exists public.colecoes (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  tenho jsonb not null default '{}'::jsonb check (jsonb_typeof(tenho) = 'object' and public.contar_cartas(tenho) <= 50000),
  total integer generated always as (public.contar_cartas(tenho)) stored,
  atualizado_em timestamptz not null default now()
);
create index if not exists colecoes_total on public.colecoes (total desc);

-- ============ PARCEIROS ============
-- Os 8 quadrados: e1..e4 (esquerda) e d1..d4 (direita)
create table if not exists public.parceiros (
  posicao text primary key check (posicao ~ '^[ed][1-4]$'),
  nome text not null,
  link text not null check (link ~* '^https?://'),
  imagem text not null check (imagem ~* '^https?://'),
  atualizado_em timestamptz not null default now()
);

-- Um clique = uma linha (o nome fica guardado para separar parceiros que passaram pelo mesmo quadrado)
create table if not exists public.cliques (
  id bigint generated always as identity primary key,
  posicao text not null,
  nome text not null,
  criado_em timestamptz not null default now()
);
create index if not exists cliques_data on public.cliques (criado_em);

-- ============ FUNÇÕES ============
-- true se quem está conectado é admin
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Cria o perfil quando alguém cria a conta (nick, sexo e avatar vêm do formulário de cadastro)
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, email, nick, sexo, avatar)
  values (new.id, new.raw_user_meta_data ->> 'nome', new.email,
          nullif(new.raw_user_meta_data ->> 'nick', ''), new.raw_user_meta_data ->> 'sexo', new.raw_user_meta_data ->> 'avatar')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_perfil();

-- Contas que já existiam antes deste script
insert into public.perfis (id, nome, email, criado_em)
  select id, raw_user_meta_data ->> 'nome', email, created_at from auth.users
  on conflict (id) do nothing;

-- O nick está livre? (usado no cadastro e ao trocar o nick)
create or replace function public.nick_disponivel(n text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.perfis where lower(nick) = lower(n) and id is distinct from auth.uid());
$$;

-- Ranking público: só nick, personagem/foto e total de cartas
drop function if exists public.ranking(integer);
create or replace function public.ranking(limite integer default 50)
returns table (posicao bigint, nick text, avatar text, foto text, total integer, eu boolean)
language sql stable security definer set search_path = public as $$
  select * from (
    select rank() over (order by c.total desc) as posicao, p.nick, p.avatar, p.foto, c.total, p.id = auth.uid() as eu
    from public.colecoes c join public.perfis p on p.id = c.user_id
    where c.total > 0 and p.nick is not null
  ) r
  where r.posicao <= least(limite, 200) or r.eu
  order by r.posicao, r.nick;
$$;

-- Registra o clique num parceiro (qualquer visitante)
create or replace function public.registrar_clique(p text) returns void
language sql security definer set search_path = public as $$
  insert into public.cliques (posicao, nome) select posicao, nome from public.parceiros where posicao = p;
$$;

-- PAINEL ADM: cliques por parceiro
create or replace function public.cliques_resumo()
returns table (posicao text, nome text, total bigint, mes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'sem permissão'; end if;
  return query select c.posicao, c.nome, count(*), count(*) filter (where c.criado_em > now() - interval '30 days')
    from public.cliques c group by c.posicao, c.nome order by 4 desc, 3 desc;
end $$;

-- PAINEL ADM: tira a foto de alguém (volta a aparecer o personagem)
create or replace function public.remover_foto(alvo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'sem permissão'; end if;
  update public.perfis set foto = null where id = alvo;
end $$;

-- PAINEL ADM: números gerais e coleções mais colecionadas
create or replace function public.admin_resumo() returns json
language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not public.eh_admin() then raise exception 'sem permissão'; end if;
  select json_build_object(
    'cartas', (select coalesce(sum(total), 0) from public.colecoes),
    'colecionadores', (select count(*) from public.colecoes where total > 0),
    'sexo', (select json_object_agg(coalesce(sexo, 'sem'), n) from (select sexo, count(*) n from public.perfis group by sexo) s),
    'top', (select coalesce(json_agg(t), '[]'::json) from (
      select e.key as colecao, count(*) as pessoas, sum(jsonb_array_length(e.value)) as cartas
      from public.colecoes c, jsonb_each(c.tenho) e
      where jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) > 0
      group by e.key order by 2 desc, 3 desc limit 10) t)
  ) into r;
  return r;
end $$;

grant execute on function public.nick_disponivel(text), public.ranking(integer), public.registrar_clique(text) to anon, authenticated;

-- ============ REGRAS DE ACESSO (RLS) ============
-- Permissões explícitas (funciona mesmo com "Automatically expose new tables" desligado).
-- Quem pode ver/mudar cada linha é decidido pelas regras (policies) logo abaixo.
grant usage on schema public to anon, authenticated;
grant select on public.parceiros to anon, authenticated;
grant insert, update, delete on public.parceiros to authenticated;
grant select on public.perfis, public.admins to authenticated;
grant select, insert, update on public.colecoes to authenticated;
grant execute on function public.eh_admin(), public.cliques_resumo(), public.admin_resumo(), public.remover_foto(uuid) to authenticated;

alter table public.perfis enable row level security;
alter table public.admins enable row level security;
alter table public.colecoes enable row level security;
alter table public.parceiros enable row level security;
alter table public.cliques enable row level security;

-- perfis: o dono e os admins leem; o dono só pode trocar nick, sexo e avatar
drop policy if exists "perfil: dono ou admin le" on public.perfis;
create policy "perfil: dono ou admin le" on public.perfis for select using (id = auth.uid() or public.eh_admin());
drop policy if exists "perfil: dono edita" on public.perfis;
create policy "perfil: dono edita" on public.perfis for update using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.perfis from anon, authenticated;
grant update (nick, sexo, avatar, foto) on public.perfis to authenticated;

drop policy if exists "admins: ve a propria linha" on public.admins;
create policy "admins: ve a propria linha" on public.admins for select using (user_id = auth.uid());

-- colecoes: cada um lê e grava só a sua
drop policy if exists "colecao: dono le" on public.colecoes;
create policy "colecao: dono le" on public.colecoes for select using (user_id = auth.uid());
drop policy if exists "colecao: dono cria" on public.colecoes;
create policy "colecao: dono cria" on public.colecoes for insert with check (user_id = auth.uid());
drop policy if exists "colecao: dono atualiza" on public.colecoes;
create policy "colecao: dono atualiza" on public.colecoes for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "parceiros: todos leem" on public.parceiros;
create policy "parceiros: todos leem" on public.parceiros for select using (true);
drop policy if exists "parceiros: admin edita" on public.parceiros;
create policy "parceiros: admin edita" on public.parceiros for all using (public.eh_admin()) with check (public.eh_admin());

-- cliques: ninguém lê direto (só pelas funções acima)
revoke all on public.cliques from anon, authenticated;

-- ============ IMAGENS DOS PARCEIROS (Storage) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('parceiros', 'parceiros', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;

-- (o site mostra as imagens pelo link público; listar/enviar/apagar exige ser admin)
drop policy if exists "parceiros: admin lista" on storage.objects;
create policy "parceiros: admin lista" on storage.objects for select using (bucket_id = 'parceiros' and public.eh_admin());
drop policy if exists "parceiros: admin envia" on storage.objects;
create policy "parceiros: admin envia" on storage.objects for insert with check (bucket_id = 'parceiros' and public.eh_admin());
drop policy if exists "parceiros: admin troca" on storage.objects;
create policy "parceiros: admin troca" on storage.objects for update using (bucket_id = 'parceiros' and public.eh_admin());
drop policy if exists "parceiros: admin apaga" on storage.objects;
create policy "parceiros: admin apaga" on storage.objects for delete using (bucket_id = 'parceiros' and public.eh_admin());

-- ============ FOTOS DE PERFIL (Storage) ============
-- Cada pessoa só mexe na própria pasta: fotos/<id da conta>/... ; admins podem apagar qualquer uma.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
  on conflict (id) do nothing;

drop policy if exists "fotos: dono lista" on storage.objects;
create policy "fotos: dono lista" on storage.objects for select using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));
drop policy if exists "fotos: dono envia" on storage.objects;
create policy "fotos: dono envia" on storage.objects for insert with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: dono troca" on storage.objects;
create policy "fotos: dono troca" on storage.objects for update using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: dono ou admin apaga" on storage.objects;
create policy "fotos: dono ou admin apaga" on storage.objects for delete using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

-- ============ VIRAR ADMIN ============
-- 1) Crie sua conta pelo próprio site (aba "Criar conta").
-- 2) Troque o e-mail abaixo pelo seu, tire os dois traços do começo da linha e rode só ela:
-- insert into public.admins (user_id) select id from auth.users where email = 'SEU_EMAIL_AQUI' on conflict do nothing;
