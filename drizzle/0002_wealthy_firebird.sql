CREATE TABLE `material_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`qty` real NOT NULL,
	`unit` text NOT NULL,
	`occurred_at` text NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`job_id` text,
	`batch_id` text,
	`reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_material_movements_period` ON `material_movements` (`material_id`,`occurred_at`,`movement_type`);--> statement-breakpoint
CREATE INDEX `idx_material_movements_batch` ON `material_movements` (`batch_id`);