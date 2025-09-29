-- Drop is_deleted column from test_cases now that soft delete is removed for TestCase
ALTER TABLE `test_cases` DROP COLUMN `is_deleted`;