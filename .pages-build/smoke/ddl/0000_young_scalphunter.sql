CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'INFO' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "db_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"kind" text DEFAULT 'MANUAL' NOT NULL,
	"record_counts" jsonb,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sorumlu_hemsire" text,
	"hemsire_unvan" text,
	"saglik_bakim_muduru" text,
	"saglik_bakim_unvan" text,
	"bashekim" text,
	"bashekim_unvan" text,
	"manager_name" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "duty_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"staff_group" text DEFAULT 'SAGLIK' NOT NULL,
	"key" text NOT NULL,
	"service" text NOT NULL,
	"shift_label" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"holiday_date" date NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "holidays_holiday_date_unique" UNIQUE("holiday_date")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnel_id" uuid NOT NULL,
	"leave_type" text DEFAULT 'YILLIK' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_count" real DEFAULT 1 NOT NULL,
	"reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"requested_by" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"approval_stage" text DEFAULT 'HEMSIRE' NOT NULL,
	"stage_hemsire_by" text,
	"stage_hemsire_at" timestamp with time zone,
	"stage_hemsire_note" text,
	"stage_mudur_by" text,
	"stage_mudur_at" timestamp with time zone,
	"stage_mudur_note" text,
	"stage_bashekim_by" text,
	"stage_bashekim_at" timestamp with time zone,
	"stage_bashekim_note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personnel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"tc_no" text,
	"personnel_type" text DEFAULT 'MEMUR' NOT NULL,
	"staff_group" text DEFAULT 'SAGLIK' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"department_id" uuid,
	"title" text,
	"phone" text,
	"email" text,
	"emergency_contact" text,
	"address" text,
	"start_date" date,
	"notes" text,
	"annual_leave_balance" real DEFAULT 20,
	"sick_leave_balance" real DEFAULT 30,
	"unpaid_leave_balance" real DEFAULT 0,
	"avatar_data" text,
	"avatar_mime" text,
	"avatar_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personnel_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnel_id" uuid NOT NULL,
	"department_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"schedule_date" date NOT NULL,
	"personnel_id" uuid NOT NULL,
	"shift_slot" text DEFAULT 'CUSTOM' NOT NULL,
	"shift_label" text,
	"start_time" text,
	"end_time" text,
	"column_key" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_swap_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"requester_shift_id" uuid,
	"target_personnel_id" uuid,
	"target_shift_id" uuid,
	"swap_date" date NOT NULL,
	"reason" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shift_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid,
	"name" text NOT NULL,
	"shift_count" integer DEFAULT 2 NOT NULL,
	"slots" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timesheet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personnel_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"shift_type" text DEFAULT 'MANUAL' NOT NULL,
	"hours_worked" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weekly_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"personnel_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"week_index" integer NOT NULL,
	"worked" real,
	"night" real,
	"extra" real,
	"holiday" real
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_columns" ADD CONSTRAINT "duty_columns_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_departments" ADD CONSTRAINT "personnel_departments_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_departments" ADD CONSTRAINT "personnel_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requester_id_personnel_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requester_shift_id_shift_schedules_id_fk" FOREIGN KEY ("requester_shift_id") REFERENCES "public"."shift_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_personnel_id_personnel_id_fk" FOREIGN KEY ("target_personnel_id") REFERENCES "public"."personnel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_target_shift_id_shift_schedules_id_fk" FOREIGN KEY ("target_shift_id") REFERENCES "public"."shift_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_overrides" ADD CONSTRAINT "weekly_overrides_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_overrides" ADD CONSTRAINT "weekly_overrides_personnel_id_personnel_id_fk" FOREIGN KEY ("personnel_id") REFERENCES "public"."personnel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dc_dept_period_key_uniq" ON "duty_columns" USING btree ("department_id","period_year","period_month","key");--> statement-breakpoint
CREATE UNIQUE INDEX "pd_personnel_dept_uniq" ON "personnel_departments" USING btree ("personnel_id","department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ts_personnel_date_uniq" ON "timesheet_entries" USING btree ("personnel_id","entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "wo_uniq" ON "weekly_overrides" USING btree ("personnel_id","period_year","period_month","week_index");
