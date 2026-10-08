CREATE TABLE "customer_sites" (
	"customer_id" integer NOT NULL,
	"site_id" integer NOT NULL,
	CONSTRAINT "customer_sites_customer_id_site_id_pk" PRIMARY KEY("customer_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "customers_name_unique" UNIQUE("name"),
	CONSTRAINT "customers_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "customer_sites" ADD CONSTRAINT "customer_sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sites" ADD CONSTRAINT "customer_sites_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;