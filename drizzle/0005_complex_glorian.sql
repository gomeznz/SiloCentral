CREATE TABLE "config_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"username" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_configs" (
	"site_id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"managed" boolean DEFAULT false NOT NULL,
	"import_requested" boolean DEFAULT false NOT NULL,
	"imported_at" timestamp with time zone,
	"applied_version" integer,
	"applied_at" timestamp with time zone,
	"apply_error" text,
	"apply_error_version" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "config_audit" ADD CONSTRAINT "config_audit_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_configs" ADD CONSTRAINT "site_configs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;