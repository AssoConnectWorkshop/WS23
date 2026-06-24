create table if not exists tombola_participants (
  id bigint generated always as identity primary key,
  prenom text not null,
  nom text not null,
  created_at timestamptz default now()
);
