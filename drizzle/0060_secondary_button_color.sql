ALTER TABLE instance_configuration ADD COLUMN secondary_button_color TEXT NOT NULL DEFAULT '#D3EB7A';
UPDATE instance_configuration SET secondary_button_color=management_button_color;
