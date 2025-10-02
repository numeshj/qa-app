SET @table_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'defect_files'
);

SET @create_table := IF(
  @table_exists = 0,
  'CREATE TABLE `defect_files` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `projectId` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `version` VARCHAR(50) NULL DEFAULT ''1.0'',
    `environment` VARCHAR(255) NULL,
    `release_build` VARCHAR(255) NULL,
    `refer` VARCHAR(255) NULL,
    `authorId` INT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `defect_files_projectId_name_key` (`projectId`,`name`)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  'SELECT 1'
);

PREPARE stmt_create_defect_files FROM @create_table;
EXECUTE stmt_create_defect_files;
DEALLOCATE PREPARE stmt_create_defect_files;

SET @fk_project := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'defect_files'
  AND CONSTRAINT_NAME = 'defect_files_projectId_fkey'
);

SET @projects_engine := (
  SELECT ENGINE
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'projects'
  LIMIT 1
);

SET @add_fk_project := IF(
  @fk_project = 0 AND @projects_engine = 'InnoDB',
  'ALTER TABLE `defect_files` ADD CONSTRAINT `defect_files_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE',
  'SELECT 1'
);

PREPARE stmt_fk_project FROM @add_fk_project;
EXECUTE stmt_fk_project;
DEALLOCATE PREPARE stmt_fk_project;

SET @fk_author := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'defect_files'
  AND CONSTRAINT_NAME = 'defect_files_authorId_fkey'
);

SET @users_engine := (
  SELECT ENGINE
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
  LIMIT 1
);

SET @add_fk_author := IF(
  @fk_author = 0 AND @users_engine = 'InnoDB',
  'ALTER TABLE `defect_files` ADD CONSTRAINT `defect_files_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt_fk_author FROM @add_fk_author;
EXECUTE stmt_fk_author;
DEALLOCATE PREPARE stmt_fk_author;

SET @defect_column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'defects'
    AND COLUMN_NAME = 'defectFileId'
);

SET @add_defect_column := IF(
  @defect_column_exists = 0,
  'ALTER TABLE `defects` ADD COLUMN `defectFileId` INT NULL',
  'SELECT 1'
);

PREPARE stmt_add_defect_col FROM @add_defect_column;
EXECUTE stmt_add_defect_col;
DEALLOCATE PREPARE stmt_add_defect_col;

SET @defect_index_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'defects'
    AND INDEX_NAME = 'defects_defectFileId_idx'
);

SET @add_defect_index := IF(
  @defect_index_exists = 0,
  'CREATE INDEX `defects_defectFileId_idx` ON `defects`(`defectFileId`)',
  'SELECT 1'
);

PREPARE stmt_add_defect_index FROM @add_defect_index;
EXECUTE stmt_add_defect_index;
DEALLOCATE PREPARE stmt_add_defect_index;

SET @defect_fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'defects'
    AND CONSTRAINT_NAME = 'defects_defectFileId_fkey'
);

SET @defects_engine := (
  SELECT ENGINE
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'defects'
  LIMIT 1
);

SET @add_defect_fk := IF(
  @defect_fk_exists = 0 AND @defects_engine = 'InnoDB',
  'ALTER TABLE `defects` ADD CONSTRAINT `defects_defectFileId_fkey` FOREIGN KEY (`defectFileId`) REFERENCES `defect_files`(`id`) ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt_add_defect_fk FROM @add_defect_fk;
EXECUTE stmt_add_defect_fk;
DEALLOCATE PREPARE stmt_add_defect_fk;
