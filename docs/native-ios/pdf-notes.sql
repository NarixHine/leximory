begin;

create table public.pdf_page_notes (
    user_id uuid not null references auth.users(id) on delete cascade,
    text_id text not null references public.texts(id) on delete cascade,
    pdf_version text not null check (char_length(pdf_version) between 1 and 256),
    page_index integer not null check (page_index >= 0),
    drawing_base64 text not null,
    canvas_width double precision not null check (canvas_width > 0),
    canvas_height double precision not null check (canvas_height > 0),
    format_version smallint not null default 1 check (format_version > 0),
    revision uuid not null default gen_random_uuid(),
    updated_at timestamptz not null default now(),
    primary key (user_id, text_id, pdf_version, page_index)
);

alter table public.pdf_page_notes enable row level security;

-- Access goes through Leximory's server, which checks user and text access.
revoke all on table public.pdf_page_notes from public, anon, authenticated;
grant select, insert, update, delete on table public.pdf_page_notes to service_role;

-- The API supplies a stable revision UUID per save and sets updated_at on updates.
-- Keep an encoded empty PKDrawing when a page is erased; do not delete its row.

commit;
