-- Add soft delete column to test_case_files if it does not exist
SET @column_exists := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'test_case_files'
		AND COLUMN_NAME = 'is_deleted'
);

SET @ddl := IF(
	@column_exists = 0,
	'ALTER TABLE `test_case_files` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT 0',
	'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
