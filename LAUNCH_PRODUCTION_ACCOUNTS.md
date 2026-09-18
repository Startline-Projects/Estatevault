# Launch step: the two production accounts

**Do not run this before launch day.** These are live admin and reviewer accounts; create them as part
of the launch sequence, right before flipping to live, when they can be verified immediately.
Staging (`ededvmvmgrqqeqcemsuz`) already has both — created 2026-09-18 with the SQL in option B.

**Target: production project `onstztnksotijxxjxgyq`. Check the project ref in the dashboard URL
before every statement.** Run by Sam, never by an agent.

## Why they must exist

The Stripe webhook's attorney-review step (`lib/webhooks/stripe/handleAttorneyReview.ts`) turns two
addresses from `lib/config/contacts.ts` into profile ids by lookup on `public.profiles.email`:

| Constant | Address | Becomes | `user_type` |
|---|---|---|---|
| `PLATFORM_ADMIN_EMAIL` | `info@estatevault.us` | `attorney_reviews.fee_controlled_by`; also receives fulfilment-failure alerts | `admin` |
| `REVIEW_ATTORNEY_EMAIL` | `ahm3dkass@gmail.com` | `attorney_reviews.attorney_id` (the reviewer) — **pilot relay** to the founder's inbox | `review_attorney` |

If either is missing, the review row is still created, just without that id, and the webhook logs
`[attorney-review] no profile for …`. So: create both **before** the first paid order with attorney
review.

Production has the trigger `on_auth_user_created → public.handle_new_user()` (confirmed in the
schema extract of 2026-09-16, `supabase/staging/01_schema.sql`), which creates the `profiles` row
from the new user's metadata.

## Step 0 — look first (read-only)

```sql
select u.email, p.user_type, p.full_name, u.email_confirmed_at is not null as confirmed, u.created_at
from auth.users u left join public.profiles p on p.id = u.id
where u.email in ('info@estatevault.us', 'ahm3dkass@gmail.com')
   or p.user_type = 'admin'
order by u.created_at;
```

If an account already exists under either address, **do not create a second one** — skip to step 2
and only fix its `user_type`.

## Step 1 — create the accounts (pick ONE option)

### Option A — dashboard (recommended: Supabase builds the auth rows itself)

Authentication → Users → **Add user** → *Create new user*, once per address. Tick **Auto Confirm
User**. Give each a long random password from your password manager.

A dashboard-created user carries no `user_type` metadata, so the trigger files it as `client`.
Step 2 corrects that.

### Option B — SQL (exactly what was run on staging)

No password is known to anyone: each account gets a bcrypt hash of a random value generated inside
Postgres. The owner sets a real password in step 3. Idempotent — it skips an address that exists.

```sql
begin;

with new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         v.email,
         extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf')),
         now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', v.full_name, 'user_type', v.user_type),
         now(), now(), '', '', '', ''
  from (values ('info@estatevault.us', 'Admin', 'admin'),
               ('ahm3dkass@gmail.com', 'Review Attorney', 'review_attorney')) as v(email, full_name, user_type)
  where not exists (select 1 from auth.users u where u.email = v.email)
  returning id, email
)
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select id::text, id,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now()
from new_users
returning user_id, provider;

-- expect two rows above (or fewer, if an address already existed). Then:
commit;   -- or: rollback;
```

The four empty-string token columns matter: GoTrue cannot read a NULL there and the account would
fail to sign in or recover.

## Step 2 — make the roles right (both options; safe to re-run)

```sql
update public.profiles set user_type = 'admin'
 where email = 'info@estatevault.us' and user_type <> 'admin';

update public.profiles set user_type = 'review_attorney'
 where email = 'ahm3dkass@gmail.com' and user_type <> 'review_attorney';
```

Do **not** set `bar_number`, `bar_verified` or `is_payroll` on the relay account. Those describe a
licensed attorney; the relay is the founder's inbox. They belong on the reviewing attorney's own
account when `REVIEW_ATTORNEY_EMAIL` is changed post-pilot.

## Step 3 — set real passwords

On the live site: **Forgot password** for each address, follow the emailed link, set a password.
That flow was proven end to end on staging on 2026-09-17. (Option A users already have the password
you typed; still worth one sign-in to confirm.)

## Step 4 — verify

```sql
-- both rows, right types, one email identity each, profile linked
select u.email, p.user_type, u.email_confirmed_at is not null as confirmed,
       (select count(*) from auth.identities i where i.user_id = u.id and i.provider = 'email') as email_identities,
       p.id = u.id as profile_linked, p.bar_number, p.bar_verified
from auth.users u left join public.profiles p on p.id = u.id
where u.email in ('info@estatevault.us', 'ahm3dkass@gmail.com')
order by u.email;

-- exactly what the webhook runs; neither may be null
select (select id from public.profiles where email = 'ahm3dkass@gmail.com') as attorney_id,
       (select id from public.profiles where email = 'info@estatevault.us')  as fee_controlled_by;
```

Expected: `admin` / `review_attorney`, confirmed, `email_identities = 1`, `profile_linked = true`,
bar fields empty, and two non-null ids. Then sign in as each once.

## Undo (only if something went wrong, and before any order references them)

```sql
delete from auth.users where email in ('info@estatevault.us', 'ahm3dkass@gmail.com');
-- profiles, identities and sessions go with them (ON DELETE CASCADE).
```

Once an `attorney_reviews` row points at either account, do not delete it — re-point or disable.

## Post-pilot

Change `REVIEW_ATTORNEY_EMAIL` in `lib/config/contacts.ts` to the reviewing attorney's own address,
create that account in every environment **first**, then run
`npx tsx scripts/reassign-pending-reviews.ts` to move open reviews across.
