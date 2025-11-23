// Supabase Edge Function: activate-paid-user
// Verifies a paid Stripe checkout session, ensures a Supabase auth user exists,
// upgrades their profile to Pro, and returns a magic-link OTP so the browser can sign in automatically.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.45.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env vars for activate-paid-user function.");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type StripeSessionCheck =
  | { success: true; email: string; sessionId: string }
  | { success: false; status: number; message: string };

type EnsureUserResult =
  | { success: true; userId: string; created: boolean }
  | { success: false; message: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function fetchStripeSession(sessionId: string): Promise<StripeSessionCheck> {
  if (!stripeSecretKey) {
    return {
      success: false,
      status: 500,
      message: "Stripe secret key is not configured for activate-paid-user.",
    };
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message ?? "Unable to verify Stripe session.";
    return { success: false, status: response.status, message };
  }

  if (payload.payment_status !== "paid") {
    return {
      success: false,
      status: 409,
      message: `Stripe session ${sessionId} is not paid (status: ${payload.payment_status}).`,
    };
  }

  const email: string | undefined = payload?.customer_details?.email;
  if (!email) {
    return {
      success: false,
      status: 400,
      message: "Stripe session does not contain a customer email.",
    };
  }

  return {
    success: true,
    email: String(email).trim().toLowerCase(),
    sessionId,
  };
}

async function lookupAuthUserByEmail(email: string): Promise<User | null> {
  try {
    const url = new URL(`${supabaseUrl}/auth/v1/admin/users`);
    url.searchParams.set("email", email);
    url.searchParams.set("per_page", "1");

    const response = await fetch(url.toString(), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to query auth user by email", await response.text());
      return null;
    }

    const data = await response.json().catch(() => ({}));
    if (Array.isArray(data?.users) && data.users.length > 0) {
      return data.users[0] as User;
    }
    if (Array.isArray(data?.data?.users) && data.data.users.length > 0) {
      return data.data.users[0] as User;
    }
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as User;
    }
    return null;
  } catch (error) {
    console.error("lookupAuthUserByEmail error", error);
    return null;
  }
}

async function ensureAuthUser(email: string): Promise<EnsureUserResult> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      status: "active",
      plan: "pro",
      origin: "stripe",
    },
  });

  if (!error && data?.user?.id) {
    return { success: true, userId: data.user.id, created: true };
  }

  if (error && typeof error.message === "string" && error.message.toLowerCase().includes("already registered")) {
    const existing = await lookupAuthUserByEmail(email);
    if (existing?.id) {
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          status: "active",
          plan: "pro",
        },
      });
      return { success: true, userId: existing.id, created: false };
    }
    return { success: false, message: "User already exists but could not be retrieved." };
  }

  return { success: false, message: error?.message ?? "Unknown error creating auth user." };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId.trim() : "";
  const fallbackEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

  if (!sessionId) {
    return jsonResponse({ error: "sessionId is required" }, 400);
  }

  const stripeCheck = await fetchStripeSession(sessionId);
  if (!stripeCheck.success) {
    return jsonResponse({ error: stripeCheck.message }, stripeCheck.status);
  }

  const normalizedEmail = stripeCheck.email || fallbackEmail;
  if (!normalizedEmail) {
    return jsonResponse({ error: "Unable to determine customer email from Stripe session." }, 400);
  }

  const ensuredUser = await ensureAuthUser(normalizedEmail);
  if (!ensuredUser.success) {
    return jsonResponse({ error: ensuredUser.message }, 500);
  }

  const profilePayload = {
    id: ensuredUser.userId,
    email: normalizedEmail,
    status: "active",
    plan: "pro",
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabaseAdmin.from("users").upsert(profilePayload);
  if (profileError) {
    console.error("Failed to upsert profile", profileError);
    return jsonResponse({ error: "Failed to sync profile data." }, 500);
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: {
      data: {
        status: "active",
        plan: "pro",
      },
    },
  });

  const otp = linkData?.properties?.email_otp;
  if (linkError || !otp) {
    console.error("Failed to generate magic link", linkError);
    return jsonResponse({ error: linkError?.message ?? "Unable to issue login token." }, 500);
  }

  return jsonResponse({
    success: true,
    email: normalizedEmail,
    otp,
    userId: ensuredUser.userId,
    created: ensuredUser.created,
    verificationType: linkData?.properties?.verification_type ?? "magiclink",
  });
});
