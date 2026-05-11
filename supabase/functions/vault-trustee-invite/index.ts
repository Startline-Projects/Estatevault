import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = Deno.env.get('RESEND_FROM') ?? 'EstateVault <info@estatevault.us>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.estatevault.us';

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
  const { trustee_id } = await req.json();
  if (!trustee_id) return jsonRes({ error: 'missing trustee_id' }, 400);

  const { data: client, error: clientErr } = await admin
    .from('clients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (clientErr || !client) return jsonRes({ error: 'client not found' }, 400);

  const token = crypto.randomUUID();
  const { data: trustee, error } = await admin
    .from('vault_trustees')
    .update({ invite_token: token, invite_sent_at: new Date().toISOString() })
    .eq('id', trustee_id)
    .eq('client_id', client.id)
    .select()
    .single();
  if (error || !trustee) return jsonRes({ error: error?.message ?? 'not found' }, 400);

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();
  const ownerName = profile?.full_name || profile?.email || user.email || 'Your contact';

  const link = `${APP_URL}/vault/trustee-confirm?token=${token}`;
  const html = `
      <div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; color: #2D2D2D;">
        <div style="background: #1C3557; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <p style="color: #C9A84C; font-size: 18px; font-weight: 700; margin: 0;">EstateVault</p>
        </div>
        <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1C3557; font-size: 20px; margin-top: 0;">Hello ${trustee.trustee_name},</h2>
          <p><strong>${ownerName}</strong> has designated you as a <strong>Vault Trustee</strong> on EstateVault.</p>
          <p style="color: #6b7280; font-size: 14px;">As a trustee, you may request emergency access to their protected vault in the event of their passing or incapacity. Access is granted only after a 72-hour review and identity verification.</p>
          <p style="color: #6b7280; font-size: 14px;">Please confirm you accept this role by clicking the button below.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${link}" style="background: #C9A84C; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: 600; font-size: 15px;">Accept Role as Trustee</a>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">This link expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 11px;">EstateVault · Protecting what matters most</p>
        </div>
      </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: trustee.trustee_email,
      subject: `${ownerName} added you as a Vault Trustee — confirm your role`,
      html,
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error('Resend error:', r.status, detail);
    return jsonRes({ error: 'email failed', detail }, 502);
  }
  return jsonRes({ ok: true });
});
