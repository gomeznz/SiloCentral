CREATE TABLE "site_silo_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"page_slug" text NOT NULL,
	"silo_name" text NOT NULL,
	"percent" numeric(5, 2) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_silo_readings" ADD CONSTRAINT "site_silo_readings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;