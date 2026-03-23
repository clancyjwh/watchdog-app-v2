/*
  # Set Existing Sources as Core Sources

  1. Changes
    - Updates all existing sources to have `is_core_source = true`
    - This fixes the scan validation issue where existing sources weren't marked as core sources
  
  2. Notes
    - This is a one-time data migration to fix existing data
    - All new sources added through the Settings UI will automatically be marked as core sources
*/

UPDATE sources
SET is_core_source = true
WHERE is_core_source = false OR is_core_source IS NULL;