-- ============================================================
-- Phase 10 Migration — Marketing assets seed data
-- Run this in the Supabase SQL Editor
-- ============================================================

INSERT INTO marketing_assets (asset_type, asset_name, platform, storage_path, is_active)
VALUES
('script_card', 'Compliance Script Card', null, '/api/marketing/script-card', true),
('email_template', 'Client Introduction', null, 'inline', true),
('email_template', '7-Day Follow-Up', null, 'inline', true),
('email_template', 'Annual Reminder', null, 'inline', true),
('social_post', 'LinkedIn - Trust Awareness', 'linkedin', 'inline', true),
('social_post', 'LinkedIn - Vault Feature', 'linkedin', 'inline', true),
('social_post', 'LinkedIn - Social Proof', 'linkedin', 'inline', true),
('social_post', 'Facebook - Introduction', 'facebook', 'inline', true),
('social_post', 'Facebook - Question Hook', 'facebook', 'inline', true),
('social_post', 'Facebook - Simple CTA', 'facebook', 'inline', true),
('social_post', 'Instagram - Shield', 'instagram', 'inline', true),
('social_post', 'Instagram - Vault', 'instagram', 'inline', true),
('social_post', 'Instagram - Price', 'instagram', 'inline', true),
('print_flyer', 'Client Flyer 8.5x11', null, '/api/marketing/flyer', true),
('brochure', 'Trifold Brochure', null, '/api/marketing/flyer', true),
('one_pager', 'Client One-Pager', null, '/api/marketing/one-pager', true),
('presentation_slide', 'Single Slide PNG', null, 'inline', true);
