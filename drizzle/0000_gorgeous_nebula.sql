CREATE TABLE `batch_events` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`event_time` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_batch` ON `batch_events` (`batch_id`,`event_time`);--> statement-breakpoint
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`job_name` text NOT NULL,
	`job_version` integer NOT NULL,
	`operator_id` text,
	`operator_name` text NOT NULL,
	`status` text NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`output` real,
	`unit` text NOT NULL,
	`planned_duration` integer DEFAULT 0 NOT NULL,
	`actual_duration` integer DEFAULT 0 NOT NULL,
	`pause_count` integer DEFAULT 0 NOT NULL,
	`on_time` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_batches_operator` ON `batches` (`operator_id`,`status`);--> statement-breakpoint
CREATE TABLE `job_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`material_id` text,
	`name` text NOT NULL,
	`qty` real NOT NULL,
	`unit` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`step_no` integer NOT NULL,
	`title` text NOT NULL,
	`instruction` text NOT NULL,
	`warning` text DEFAULT '' NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`action_label` text NOT NULL,
	`notes_required` integer DEFAULT false NOT NULL,
	`yes_target` text DEFAULT 'next' NOT NULL,
	`no_target` text DEFAULT 'paused' NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_steps_job` ON `job_steps` (`job_id`,`step_no`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`product` text NOT NULL,
	`target` real NOT NULL,
	`unit` text NOT NULL,
	`shift` text NOT NULL,
	`area` text NOT NULL,
	`line` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`popup_enabled` integer DEFAULT true NOT NULL,
	`popup_title` text DEFAULT '' NOT NULL,
	`popup_message` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`default_qty` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_code_unique` ON `materials` (`code`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`action` text NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_module_action_unique` ON `permissions` (`module`,`action`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`allowed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`role_id` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`shift` text DEFAULT '' NOT NULL,
	`employee_no` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role_id`);