
CREATE POLICY "Staff read xray images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'xray-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor')));
CREATE POLICY "Staff upload xray images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'xray-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor')));
CREATE POLICY "Staff delete xray images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'xray-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor')));
