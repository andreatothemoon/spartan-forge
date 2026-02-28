

## Add `export-workouts` Edge Function

### Overview
Create a new authenticated backend function that handles workout exports server-side, cloning the structure from the existing `ai-coach` function but with authentication enforced.

### Changes

#### 1. Create `supabase/functions/export-workouts/index.ts`
- Clone the CORS headers and structure from `ai-coach`
- Add JWT authentication using `getClaims()` (per project guidelines, `verify_jwt = true` is deprecated with signing-keys, so we set `verify_jwt = false` in config but validate the JWT in code)
- Accept `POST` with `{ planId, range, exportType }` in the body
- Use the Supabase service client to:
  - Verify the user owns the plan
  - Fetch sessions within the date range
  - Fetch session steps for each session
  - Log the export to `export_jobs`
- Return the generated JSON/FIT-stub content as a downloadable response

#### 2. Update `supabase/config.toml`
Add the function registration:
```toml
[functions.export-workouts]
verify_jwt = false
```
Note: Per the project's signing-keys setup, we set `verify_jwt = false` in config and validate the JWT manually in the function code using `getClaims()`. This is the recommended approach.

#### 3. Update `src/pages/Dashboard.tsx`
- Modify `handleExport` to call the new edge function instead of doing client-side export
- Use `supabase.functions.invoke('export-workouts', { body: { planId, range, exportType } })` or direct fetch with auth header
- Download the response content as a file

### Technical Details

**Authentication flow in the edge function:**
1. Extract `Authorization` header
2. Create a Supabase client scoped to the user
3. Call `getClaims(token)` to verify identity
4. Use `claims.sub` as the user ID to scope all queries

**Export logic** (moved server-side from `exportUtils.ts`):
- The export formatting logic from `exportUtils.ts` will be reimplemented in the edge function (since edge functions can't import from `src/`)
- The client will receive the final file content and trigger the download

