-- Add soft delete column to test_cases
ALTER TABLE `test_cases` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT 0;
