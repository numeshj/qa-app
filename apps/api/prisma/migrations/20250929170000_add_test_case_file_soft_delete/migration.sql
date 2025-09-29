-- Add soft delete column to test_case_files if it does not exist
ALTER TABLE `test_case_files` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT 0;
