-- Create exec_sql helper function for running migrations via REST API
-- This function runs arbitrary SQL using the service role key via PostgREST RPC.
-- Applied to production on 2026-03-29.

CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  EXECUTE sql;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$func$;
