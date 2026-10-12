create function public.staff_invitation_context() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.organization_members;v_name text;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise sqlstate 'PT403' using message='EMAIL_NOT_VERIFIED';end if;
 select * into v_member from public.organization_members where user_id=auth.uid() and status='INVITED' and deleted_at is null;
 if not found then raise sqlstate 'PT404' using message='NO_INVITATION';end if;
 select name into v_name from public.organizations where id=v_member.org_id and status='ACTIVE' and deleted_at is null;
 if not found then raise sqlstate 'PT403' using message='FORBIDDEN';end if;
 return jsonb_build_object('orgName',v_name,'role',v_member.role);
end;$$;
revoke all on function public.staff_invitation_context() from public,anon;
grant execute on function public.staff_invitation_context() to authenticated;
notify pgrst,'reload schema';
