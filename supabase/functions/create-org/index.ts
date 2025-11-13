import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables')
}

const admin = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
  auth: { persistSession: false }
})

// CORS helpers
const getCorsHeaders = (origin?: string) => {
  // Allow localhost during development and Vercel production domain
  const allowedOrigins = [
    'http://localhost:5173',
    'https://employeemanagement-lemon.vercel.app'
  ];
  
  const allowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed))
    ? origin
    : '*';

  return {
    'access-control-allow-origin': allowedOrigin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers':
      'authorization, apikey, content-type, x-client-info, x-supabase-authorization',
    'access-control-max-age': '86400'
  }
}

export default async (req: Request) => {
  try {
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(req.headers.get('origin') || undefined)
      })
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: getCorsHeaders(req.headers.get('origin') || undefined)
      })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token)
      return new Response(JSON.stringify({ error: 'Missing access token' }), {
        status: 401,
        headers: getCorsHeaders(req.headers.get('origin') || undefined)
      })

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: getCorsHeaders(req.headers.get('origin') || undefined)
      })
    }

    const user = userData.user

    const body = await req.json()
    const organizationName = body?.organizationName
    if (!organizationName) {
      return new Response(JSON.stringify({ error: 'organizationName is required' }), {
        status: 400,
        headers: getCorsHeaders(req.headers.get('origin') || undefined)
      })
    }

    // Generate unique slug with timestamp and random string to avoid duplicates
    const baseSlug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    const slug = `${baseSlug}-${timestamp}-${randomStr}`;
    const subdomain = `${baseSlug}-${randomStr}`;

    // create organization as admin
    const { data: orgData, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: organizationName,
        slug: slug,
        subdomain: subdomain,
        owner_id: user.id,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (orgError) {
      return new Response(JSON.stringify({ error: orgError.message }), {
        status: 500,
        headers: getCorsHeaders(req.headers.get('origin') || undefined)
      })
    }

    // add organization member with owner role
    await admin.from('organization_members').insert({
      organization_id: orgData.id,
      user_id: user.id,
      role: 'owner', // Owner role for signup users
      is_active: true
    })

    // create user profile
    await admin.from('user_profiles').insert({
      user_id: user.id,
      current_organization_id: orgData.id,
      is_active: true
    })

    return new Response(JSON.stringify({ organization: orgData }), {
      status: 200,
      headers: getCorsHeaders(req.headers.get('origin') || undefined)
    })
  } catch (err: any) {
    console.error('create-org function error', err)
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: getCorsHeaders()
    })
  }
}
