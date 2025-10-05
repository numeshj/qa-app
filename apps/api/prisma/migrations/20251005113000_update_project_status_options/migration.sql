-- AlterTable
ALTER TABLE `Project`
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'ongoing';

-- Update existing rows to new status vocabulary
UPDATE `Project`
SET `status` = CASE
    WHEN `status` IN ('active', 'ongoing') THEN 'ongoing'
    WHEN `status` = 'completed' THEN 'completed'
    WHEN `status` IN ('on_hold', 'hold') THEN 'other'
    WHEN `status` IN ('not_started', 'yet_to_start') THEN 'yet_to_start'
    ELSE 'other'
END;
