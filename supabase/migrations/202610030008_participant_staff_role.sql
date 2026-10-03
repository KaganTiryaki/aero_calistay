create function public.register_event_staff(p_user_id uuid,p_event_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_user_id is null or p_event_id is null or not private.staff_for_event(p_event_id,true) then raise exception 'FORBIDDEN';end if;
 if p_user_id=auth.uid() then raise exception 'ADMIN_ROLE_PROTECTED';end if;
 insert into public.staff_members(user_id,event_id,role,active) values(p_user_id,p_event_id,'staff',true)
 on conflict(user_id,event_id) do update set active=true where staff_members.role='staff';
 if not found then raise exception 'ADMIN_ROLE_PROTECTED';end if;
 return true;
end;$$;
revoke all on function public.register_event_staff(uuid,uuid) from public,anon;
grant execute on function public.register_event_staff(uuid,uuid) to authenticated;
