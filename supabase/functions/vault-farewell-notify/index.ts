import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = Deno.env.get('RESEND_FROM') ?? 'EstateVault <noreply@estatevault.app>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.estatevault.com';

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get('Authorization');
  if (!auth) return jsonRes({ error: 'unauthorized' }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return jsonRes({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { farewell_id, event } = await req.json();
  if (!farewell_id || !event) return jsonRes({ error: 'missing fields' }, 400);

  const { data: msg } = await admin
    .from('farewell_messages')
    .select('title, recipient_email, vault_farewell_status')
    .eq('id', farewell_id)
    .eq('client_id', user.id)
    .maybeSingle();
  if (!msg) return jsonRes({ error: 'not found' }, 404);

  let subject = '';
  let html = '';
  const link = `${APP_URL}/farewell/${farewell_id}`;
  if (event === 'created') {
    subject = `A farewell message has been prepared for you`;
    html = `<p>A message titled <b>${msg.title}</b> has been prepared. It will be unlocked when verification is complete.</p><p><a href="${link}">${link}</a></p>`;
  } else if (event === 'unlocked') {
    subject = `A farewell message is now available`;
    html = `<p>The message <b>${msg.title}</b> is now unlocked.</p><p><a href="${link}">${link}</a></p>`;
  } else {
    return jsonRes({ error: 'unknown event' }, 400);
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: msg.recipient_email,
      subject,
      html,
    }),
  });
  if (!r.ok) return jsonRes({ error: 'email failed' }, 502);
  return jsonRes({ ok: true });
});
