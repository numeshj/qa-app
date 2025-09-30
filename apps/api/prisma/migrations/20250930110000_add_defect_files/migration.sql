-- Create defect_files table and add defect_file_id to defects
CREATE TABLE `defect_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `version` VARCHAR(50) NULL DEFAULT '1.0',
  `environment` VARCHAR(255) NULL,
  `release_build` VARCHAR(255) NULL,
  `refer` VARCHAR(255) NULL,
  `author_id` INT NULL,
  `is_deleted` BOOLEAN NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `defect_files_project_id_name_key` (`project_id`,`name`),
  CONSTRAINT `defect_files_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
  CONSTRAINT `defect_files_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `defects` ADD COLUMN `defect_file_id` INT NULL;
ALTER TABLE `defects` ADD CONSTRAINT `defects_defect_file_id_fkey` FOREIGN KEY (`defect_file_id`) REFERENCES `defect_files`(`id`) ON DELETE SET NULL;
CREATE INDEX `defects_defect_file_id_idx` ON `defects`(`defect_file_id`);
