ALTER TABLE instance_configuration ADD COLUMN public_logo_size INTEGER NOT NULL DEFAULT 44;
ALTER TABLE instance_configuration ADD COLUMN admin_logo_size INTEGER NOT NULL DEFAULT 54;
ALTER TABLE instance_configuration ADD COLUMN show_public_brand_text INTEGER NOT NULL DEFAULT 1;
ALTER TABLE instance_configuration ADD COLUMN show_admin_brand_text INTEGER NOT NULL DEFAULT 1;
