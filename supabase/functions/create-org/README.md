This Edge Function creates an organization, an organization member (admin), and a user profile using the Supabase service_role key.

Deployment (Supabase CLI):
1. Install supabase CLI: https://supabase.com/docs/guides/cli
2. Login and link your project: `supabase login` then `supabase link --project-ref <your-project-ref>`
3. Deploy the function:
   cd supabase/functions/create-org
   supabase functions deploy create-org --no-verify-jwt

Security:
- The function verifies the caller's access token by calling `admin.auth.getUser(token)` and ensures the user exists.
- The function runs database operations using the service_role key, so it can bypass RLS to perform the initial setup.
- Clients should call this function only after obtaining a session token (e.g., after sign-in). The token is passed in the `Authorization: Bearer <token>` header.

Client usage example (already implemented in this repo's `AuthContext.tsx`):
- After signUp and signIn, call:
  POST ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-org
  Headers: Authorization: Bearer <access_token>, apikey: <anon key>
  Body: { "organizationName": "My Company" }

Notes:
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in your function's environment when deploying.
- This function is intended as a recommended long-term fix to avoid RLS race conditions during signup.
