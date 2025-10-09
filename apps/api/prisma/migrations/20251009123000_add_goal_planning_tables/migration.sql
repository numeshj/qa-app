-- CreateTable
CREATE TABLE `goal_focus_areas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `weight` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(191) NOT NULL DEFAULT '#0ea5e9',
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `goal_focus_areas_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `week_start` DATETIME(3) NOT NULL,
    `theme` VARCHAR(191) NULL,
    `summary_note` TEXT NULL,
    `overall_score` INTEGER NULL,
    `morale_score` INTEGER NULL,
    `highlight_notes` TEXT NULL,
    `adjustment_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `weekly_plans_userId_week_start_key`(`userId`, `week_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_goals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `focusAreaId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `metric` VARCHAR(191) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('planned', 'on_track', 'at_risk', 'completed', 'deferred') NOT NULL DEFAULT 'planned',
    `impact_score` INTEGER NOT NULL DEFAULT 3,
    `owner` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `update_summary` TEXT NULL,
    `change_notes` TEXT NULL,
    `reviewer_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `weekly_goals_planId_idx`(`planId`),
    INDEX `weekly_goals_focusAreaId_idx`(`focusAreaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_goal_test_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `weekly_goal_id` INTEGER NOT NULL,
    `test_case_file_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `weekly_goal_test_file_unique`(`weekly_goal_id`, `test_case_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weekly_goal_defect_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `weekly_goal_id` INTEGER NOT NULL,
    `defect_file_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `weekly_goal_defect_file_unique`(`weekly_goal_id`, `defect_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `plan_date` DATETIME(3) NOT NULL,
    `day_note` TEXT NULL,
    `energy_score` INTEGER NULL,
    `clarity_score` INTEGER NULL,
    `highlight_notes` TEXT NULL,
    `blocker_notes` TEXT NULL,
    `tomorrow_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_plans_userId_plan_date_key`(`userId`, `plan_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `focusAreaId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('not_started', 'in_progress', 'done', 'blocked') NOT NULL DEFAULT 'not_started',
    `impact_score` INTEGER NOT NULL DEFAULT 3,
    `effort_score` INTEGER NOT NULL DEFAULT 2,
    `notes` TEXT NULL,
    `update_summary` TEXT NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_entries_plan_id_idx`(`plan_id`),
    INDEX `daily_entries_focusAreaId_idx`(`focusAreaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_entry_test_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `daily_entry_id` INTEGER NOT NULL,
    `test_case_file_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `daily_entry_test_file_unique`(`daily_entry_id`, `test_case_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_entry_defect_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `daily_entry_id` INTEGER NOT NULL,
    `defect_file_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `daily_entry_defect_file_unique`(`daily_entry_id`, `defect_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `goal_focus_areas` ADD CONSTRAINT `goal_focus_areas_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_plans` ADD CONSTRAINT `weekly_plans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_goals` ADD CONSTRAINT `weekly_goals_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `weekly_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_goals` ADD CONSTRAINT `weekly_goals_focusAreaId_fkey` FOREIGN KEY (`focusAreaId`) REFERENCES `goal_focus_areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_goal_test_files` ADD CONSTRAINT `weekly_goal_test_files_weekly_goal_id_fkey` FOREIGN KEY (`weekly_goal_id`) REFERENCES `weekly_goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_goal_test_files` ADD CONSTRAINT `weekly_goal_test_files_test_case_file_id_fkey` FOREIGN KEY (`test_case_file_id`) REFERENCES `test_case_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_goal_defect_files` ADD CONSTRAINT `weekly_goal_defect_files_weekly_goal_id_fkey` FOREIGN KEY (`weekly_goal_id`) REFERENCES `weekly_goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `weekly_goal_defect_files` ADD CONSTRAINT `weekly_goal_defect_files_defect_file_id_fkey` FOREIGN KEY (`defect_file_id`) REFERENCES `defect_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_plans` ADD CONSTRAINT `daily_plans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_entries` ADD CONSTRAINT `daily_entries_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `daily_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_entries` ADD CONSTRAINT `daily_entries_focusAreaId_fkey` FOREIGN KEY (`focusAreaId`) REFERENCES `goal_focus_areas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_entry_test_files` ADD CONSTRAINT `daily_entry_test_files_daily_entry_id_fkey` FOREIGN KEY (`daily_entry_id`) REFERENCES `daily_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_entry_test_files` ADD CONSTRAINT `daily_entry_test_files_test_case_file_id_fkey` FOREIGN KEY (`test_case_file_id`) REFERENCES `test_case_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_entry_defect_files` ADD CONSTRAINT `daily_entry_defect_files_daily_entry_id_fkey` FOREIGN KEY (`daily_entry_id`) REFERENCES `daily_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_entry_defect_files` ADD CONSTRAINT `daily_entry_defect_files_defect_file_id_fkey` FOREIGN KEY (`defect_file_id`) REFERENCES `defect_files`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
