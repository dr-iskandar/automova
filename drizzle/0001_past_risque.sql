CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`target_role` text DEFAULT 'all' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`link_view` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_role_read` ON `notifications` (`target_role`,`is_read`,`created_at`);--> statement-breakpoint
CREATE TABLE `report_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`report_type` text DEFAULT 'Production Summary' NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`status_filter` text DEFAULT '' NOT NULL,
	`job_filter` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
