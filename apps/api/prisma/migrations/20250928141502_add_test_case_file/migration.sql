-- AlterTable
ALTER TABLE `test_cases` ADD COLUMN `testCaseFileId` INTEGER NULL;

-- CreateTable
CREATE TABLE `test_case_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NULL DEFAULT '1.0',
    `environment` VARCHAR(191) NULL,
    `release_build` VARCHAR(191) NULL,
    `refer` VARCHAR(191) NULL,
    `authorId` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `test_case_files_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `test_case_files` ADD CONSTRAINT `test_case_files_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_case_files` ADD CONSTRAINT `test_case_files_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_testCaseFileId_fkey` FOREIGN KEY (`testCaseFileId`) REFERENCES `test_case_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
