-- Read only the authenticated session's immutable creation time; do not expose auth.sessions.
create function public.current_session_expires_at() returns timestamptz
language plpgsql security definer set search_path='' as $$
declare v_session uuid;v_started timestamptz;v_user uuid:=auth.uid();
begin
 if v_user is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED';end if;
 begin v_session:=nullif(auth.jwt()->>'session_id','')::uuid;
 exception when invalid_text_representation then raise sqlstate 'PT401' using message='UNAUTHENTICATED';end;
 select created_at into v_started from auth.sessions where id=v_session and user_id=v_user;
 if not found or v_started is null then raise sqlstate 'PT401' using message='UNAUTHENTICATED';end if;
 return (((v_started at time zone 'Asia/Bangkok')::date+1)::timestamp at time zone 'Asia/Bangkok');
end;$$;
revoke all on function public.current_session_expires_at() from public,anon;
grant execute on function public.current_session_expires_at() to authenticated;
notify pgrst,'reload schema';
