-- Enable realtime for contractions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.contractions;

-- Enable realtime for pregnancy_diary table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pregnancy_diary;