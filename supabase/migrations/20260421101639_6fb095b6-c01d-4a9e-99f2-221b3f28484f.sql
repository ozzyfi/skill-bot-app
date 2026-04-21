
DROP POLICY "auth insert work_orders" ON public.work_orders;
CREATE POLICY "auth insert work_orders" ON public.work_orders
  FOR INSERT TO authenticated
  WITH CHECK (assignee_id IS NULL OR assignee_id = auth.uid());
