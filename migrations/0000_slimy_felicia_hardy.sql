CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"normalized_email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(50) DEFAULT 'RECRUITMENT_OFFICER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret_encrypted" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_normalized_email_unique" UNIQUE("normalized_email")
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(45),
	"user_agent" text,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "membership_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_reference" varchar(64) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"normalized_email" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"normalized_phone" varchar(50) NOT NULL,
	"county" varchar(100) NOT NULL,
	"constituency" varchar(100) NOT NULL,
	"occupation" varchar(150) NOT NULL,
	"id_document_encrypted" text NOT NULL,
	"id_document_hmac" varchar(64) NOT NULL,
	"id_document_masked" varchar(20) NOT NULL,
	"consent_given" boolean NOT NULL,
	"consent_timestamp" timestamp with time zone NOT NULL,
	"consent_version" varchar(50) NOT NULL,
	"consent_text_hash" varchar(64),
	"status" varchar(50) DEFAULT 'SUBMITTED' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_applications_application_reference_unique" UNIQUE("application_reference")
);
--> statement-breakpoint
CREATE TABLE "application_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"previous_status" varchar(50) NOT NULL,
	"new_status" varchar(50) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_admin_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text NOT NULL,
	"body" text NOT NULL,
	"featured_image_url" text,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "leadership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" varchar(255) NOT NULL,
	"bio" text,
	"image_url" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"document_type" varchar(50) DEFAULT 'OTHER' NOT NULL,
	"description" text,
	"file_url" text NOT NULL,
	"version" varchar(50),
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content_json" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_content_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_applications" ADD CONSTRAINT "membership_applications_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_application_id_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."membership_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_admin_id_admin_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_users_normalized_email_idx" ON "admin_users" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "admin_users_role_idx" ON "admin_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "admin_sessions_token_hash_idx" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_user_id_idx" ON "admin_sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "membership_app_ref_idx" ON "membership_applications" USING btree ("application_reference");--> statement-breakpoint
CREATE INDEX "membership_app_id_hmac_idx" ON "membership_applications" USING btree ("id_document_hmac");--> statement-breakpoint
CREATE INDEX "membership_app_norm_email_idx" ON "membership_applications" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "membership_app_norm_phone_idx" ON "membership_applications" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "membership_app_status_idx" ON "membership_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "membership_app_submitted_at_idx" ON "membership_applications" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "app_reviews_application_id_idx" ON "application_reviews" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "app_reviews_admin_user_id_idx" ON "application_reviews" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "app_reviews_created_at_idx" ON "application_reviews" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_admin_id_idx" ON "audit_logs" USING btree ("actor_admin_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "news_slug_idx" ON "news" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_status_idx" ON "news" USING btree ("status");--> statement-breakpoint
CREATE INDEX "news_published_at_idx" ON "news" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "leadership_status_idx" ON "leadership" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leadership_display_order_idx" ON "leadership" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "documents_slug_idx" ON "documents" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "site_content_key_idx" ON "site_content" USING btree ("key");--> statement-breakpoint
CREATE INDEX "site_content_status_idx" ON "site_content" USING btree ("status");