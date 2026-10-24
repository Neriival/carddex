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

-- Personagem: um treinador do anime (assets/img/avatares/treinadores/<nome>.webp).
-- O banco só confere o formato; o site mostra o Ash se o nome não existir.
alter table public.perfis drop constraint if exists perfis_avatar_check;
alter table public.perfis add constraint perfis_avatar_check check (avatar ~ '^[a-z]{3,16}$');
-- Os personagens antigos (menino e menina) saíram do site em 24/10/2026: viram Ash e Misty
update public.perfis set avatar = case avatar when 'menina' then 'misty' else 'ash' end where avatar in ('menino', 'menina');

-- Banner do perfil: um dos banners de tipo do site (ex.: "fogo", em assets/img/banners/) ou uma imagem
-- da própria pessoa no Storage (pasta banners/<id da conta>/). Sem banner, o perfil usa o fundo padrão.
alter table public.perfis add column if not exists banner text;
alter table public.perfis drop constraint if exists perfis_banner_check;
alter table public.perfis add constraint perfis_banner_check check (banner is null or banner ~ '^[a-z]{3,12}$' or
  banner like 'https://fqynjcaiwmeprxkzfwed.supabase.co/storage/v1/object/public/banners/' || id::text || '/%');

-- Vitrine: até 10 cartas escolhidas para o perfil público. [{ "c": "me01", "k": "me01-001" }, ...]
alter table public.perfis add column if not exists vitrine jsonb not null default '[]'::jsonb;
-- Quem pode ver a coleção completa (cartas e repetidas): todos | amigos | ninguem. Começa fechada.
alter table public.perfis add column if not exists privacidade text not null default 'ninguem'
  check (privacidade in ('todos', 'amigos', 'ninguem'));
-- colecao_publica é o jeito antigo (só sim/não). Fica igual a privacidade = 'todos' para o site antigo
-- (aberto no celular de alguém) continuar funcionando; pode ser apagada no futuro.
alter table public.perfis add column if not exists colecao_publica boolean not null default false;
update public.perfis set privacidade = 'todos' where colecao_publica and privacidade = 'ninguem';

create or replace function public.sincronizar_privacidade() returns trigger
language plpgsql as $$
begin
  if new.privacidade is distinct from old.privacidade then
    new.colecao_publica := new.privacidade = 'todos';
  elsif new.colecao_publica is distinct from old.colecao_publica then  -- veio do site antigo
    new.privacidade := case when new.colecao_publica then 'todos' else 'ninguem' end;
  end if;
  return new;
end $$;

drop trigger if exists antes_de_mudar_privacidade on public.perfis;
create trigger antes_de_mudar_privacidade before update of privacidade, colecao_publica on public.perfis
  for each row execute function public.sincronizar_privacidade();

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
-- Repetidas: quantas cópias a mais de cada carta = { "me04": { "me04-001": 2 }, ... }
alter table public.colecoes add column if not exists repetidas jsonb not null default '{}'::jsonb;
alter table public.colecoes drop constraint if exists colecoes_repetidas_check;
alter table public.colecoes add constraint colecoes_repetidas_check check (jsonb_typeof(repetidas) = 'object' and pg_column_size(repetidas) < 500000);

-- ============ AMIGOS ============
-- Um pedido de amizade = uma linha (de quem pediu, para quem). aceita = true quando o outro aceitou.
-- Ninguém lê nem grava direto: tudo passa pelas funções pedir_amizade, responder_amizade, remover_amizade e meus_amigos.
create table if not exists public.amizades (
  de uuid not null references auth.users on delete cascade,
  para uuid not null references auth.users on delete cascade,
  aceita boolean not null default false,
  criado_em timestamptz not null default now(),
  primary key (de, para),
  check (de <> para)
);
-- um só pedido por dupla (A→B ou B→A)
create unique index if not exists amizades_dupla on public.amizades (least(de, para), greatest(de, para));
create index if not exists amizades_para on public.amizades (para);

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

-- A vitrine só aceita até 10 cartas, sem repetir, e só cartas que a pessoa marcou como "tenho"
create or replace function public.validar_vitrine() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb; t jsonb;
begin
  if new.vitrine is not distinct from old.vitrine then return new; end if;
  if jsonb_typeof(new.vitrine) <> 'array' or jsonb_array_length(new.vitrine) > 10 then
    raise exception 'vitrine: no máximo 10 cartas';
  end if;
  if (select count(distinct x) from jsonb_array_elements(new.vitrine) x) <> jsonb_array_length(new.vitrine) then
    raise exception 'vitrine: carta repetida';
  end if;
  select tenho into t from public.colecoes where user_id = new.id;
  for v in select x from jsonb_array_elements(new.vitrine) x loop
    if coalesce(jsonb_typeof(v -> 'c'), '') <> 'string' or coalesce(jsonb_typeof(v -> 'k'), '') <> 'string'
       or not coalesce(t -> (v ->> 'c'), '[]'::jsonb) ? (v ->> 'k') then
      raise exception 'vitrine: só cartas que você marcou como tenho';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists antes_de_mudar_vitrine on public.perfis;
create trigger antes_de_mudar_vitrine before update of vitrine on public.perfis
  for each row execute function public.validar_vitrine();

-- O nick está livre? (usado no cadastro e ao trocar o nick)
create or replace function public.nick_disponivel(n text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.perfis where lower(nick) = lower(n) and id is distinct from auth.uid());
$$;

-- Contas de admin ficam fora do ranking e não têm perfil público (só o próprio admin vê o dele)
create or replace function public.conta_admin(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = u);
$$;
revoke execute on function public.conta_admin(uuid) from public, anon, authenticated;  -- só as funções do banco usam

-- Ranking público: só nick, personagem/foto e total de cartas (sem os admins)
drop function if exists public.ranking(integer);
create or replace function public.ranking(limite integer default 50)
returns table (posicao bigint, nick text, avatar text, foto text, total integer, eu boolean)
language sql stable security definer set search_path = public as $$
  select * from (
    select rank() over (order by c.total desc) as posicao, p.nick, p.avatar, p.foto, c.total, p.id = auth.uid() as eu
    from public.colecoes c join public.perfis p on p.id = c.user_id
    where c.total > 0 and p.nick is not null and not public.conta_admin(p.id)
  ) r
  where r.posicao <= least(limite, 200) or r.eu
  order by r.posicao, r.nick;
$$;

-- true se a e b são amigos (pedido aceito)
create or replace function public.sao_amigos(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.amizades where aceita and ((de = a and para = b) or (de = b and para = a)));
$$;
revoke execute on function public.sao_amigos(uuid, uuid) from public, anon, authenticated;  -- só as funções do banco usam

-- true se quem está conectado pode ver a coleção do dono (pela privacidade que o dono escolheu)
create or replace function public.pode_ver_colecao(dono uuid, privacidade text) returns boolean
language sql stable security definer set search_path = public as $$
  select dono = auth.uid() or privacidade = 'todos' or (privacidade = 'amigos' and public.sao_amigos(dono, auth.uid()));
$$;
revoke execute on function public.pode_ver_colecao(uuid, text) from public, anon, authenticated;

-- Situação da amizade entre quem está conectado e o dono: amigo | enviado | recebido | null
create or replace function public.amizade_com(dono uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when a.aceita then 'amigo' when a.de = auth.uid() then 'enviado' else 'recebido' end
  from public.amizades a where (a.de = auth.uid() and a.para = dono) or (a.de = dono and a.para = auth.uid());
$$;
revoke execute on function public.amizade_com(uuid) from public, anon, authenticated;

-- Perfil público (qualquer visitante): nick, personagem/foto, banner, total, posição no ranking, vitrine,
-- número de amigos, se quem está vendo pode abrir a coleção (pode_ver) e a amizade com quem está vendo.
-- Nunca devolve e-mail nem sexo; a privacidade escolhida só vai para o próprio dono.
-- Cartas que a pessoa desmarcou depois somem da vitrine. Admin: só ele mesmo vê (com "admin": true).
create or replace function public.perfil_publico(n text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nick', p.nick, 'avatar', p.avatar, 'foto', p.foto, 'banner', p.banner,
    'total', coalesce(c.total, 0),
    'posicao', case when coalesce(c.total, 0) > 0 and not public.conta_admin(p.id) then (
      select count(*) + 1 from public.colecoes c2 join public.perfis p2 on p2.id = c2.user_id
      where p2.nick is not null and c2.total > c.total and not public.conta_admin(p2.id)) end,
    'vitrine', coalesce((
      select json_agg(v.x order by v.i) from jsonb_array_elements(p.vitrine) with ordinality as v(x, i)
      where coalesce(c.tenho -> (v.x ->> 'c'), '[]'::jsonb) ? (v.x ->> 'k')), '[]'::json),
    'pode_ver', public.pode_ver_colecao(p.id, p.privacidade),
    'colecao_publica', public.pode_ver_colecao(p.id, p.privacidade),  -- nome antigo (site antigo)
    'privacidade', case when p.id = auth.uid() then p.privacidade end,
    'amizade', public.amizade_com(p.id),
    'amigos', (select count(*) from public.amizades a where a.aceita and p.id in (a.de, a.para)),
    'admin', public.conta_admin(p.id),
    'eu', p.id = auth.uid())
  from public.perfis p left join public.colecoes c on c.user_id = p.id
  where p.nick is not null and lower(p.nick) = lower(n)
    and (not public.conta_admin(p.id) or p.id = auth.uid());
$$;

-- Coleção de outra pessoa (só se a privacidade dela deixar): cartas marcadas e repetidas
create or replace function public.colecao_de(n text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('nick', p.nick, 'avatar', p.avatar, 'foto', p.foto,
    'tenho', coalesce(c.tenho, '{}'::jsonb), 'repetidas', coalesce(c.repetidas, '{}'::jsonb))
  from public.perfis p left join public.colecoes c on c.user_id = p.id
  where p.nick is not null and lower(p.nick) = lower(n)
    and public.pode_ver_colecao(p.id, p.privacidade) and (not public.conta_admin(p.id) or p.id = auth.uid());
$$;

-- AMIGOS: acha a conta pelo nick (sem admins); erro se não existir ou se for a própria pessoa
create or replace function public.conta_do_nick(n text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare alvo uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para ter amigos.'; end if;
  select id into alvo from public.perfis where nick is not null and lower(nick) = lower(n) and not public.conta_admin(id);
  if alvo is null then raise exception 'Não encontramos o colecionador "%".', n; end if;
  if alvo = auth.uid() then raise exception 'Esse é o seu próprio nick.'; end if;
  return alvo;
end $$;
revoke execute on function public.conta_do_nick(text) from public, anon, authenticated;

-- AMIGOS: manda um pedido. Se o outro já tinha pedido, vira amizade na hora. Devolve 'enviado' ou 'amigo'.
create or replace function public.pedir_amizade(n text) returns text
language plpgsql security definer set search_path = public as $$
declare alvo uuid := public.conta_do_nick(n); eu uuid := auth.uid();
begin
  if public.conta_admin(eu) then raise exception 'Contas de administrador não usam amigos.'; end if;
  if (select nick from public.perfis where id = eu) is null then raise exception 'Escolha seu nick antes de adicionar amigos.'; end if;
  if exists (select 1 from public.amizades where de = alvo and para = eu) then
    update public.amizades set aceita = true where de = alvo and para = eu;
    return 'amigo';
  end if;
  if exists (select 1 from public.amizades where de = eu and para = alvo) then
    return (select case when aceita then 'amigo' else 'enviado' end from public.amizades where de = eu and para = alvo);
  end if;
  if (select count(*) from public.amizades where de = eu and not aceita) >= 50 then
    raise exception 'Você tem muitos pedidos esperando resposta. Espere alguns serem aceitos.';
  end if;
  if (select count(*) from public.amizades where aceita and eu in (de, para)) >= 500 then
    raise exception 'Você chegou ao limite de 500 amigos.';
  end if;
  insert into public.amizades (de, para) values (eu, alvo);
  return 'enviado';
end $$;

-- AMIGOS: aceita (true) ou recusa (false) um pedido recebido
create or replace function public.responder_amizade(n text, aceitar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare alvo uuid := public.conta_do_nick(n);
begin
  if aceitar then
    update public.amizades set aceita = true where de = alvo and para = auth.uid();
  else
    delete from public.amizades where de = alvo and para = auth.uid() and not aceita;
  end if;
end $$;

-- AMIGOS: desfaz a amizade ou cancela o pedido enviado
create or replace function public.remover_amizade(n text) returns void
language plpgsql security definer set search_path = public as $$
declare alvo uuid := public.conta_do_nick(n);
begin
  delete from public.amizades where (de = auth.uid() and para = alvo) or (de = alvo and para = auth.uid());
end $$;

-- AMIGOS: a lista de quem está conectado (amigos, pedidos recebidos e enviados), com personagem/foto e total
create or replace function public.meus_amigos()
returns table (nick text, avatar text, foto text, total integer, estado text)
language sql stable security definer set search_path = public as $$
  select p.nick, p.avatar, p.foto, coalesce(c.total, 0),
    case when a.aceita then 'amigo' when a.de = auth.uid() then 'enviado' else 'recebido' end
  from public.amizades a
  join public.perfis p on p.id = case when a.de = auth.uid() then a.para else a.de end
  left join public.colecoes c on c.user_id = p.id
  where auth.uid() in (a.de, a.para) and p.nick is not null
  order by 5 desc, lower(p.nick);
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

-- PAINEL ADM: tira o banner enviado por alguém (o perfil volta ao fundo padrão)
create or replace function public.remover_banner(alvo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'sem permissão'; end if;
  update public.perfis set banner = null where id = alvo;
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

grant execute on function public.nick_disponivel(text), public.ranking(integer), public.registrar_clique(text), public.perfil_publico(text), public.colecao_de(text) to anon, authenticated;
revoke execute on function public.pedir_amizade(text), public.responder_amizade(text, boolean), public.remover_amizade(text), public.meus_amigos() from public, anon;
grant execute on function public.pedir_amizade(text), public.responder_amizade(text, boolean), public.remover_amizade(text), public.meus_amigos() to authenticated;

-- ============ REGRAS DE ACESSO (RLS) ============
-- Permissões explícitas (funciona mesmo com "Automatically expose new tables" desligado).
-- Quem pode ver/mudar cada linha é decidido pelas regras (policies) logo abaixo.
grant usage on schema public to anon, authenticated;
grant select on public.parceiros to anon, authenticated;
grant insert, update, delete on public.parceiros to authenticated;
grant select on public.perfis, public.admins to authenticated;
grant select, insert, update on public.colecoes to authenticated;
grant execute on function public.eh_admin(), public.cliques_resumo(), public.admin_resumo(), public.remover_foto(uuid), public.remover_banner(uuid) to authenticated;

alter table public.perfis enable row level security;
alter table public.admins enable row level security;
alter table public.colecoes enable row level security;
alter table public.parceiros enable row level security;
alter table public.cliques enable row level security;
alter table public.amizades enable row level security;

-- amizades: ninguém lê nem grava direto (só pelas funções de AMIGOS)
revoke all on public.amizades from anon, authenticated;

-- perfis: o dono e os admins leem; o dono só pode trocar nick, sexo, avatar, foto, banner, vitrine e privacidade
drop policy if exists "perfil: dono ou admin le" on public.perfis;
create policy "perfil: dono ou admin le" on public.perfis for select using (id = auth.uid() or public.eh_admin());
drop policy if exists "perfil: dono edita" on public.perfis;
create policy "perfil: dono edita" on public.perfis for update using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.perfis from anon, authenticated;
grant update (nick, sexo, avatar, foto, banner, vitrine, privacidade, colecao_publica) on public.perfis to authenticated;

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

-- ============ BANNERS DE PERFIL (Storage) ============
-- Igual às fotos: cada pessoa só mexe na própria pasta banners/<id da conta>/... ; admins podem apagar qualquer um.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('banners', 'banners', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
  on conflict (id) do nothing;

drop policy if exists "banners: dono lista" on storage.objects;
create policy "banners: dono lista" on storage.objects for select using (bucket_id = 'banners' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));
drop policy if exists "banners: dono envia" on storage.objects;
create policy "banners: dono envia" on storage.objects for insert with check (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "banners: dono troca" on storage.objects;
create policy "banners: dono troca" on storage.objects for update using (bucket_id = 'banners' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "banners: dono ou admin apaga" on storage.objects;
create policy "banners: dono ou admin apaga" on storage.objects for delete using (bucket_id = 'banners' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

-- ============ VIRAR ADMIN ============
-- 1) Crie sua conta pelo próprio site (aba "Criar conta").
-- 2) Troque o e-mail abaixo pelo seu, tire os dois traços do começo da linha e rode só ela:
-- insert into public.admins (user_id) select id from auth.users where email = 'SEU_EMAIL_AQUI' on conflict do nothing;
