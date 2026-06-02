export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          converted: boolean | null
          created_at: string | null
          id: string
          ip_hash: string | null
          landing_path: string | null
          order_id: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          converted?: boolean | null
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          order_id?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          converted?: boolean | null
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          order_id?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount_cents: number
          created_at: string | null
          id: string
          orders_included: Json | null
          paid_at: string | null
          status: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          affiliate_id: string
          amount_cents: number
          created_at?: string | null
          id?: string
          orders_included?: Json | null
          paid_at?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          affiliate_id?: string
          amount_cents?: number
          created_at?: string | null
          id?: string
          orders_included?: Json | null
          paid_at?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          code: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          profile_id: string
          status: string | null
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          total_clicks: number | null
          total_conversions: number | null
          total_earned_cents: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          profile_id: string
          status?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          total_clicks?: number | null
          total_conversions?: number | null
          total_earned_cents?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          profile_id?: string
          status?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          total_clicks?: number | null
          total_conversions?: number | null
          total_earned_cents?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attorney_reviews: {
        Row: {
          attorney_fee: number | null
          attorney_id: string | null
          created_at: string | null
          fee_amount: number | null
          fee_controlled_by: string | null
          fee_destination: string | null
          id: string
          notes: string | null
          order_id: string | null
          partner_id: string | null
          reviewed_at: string | null
          reviewer_type: string | null
          sla_deadline: string | null
          status: string | null
        }
        Insert: {
          attorney_fee?: number | null
          attorney_id?: string | null
          created_at?: string | null
          fee_amount?: number | null
          fee_controlled_by?: string | null
          fee_destination?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          partner_id?: string | null
          reviewed_at?: string | null
          reviewer_type?: string | null
          sla_deadline?: string | null
          status?: string | null
        }
        Update: {
          attorney_fee?: number | null
          attorney_id?: string | null
          created_at?: string | null
          fee_amount?: number | null
          fee_controlled_by?: string | null
          fee_destination?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          partner_id?: string | null
          reviewed_at?: string | null
          reviewer_type?: string | null
          sla_deadline?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attorney_reviews_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attorney_reviews_fee_controlled_by_fkey"
            columns: ["fee_controlled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attorney_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attorney_reviews_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          note: string
          partner_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          note: string
          partner_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          note?: string
          partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          advisor_firm: string | null
          advisor_name: string | null
          advisor_share_consent: boolean | null
          created_at: string | null
          crypto_backfill_complete_at: string | null
          crypto_setup_at: string | null
          dek_aad_version: number | null
          dek_setup_at: string | null
          documents_executed: boolean | null
          documents_executed_at: string | null
          enc_version: number | null
          funding_checklist: Json | null
          id: string
          intake_snapshot: Json | null
          intake_snapshot_updated_at: string | null
          kdf_params: Json | null
          kdf_salt: string | null
          last_annual_review_sent_at: string | null
          last_life_event_checkin_sent_at: string | null
          life_events_logged: Json | null
          partner_id: string | null
          profile_id: string | null
          pubkey_ed25519: string | null
          pubkey_x25519: string | null
          source: string | null
          state: string | null
          updated_at: string | null
          vault_master_share_a: string | null
          vault_master_share_c_enc: string | null
          vault_shamir_initialized_at: string | null
          vault_shamir_version: number | null
          vault_subscription_expiry: string | null
          vault_subscription_status: string | null
          vault_subscription_stripe_id: string | null
          vault_wrapped_mk_shamir: string | null
          wrapped_dek: string | null
          wrapped_mk_pass: string | null
          wrapped_mk_recovery: string | null
        }
        Insert: {
          advisor_firm?: string | null
          advisor_name?: string | null
          advisor_share_consent?: boolean | null
          created_at?: string | null
          crypto_backfill_complete_at?: string | null
          crypto_setup_at?: string | null
          dek_aad_version?: number | null
          dek_setup_at?: string | null
          documents_executed?: boolean | null
          documents_executed_at?: string | null
          enc_version?: number | null
          funding_checklist?: Json | null
          id?: string
          intake_snapshot?: Json | null
          intake_snapshot_updated_at?: string | null
          kdf_params?: Json | null
          kdf_salt?: string | null
          last_annual_review_sent_at?: string | null
          last_life_event_checkin_sent_at?: string | null
          life_events_logged?: Json | null
          partner_id?: string | null
          profile_id?: string | null
          pubkey_ed25519?: string | null
          pubkey_x25519?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string | null
          vault_master_share_a?: string | null
          vault_master_share_c_enc?: string | null
          vault_shamir_initialized_at?: string | null
          vault_shamir_version?: number | null
          vault_subscription_expiry?: string | null
          vault_subscription_status?: string | null
          vault_subscription_stripe_id?: string | null
          vault_wrapped_mk_shamir?: string | null
          wrapped_dek?: string | null
          wrapped_mk_pass?: string | null
          wrapped_mk_recovery?: string | null
        }
        Update: {
          advisor_firm?: string | null
          advisor_name?: string | null
          advisor_share_consent?: boolean | null
          created_at?: string | null
          crypto_backfill_complete_at?: string | null
          crypto_setup_at?: string | null
          dek_aad_version?: number | null
          dek_setup_at?: string | null
          documents_executed?: boolean | null
          documents_executed_at?: string | null
          enc_version?: number | null
          funding_checklist?: Json | null
          id?: string
          intake_snapshot?: Json | null
          intake_snapshot_updated_at?: string | null
          kdf_params?: Json | null
          kdf_salt?: string | null
          last_annual_review_sent_at?: string | null
          last_life_event_checkin_sent_at?: string | null
          life_events_logged?: Json | null
          partner_id?: string | null
          profile_id?: string | null
          pubkey_ed25519?: string | null
          pubkey_x25519?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string | null
          vault_master_share_a?: string | null
          vault_master_share_c_enc?: string | null
          vault_shamir_initialized_at?: string | null
          vault_shamir_version?: number | null
          vault_subscription_expiry?: string | null
          vault_subscription_status?: string | null
          vault_subscription_stripe_id?: string | null
          vault_wrapped_mk_shamir?: string | null
          wrapped_dek?: string | null
          wrapped_mk_pass?: string | null
          wrapped_mk_recovery?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          attorney_sealed_for: string | null
          attorney_sealed_path: string | null
          client_id: string | null
          created_at: string | null
          delivered_at: string | null
          document_type: string
          generated_at: string | null
          id: string
          order_id: string | null
          parent_document_id: string | null
          review_docx_for: string | null
          review_docx_path: string | null
          reviewed_by: string | null
          reviewed_for_user_id: string | null
          reviewed_path: string | null
          reviewed_sealed: boolean
          reviewed_src_path: string | null
          reviewed_uploaded_at: string | null
          sealed: boolean
          sealed_for_user_id: string | null
          status: string | null
          storage_path: string | null
          superseded_at: string | null
          superseded_by: string | null
          template_version: string
          version: number
        }
        Insert: {
          attorney_sealed_for?: string | null
          attorney_sealed_path?: string | null
          client_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          document_type: string
          generated_at?: string | null
          id?: string
          order_id?: string | null
          parent_document_id?: string | null
          review_docx_for?: string | null
          review_docx_path?: string | null
          reviewed_by?: string | null
          reviewed_for_user_id?: string | null
          reviewed_path?: string | null
          reviewed_sealed?: boolean
          reviewed_src_path?: string | null
          reviewed_uploaded_at?: string | null
          sealed?: boolean
          sealed_for_user_id?: string | null
          status?: string | null
          storage_path?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          template_version: string
          version?: number
        }
        Update: {
          attorney_sealed_for?: string | null
          attorney_sealed_path?: string | null
          client_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          document_type?: string
          generated_at?: string | null
          id?: string
          order_id?: string | null
          parent_document_id?: string | null
          review_docx_for?: string | null
          review_docx_path?: string | null
          reviewed_by?: string | null
          reviewed_for_user_id?: string | null
          reviewed_path?: string | null
          reviewed_sealed?: boolean
          reviewed_src_path?: string | null
          reviewed_uploaded_at?: string | null
          sealed?: boolean
          sealed_for_user_id?: string | null
          status?: string | null
          storage_path?: string | null
          superseded_at?: string | null
          superseded_by?: string | null
          template_version?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_review_docx_for_fkey"
            columns: ["review_docx_for"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reviewed_for_user_id_fkey"
            columns: ["reviewed_for_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      farewell_messages: {
        Row: {
          backfilled_at: string | null
          ciphertext: string | null
          client_id: string
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          enc_version: number | null
          file_size_mb: number | null
          id: string
          nonce: string | null
          recipient_blind: string | null
          recipient_email: string
          storage_header: string | null
          storage_path: string | null
          title: string
          unlocked_at: string | null
          updated_at: string
          vault_farewell_status: string
        }
        Insert: {
          backfilled_at?: string | null
          ciphertext?: string | null
          client_id: string
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          enc_version?: number | null
          file_size_mb?: number | null
          id?: string
          nonce?: string | null
          recipient_blind?: string | null
          recipient_email: string
          storage_header?: string | null
          storage_path?: string | null
          title: string
          unlocked_at?: string | null
          updated_at?: string
          vault_farewell_status?: string
        }
        Update: {
          backfilled_at?: string | null
          ciphertext?: string | null
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          enc_version?: number | null
          file_size_mb?: number | null
          id?: string
          nonce?: string | null
          recipient_blind?: string | null
          recipient_email?: string
          storage_header?: string | null
          storage_path?: string | null
          title?: string
          unlocked_at?: string | null
          updated_at?: string
          vault_farewell_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "farewell_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      farewell_verification_requests: {
        Row: {
          access_expires_at: string | null
          certificate_storage_path: string
          client_id: string
          id: string
          identity_check_id: string | null
          identity_verified: boolean | null
          notes: string | null
          otp_email_attempts: number | null
          otp_email_expires_at: string | null
          otp_email_hash: string | null
          otp_sms_attempts: number | null
          owner_veto_token_hash: string | null
          owner_vetoed_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          share_c_hash: string | null
          status: string
          submitted_at: string
          trustee_access_token_hash: string | null
          trustee_email: string
          trustee_email_notified_at: string | null
          trustee_id: string | null
          unlock_window_expires_at: string | null
          unlock_window_started_at: string | null
          vault_unlock_approved: boolean | null
        }
        Insert: {
          access_expires_at?: string | null
          certificate_storage_path: string
          client_id: string
          id?: string
          identity_check_id?: string | null
          identity_verified?: boolean | null
          notes?: string | null
          otp_email_attempts?: number | null
          otp_email_expires_at?: string | null
          otp_email_hash?: string | null
          otp_sms_attempts?: number | null
          owner_veto_token_hash?: string | null
          owner_vetoed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_c_hash?: string | null
          status?: string
          submitted_at?: string
          trustee_access_token_hash?: string | null
          trustee_email: string
          trustee_email_notified_at?: string | null
          trustee_id?: string | null
          unlock_window_expires_at?: string | null
          unlock_window_started_at?: string | null
          vault_unlock_approved?: boolean | null
        }
        Update: {
          access_expires_at?: string | null
          certificate_storage_path?: string
          client_id?: string
          id?: string
          identity_check_id?: string | null
          identity_verified?: boolean | null
          notes?: string | null
          otp_email_attempts?: number | null
          otp_email_expires_at?: string | null
          otp_email_hash?: string | null
          otp_sms_attempts?: number | null
          owner_veto_token_hash?: string | null
          owner_vetoed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_c_hash?: string | null
          status?: string
          submitted_at?: string
          trustee_access_token_hash?: string | null
          trustee_email?: string
          trustee_email_notified_at?: string | null
          trustee_id?: string | null
          unlock_window_expires_at?: string | null
          unlock_window_started_at?: string | null
          vault_unlock_approved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "farewell_verification_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farewell_verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farewell_verification_requests_trustee_id_fkey"
            columns: ["trustee_id"]
            isOneToOne: false
            referencedRelation: "vault_trustees"
            referencedColumns: ["id"]
          },
        ]
      }
      item_shares: {
        Row: {
          created_at: string
          enc_version: number
          id: string
          item_id: string
          owner_client_id: string
          recipient_user_id: string
          revoked_at: string | null
          sender_pubkey: string
          wrapped_dek: string
        }
        Insert: {
          created_at?: string
          enc_version?: number
          id?: string
          item_id: string
          owner_client_id: string
          recipient_user_id: string
          revoked_at?: string | null
          sender_pubkey: string
          wrapped_dek: string
        }
        Update: {
          created_at?: string
          enc_version?: number
          id?: string
          item_id?: string
          owner_client_id?: string
          recipient_user_id?: string
          revoked_at?: string | null
          sender_pubkey?: string
          wrapped_dek?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_shares_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "vault_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_shares_owner_client_id_fkey"
            columns: ["owner_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_assets: {
        Row: {
          asset_name: string
          asset_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          platform: string | null
          storage_path: string
        }
        Insert: {
          asset_name: string
          asset_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string | null
          storage_path: string
        }
        Update: {
          asset_name?: string
          asset_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string | null
          storage_path?: string
        }
        Relationships: []
      }
      marketing_materials: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_size_bytes: number | null
          id: string
          is_global: boolean
          mime_type: string | null
          partner_slug: string | null
          platform: string | null
          sort_order: number
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          id?: string
          is_global?: boolean
          mime_type?: string | null
          partner_slug?: string | null
          platform?: string | null
          sort_order?: number
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_size_bytes?: number | null
          id?: string
          is_global?: boolean
          mime_type?: string | null
          partner_slug?: string | null
          platform?: string | null
          sort_order?: number
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          acknowledgment_signed: boolean | null
          acknowledgment_signed_at: string | null
          affiliate_cut: number | null
          affiliate_id: string | null
          amendment_fields: Json | null
          amendment_summary: string | null
          amendment_target: string | null
          amendment_type: string | null
          amount_total: number
          attorney_cut: number | null
          attorney_review_requested: boolean | null
          client_id: string | null
          complexity_flag: boolean | null
          complexity_flag_reason: string | null
          created_at: string | null
          ev_cut: number
          expires_at: string | null
          id: string
          intake_data: Json | null
          order_type: string | null
          parent_order_id: string | null
          partner_cut: number | null
          partner_id: string | null
          product_type: string
          quiz_session_id: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledgment_signed?: boolean | null
          acknowledgment_signed_at?: string | null
          affiliate_cut?: number | null
          affiliate_id?: string | null
          amendment_fields?: Json | null
          amendment_summary?: string | null
          amendment_target?: string | null
          amendment_type?: string | null
          amount_total: number
          attorney_cut?: number | null
          attorney_review_requested?: boolean | null
          client_id?: string | null
          complexity_flag?: boolean | null
          complexity_flag_reason?: string | null
          created_at?: string | null
          ev_cut: number
          expires_at?: string | null
          id?: string
          intake_data?: Json | null
          order_type?: string | null
          parent_order_id?: string | null
          partner_cut?: number | null
          partner_id?: string | null
          product_type: string
          quiz_session_id?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledgment_signed?: boolean | null
          acknowledgment_signed_at?: string | null
          affiliate_cut?: number | null
          affiliate_id?: string | null
          amendment_fields?: Json | null
          amendment_summary?: string | null
          amendment_target?: string | null
          amendment_type?: string | null
          amount_total?: number
          attorney_cut?: number | null
          attorney_review_requested?: boolean | null
          client_id?: string | null
          complexity_flag?: boolean | null
          complexity_flag_reason?: string | null
          created_at?: string | null
          ev_cut?: number
          expires_at?: string | null
          id?: string
          intake_data?: Json | null
          order_type?: string | null
          parent_order_id?: string | null
          partner_cut?: number | null
          partner_id?: string | null
          product_type?: string
          quiz_session_id?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_relationships: {
        Row: {
          child_commission_pct: number
          child_partner_id: string | null
          created_at: string | null
          id: string
          parent_commission_pct: number
          parent_partner_id: string | null
        }
        Insert: {
          child_commission_pct: number
          child_partner_id?: string | null
          created_at?: string | null
          id?: string
          parent_commission_pct: number
          parent_partner_id?: string | null
        }
        Update: {
          child_commission_pct?: number
          child_partner_id?: string | null
          created_at?: string | null
          id?: string
          parent_commission_pct?: number
          parent_partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_relationships_child_partner_id_fkey"
            columns: ["child_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_relationships_parent_partner_id_fkey"
            columns: ["parent_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          accent_color: string | null
          annual_fee_paid: boolean | null
          annual_fee_paid_at: string | null
          bar_number: string | null
          business_url: string | null
          certification_completed: boolean | null
          certification_completed_at: string | null
          company_name: string
          created_at: string | null
          created_by: string | null
          created_by_notes: string | null
          cta_text_override: string | null
          custom_domain: string | null
          custom_review_fee: number | null
          dns_records: Json | null
          domain_verified: boolean
          email_verified: boolean | null
          email_verified_at: string | null
          has_inhouse_estate_attorney: boolean | null
          hero_bg_override: string | null
          hero_recipe: string
          highlight_dark: string | null
          highlight_light: string | null
          id: string
          inhouse_review_attorney_id: string | null
          landing_text_color: string | null
          last_verify_check_at: string | null
          logo_url: string | null
          marketing_slug: string | null
          mfa_enabled: boolean | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          one_time_fee_amount: number | null
          one_time_fee_paid: boolean | null
          partner_revenue_pct: number | null
          partner_slug: string | null
          platform_fee_amount: number | null
          practice_areas: string[] | null
          product_name: string | null
          professional_type: string | null
          profile_id: string | null
          promo_code: string | null
          prospect_source: string | null
          resend_domain_id: string | null
          sender_domain: string | null
          sender_email: string | null
          sender_name: string | null
          status: string | null
          stripe_account_id: string | null
          subdomain: string | null
          theme_preset: string
          tier: string
          updated_at: string | null
          vault_subdomain: string | null
          vault_tagline: string | null
          vault_theme: string
        }
        Insert: {
          accent_color?: string | null
          annual_fee_paid?: boolean | null
          annual_fee_paid_at?: string | null
          bar_number?: string | null
          business_url?: string | null
          certification_completed?: boolean | null
          certification_completed_at?: string | null
          company_name: string
          created_at?: string | null
          created_by?: string | null
          created_by_notes?: string | null
          cta_text_override?: string | null
          custom_domain?: string | null
          custom_review_fee?: number | null
          dns_records?: Json | null
          domain_verified?: boolean
          email_verified?: boolean | null
          email_verified_at?: string | null
          has_inhouse_estate_attorney?: boolean | null
          hero_bg_override?: string | null
          hero_recipe?: string
          highlight_dark?: string | null
          highlight_light?: string | null
          id?: string
          inhouse_review_attorney_id?: string | null
          landing_text_color?: string | null
          last_verify_check_at?: string | null
          logo_url?: string | null
          marketing_slug?: string | null
          mfa_enabled?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          one_time_fee_amount?: number | null
          one_time_fee_paid?: boolean | null
          partner_revenue_pct?: number | null
          partner_slug?: string | null
          platform_fee_amount?: number | null
          practice_areas?: string[] | null
          product_name?: string | null
          professional_type?: string | null
          profile_id?: string | null
          promo_code?: string | null
          prospect_source?: string | null
          resend_domain_id?: string | null
          sender_domain?: string | null
          sender_email?: string | null
          sender_name?: string | null
          status?: string | null
          stripe_account_id?: string | null
          subdomain?: string | null
          theme_preset?: string
          tier?: string
          updated_at?: string | null
          vault_subdomain?: string | null
          vault_tagline?: string | null
          vault_theme?: string
        }
        Update: {
          accent_color?: string | null
          annual_fee_paid?: boolean | null
          annual_fee_paid_at?: string | null
          bar_number?: string | null
          business_url?: string | null
          certification_completed?: boolean | null
          certification_completed_at?: string | null
          company_name?: string
          created_at?: string | null
          created_by?: string | null
          created_by_notes?: string | null
          cta_text_override?: string | null
          custom_domain?: string | null
          custom_review_fee?: number | null
          dns_records?: Json | null
          domain_verified?: boolean
          email_verified?: boolean | null
          email_verified_at?: string | null
          has_inhouse_estate_attorney?: boolean | null
          hero_bg_override?: string | null
          hero_recipe?: string
          highlight_dark?: string | null
          highlight_light?: string | null
          id?: string
          inhouse_review_attorney_id?: string | null
          landing_text_color?: string | null
          last_verify_check_at?: string | null
          logo_url?: string | null
          marketing_slug?: string | null
          mfa_enabled?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          one_time_fee_amount?: number | null
          one_time_fee_paid?: boolean | null
          partner_revenue_pct?: number | null
          partner_slug?: string | null
          platform_fee_amount?: number | null
          practice_areas?: string[] | null
          product_name?: string | null
          professional_type?: string | null
          profile_id?: string | null
          promo_code?: string | null
          prospect_source?: string | null
          resend_domain_id?: string | null
          sender_domain?: string | null
          sender_email?: string | null
          sender_name?: string | null
          status?: string | null
          stripe_account_id?: string | null
          subdomain?: string | null
          theme_preset?: string
          tier?: string
          updated_at?: string | null
          vault_subdomain?: string | null
          vault_tagline?: string | null
          vault_theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_inhouse_review_attorney_id_fkey"
            columns: ["inhouse_review_attorney_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          orders_included: Json | null
          partner_id: string | null
          payout_date: string | null
          status: string | null
          stripe_transfer_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          orders_included?: Json | null
          partner_id?: string | null
          payout_date?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          orders_included?: Json | null
          partner_id?: string | null
          payout_date?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_leads: {
        Row: {
          bar_number: string | null
          client_count: string | null
          company_name: string | null
          created_at: string | null
          desired_review_fee: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          practice_areas: string | null
          professional_type: string | null
          referral_source: string | null
          status: string | null
        }
        Insert: {
          bar_number?: string | null
          client_count?: string | null
          company_name?: string | null
          created_at?: string | null
          desired_review_fee?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          practice_areas?: string | null
          professional_type?: string | null
          referral_source?: string | null
          status?: string | null
        }
        Update: {
          bar_number?: string | null
          client_count?: string | null
          company_name?: string | null
          created_at?: string | null
          desired_review_fee?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          practice_areas?: string | null
          professional_type?: string | null
          referral_source?: string | null
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bar_number: string | null
          bar_verified: boolean | null
          bar_verified_at: string | null
          commission_rate: number | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_payroll: boolean | null
          last_login_at: string | null
          managed_by_admin: string | null
          notification_preferences: Json | null
          phone: string | null
          requires_password_change: boolean | null
          state: string | null
          updated_at: string | null
          user_type: string
          vault_pin_hash: string | null
        }
        Insert: {
          bar_number?: string | null
          bar_verified?: boolean | null
          bar_verified_at?: string | null
          commission_rate?: number | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_payroll?: boolean | null
          last_login_at?: string | null
          managed_by_admin?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          requires_password_change?: boolean | null
          state?: string | null
          updated_at?: string | null
          user_type?: string
          vault_pin_hash?: string | null
        }
        Update: {
          bar_number?: string | null
          bar_verified?: boolean | null
          bar_verified_at?: string | null
          commission_rate?: number | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_payroll?: boolean | null
          last_login_at?: string | null
          managed_by_admin?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          requires_password_change?: boolean | null
          state?: string | null
          updated_at?: string | null
          user_type?: string
          vault_pin_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_managed_by_admin_fkey"
            columns: ["managed_by_admin"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          answers: Json
          answers_purged_at: string | null
          client_id: string | null
          completed: boolean | null
          created_at: string | null
          hard_stop_reason: string | null
          hard_stop_triggered: boolean | null
          id: string
          partner_id: string | null
          recommendation: string | null
          updated_at: string | null
        }
        Insert: {
          answers?: Json
          answers_purged_at?: string | null
          client_id?: string | null
          completed?: boolean | null
          created_at?: string | null
          hard_stop_reason?: string | null
          hard_stop_triggered?: boolean | null
          id?: string
          partner_id?: string | null
          recommendation?: string | null
          updated_at?: string | null
        }
        Update: {
          answers?: Json
          answers_purged_at?: string | null
          client_id?: string | null
          completed?: boolean | null
          created_at?: string | null
          hard_stop_reason?: string | null
          hard_stop_triggered?: boolean | null
          id?: string
          partner_id?: string | null
          recommendation?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          partner_id: string | null
          reason: string
          referral_fee: number | null
          referral_fee_paid: boolean | null
          status: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          partner_id?: string | null
          reason: string
          referral_fee?: number | null
          referral_fee_paid?: boolean | null
          status?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          partner_id?: string | null
          reason?: string
          referral_fee?: number | null
          referral_fee_paid?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_partner_notes: {
        Row: {
          created_at: string | null
          id: string
          note: string
          partner_id: string | null
          sales_rep_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note: string
          partner_id?: string | null
          sales_rep_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          partner_id?: string | null
          sales_rep_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_partner_notes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_notes_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_prospect_activity: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          prospect_id: string | null
          sales_rep_id: string | null
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          prospect_id?: string | null
          sales_rep_id?: string | null
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          prospect_id?: string | null
          sales_rep_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_prospect_activity_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prospect_activity_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_prospects: {
        Row: {
          company_name: string
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          last_contacted_at: string | null
          next_action_at: string | null
          notes: string | null
          phone: string | null
          professional_type: string | null
          sales_rep_id: string | null
          source: string | null
          stage: string | null
          updated_at: string | null
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          next_action_at?: string | null
          notes?: string | null
          phone?: string | null
          professional_type?: string | null
          sales_rep_id?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          next_action_at?: string | null
          notes?: string | null
          phone?: string | null
          professional_type?: string | null
          sales_rep_id?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_prospects_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      trustee_access_audit: {
        Row: {
          action: string
          client_id: string | null
          created_at: string | null
          id: string
          ip: unknown
          metadata: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
          trustee_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          ip?: unknown
          metadata?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          trustee_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          ip?: unknown
          metadata?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          trustee_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trustee_access_audit_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trustee_access_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "farewell_verification_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trustee_access_audit_trustee_id_fkey"
            columns: ["trustee_id"]
            isOneToOne: false
            referencedRelation: "vault_trustees"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_items: {
        Row: {
          auto_generated: boolean
          backfilled_at: string | null
          category: string
          ciphertext: string | null
          client_id: string | null
          created_at: string | null
          data: Json
          enc_version: number | null
          id: string
          is_encrypted: boolean | null
          label: string
          label_blind: string | null
          nonce: string | null
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          auto_generated?: boolean
          backfilled_at?: string | null
          category: string
          ciphertext?: string | null
          client_id?: string | null
          created_at?: string | null
          data?: Json
          enc_version?: number | null
          id?: string
          is_encrypted?: boolean | null
          label: string
          label_blind?: string | null
          nonce?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_generated?: boolean
          backfilled_at?: string | null
          category?: string
          ciphertext?: string | null
          client_id?: string | null
          created_at?: string | null
          data?: Json
          enc_version?: number | null
          id?: string
          is_encrypted?: boolean | null
          label?: string
          label_blind?: string | null
          nonce?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_trustees: {
        Row: {
          access_granted: boolean | null
          access_granted_at: string | null
          access_requested_at: string | null
          access_scope: Json | null
          active: boolean | null
          backfilled_at: string | null
          ciphertext: string | null
          client_id: string | null
          confirmed_at: string | null
          created_at: string | null
          email_blind: string | null
          enc_version: number | null
          id: string
          invite_sent_at: string | null
          invite_token: string | null
          nonce: string | null
          phone_blind: string | null
          status: string
          trustee_email: string
          trustee_name: string
          trustee_phone: string | null
          trustee_relationship: string | null
          verified: boolean | null
        }
        Insert: {
          access_granted?: boolean | null
          access_granted_at?: string | null
          access_requested_at?: string | null
          access_scope?: Json | null
          active?: boolean | null
          backfilled_at?: string | null
          ciphertext?: string | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          email_blind?: string | null
          enc_version?: number | null
          id?: string
          invite_sent_at?: string | null
          invite_token?: string | null
          nonce?: string | null
          phone_blind?: string | null
          status?: string
          trustee_email: string
          trustee_name: string
          trustee_phone?: string | null
          trustee_relationship?: string | null
          verified?: boolean | null
        }
        Update: {
          access_granted?: boolean | null
          access_granted_at?: string | null
          access_requested_at?: string | null
          access_scope?: Json | null
          active?: boolean | null
          backfilled_at?: string | null
          ciphertext?: string | null
          client_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          email_blind?: string | null
          enc_version?: number | null
          id?: string
          invite_sent_at?: string | null
          invite_token?: string | null
          nonce?: string | null
          phone_blind?: string | null
          status?: string
          trustee_email?: string
          trustee_name?: string
          trustee_phone?: string | null
          trustee_relationship?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_trustees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_invites: {
        Row: {
          client_email: string
          id: string
          invited_at: string | null
          launched: boolean | null
          partner_id: string | null
        }
        Insert: {
          client_email: string
          id?: string
          invited_at?: string | null
          launched?: boolean | null
          partner_id?: string | null
        }
        Update: {
          client_email?: string
          id?: string
          invited_at?: string | null
          launched?: boolean | null
          partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_invites_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_get_kek: { Args: { p_name?: string }; Returns: string }
      exec_sql: { Args: { sql: string }; Returns: Json }
      find_auth_user_by_email: {
        Args: { lookup_email: string }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_affiliate_id: { Args: never; Returns: string }
      increment_otp_attempt: {
        Args: { p_request_id: string; p_max: number }
        Returns: number
      }
      get_client_id: { Args: never; Returns: string }
      get_partner_id: { Args: never; Returns: string }
      get_partner_login_target: {
        Args: { p_partner_id: string }
        Returns: {
          company_name: string
          custom_domain: string
          subdomain: string
          vault_subdomain: string
        }[]
      }
      get_user_type: { Args: never; Returns: string }
      increment_affiliate_clicks: {
        Args: { p_affiliate_id: string }
        Returns: undefined
      }
      increment_affiliate_stats: {
        Args: { p_affiliate_id: string; p_earned_cents: number }
        Returns: undefined
      }
      slugify_simple: { Args: { input: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
