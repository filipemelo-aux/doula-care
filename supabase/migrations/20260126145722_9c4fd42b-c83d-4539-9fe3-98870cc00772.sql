-- Add read_by_admin column to pregnancy_diary table
ALTER TABLE public.pregnancy_diary 
ADD COLUMN read_by_admin boolean NOT NULL DEFAULT false;