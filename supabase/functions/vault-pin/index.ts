import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Body {
  action: 'check' | 'create' | 'verify' | 'change';
  pin?: string;
  newPin?: string;
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isFourToSixDigit(p: string) {
  return /^\d{4,6}$/.test(p);
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
  const body: Body = await req.json();

  switch (body.action) {
    case 'check': {
      const { data } = await admin
        .from('profiles')
        .select('vault_pin_hash')
        .eq('id', user.id)
        .maybeSingle();
      return jsonRes({ exists: !!data?.vault_pin_hash });
    }
    case 'create': {
      if (!body.pin || !isFourToSixDigit(body.pin)) {
        return jsonRes({ error: 'invalid pin' }, 400);
      }
      const hash = bcrypt.hashSync(body.pin);
      const { error } = await admin
        .from('profiles')
        .update({ vault_pin_hash: hash })
        .eq('id', user.id);
      if (error) return jsonRes({ error: error.message }, 400);
      return jsonRes({ ok: true });
    }
    case 'verify': {
      if (!body.pin) return jsonRes({ error: 'missing pin' }, 400);
      const { data } = await admin
        .from('profiles')
        .select('vault_pin_hash')
        .eq('id', user.id)
        .maybeSingle();
      const hash = data?.vault_pin_hash;
      if (!hash) return jsonRes({ valid: false });
      const valid = bcrypt.compareSync(body.pin, hash);
      return jsonRes({ valid });
    }
    case 'change': {
      if (!body.pin || !body.newPin || !isFourToSixDigit(body.newPin)) {
        return jsonRes({ error: 'invalid input' }, 400);
      }
      const { data } = await admin
        .from('profiles')
        .select('vault_pin_hash')
        .eq('id', user.id)
        .maybeSingle();
      const ok = data?.vault_pin_hash
        ? bcrypt.compareSync(body.pin, data.vault_pin_hash)
        : false;
      if (!ok) return jsonRes({ error: 'wrong pin' }, 403);
      const newHash = bcrypt.hashSync(body.newPin);
      const { error } = await admin
        .from('profiles')
        .update({ vault_pin_hash: newHash })
        .eq('id', user.id);
      if (error) return jsonRes({ error: error.message }, 400);
      return jsonRes({ ok: true });
    }
    default:
      return jsonRes({ error: 'unknown action' }, 400);
  }
});
