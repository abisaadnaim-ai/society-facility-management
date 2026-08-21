export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      fm_categories: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string | null
          description: string | null
          parent_category_id: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code?: string | null
          description?: string | null
          parent_category_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string | null
          description?: string | null
          parent_category_id?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fm_priorities: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string
          description: string | null
          response_target_minutes: number | null
          resolution_target_minutes: number | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code: string
          description?: string | null
          response_target_minutes?: number | null
          resolution_target_minutes?: number | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string
          description?: string | null
          response_target_minutes?: number | null
          resolution_target_minutes?: number | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fm_request_statuses: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_order_statuses: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string
          description?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fm_requests: {
        Row: {
          id: string
          organization_id: string
          request_number: string
          location_id: string
          area_id: string | null
          asset_id: string | null
          category_id: string
          priority_id: string | null
          status_id: string
          title: string
          description: string | null
          exact_location_notes: string | null
          requested_by: string
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          cancellation_reason: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          request_number?: string
          location_id: string
          area_id?: string | null
          asset_id?: string | null
          category_id: string
          priority_id?: string | null
          status_id: string
          title: string
          description?: string | null
          exact_location_notes?: string | null
          requested_by: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          cancellation_reason?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          request_number?: string
          location_id?: string
          area_id?: string | null
          asset_id?: string | null
          category_id?: string
          priority_id?: string | null
          status_id?: string
          title?: string
          description?: string | null
          exact_location_notes?: string | null
          requested_by?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          cancellation_reason?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fm_request_comments: {
        Row: {
          id: string
          organization_id: string
          request_id: string
          author_id: string
          body: string
          is_internal: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          request_id: string
          author_id: string
          body: string
          is_internal?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          request_id?: string
          author_id?: string
          body?: string
          is_internal?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fm_request_attachments: {
        Row: {
          id: string
          organization_id: string
          request_id: string
          file_name: string
          file_path: string
          file_type: string | null
          file_size: number | null
          attachment_type: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          request_id: string
          file_name: string
          file_path: string
          file_type?: string | null
          file_size?: number | null
          attachment_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          request_id?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          file_size?: number | null
          attachment_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      fm_request_activity: {
        Row: {
          id: string
          organization_id: string
          request_id: string
          actor_id: string | null
          action: string
          field_name: string | null
          old_value: string | null
          new_value: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          request_id: string
          actor_id?: string | null
          action: string
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          request_id?: string
          actor_id?: string | null
          action?: string
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          id: string
          organization_id: string
          work_order_number: string
          fm_request_id: string | null
          source: string
          ppm_plan_id: string | null
          ppm_occurrence_id: string | null
          location_id: string
          area_id: string | null
          asset_id: string | null
          category_id: string
          priority_id: string
          status_id: string
          title: string
          description: string | null
          assigned_to: string | null
          created_by: string
          due_date: string | null
          started_at: string | null
          completed_at: string | null
          completion_notes: string | null
          verified_by: string | null
          verified_at: string | null
          verification_notes: string | null
          closed_by: string | null
          closed_at: string | null
          cancellation_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          work_order_number?: string
          fm_request_id?: string | null
          source?: string
          ppm_plan_id?: string | null
          ppm_occurrence_id?: string | null
          location_id: string
          area_id?: string | null
          asset_id?: string | null
          category_id: string
          priority_id: string
          status_id: string
          title: string
          description?: string | null
          assigned_to?: string | null
          created_by: string
          due_date?: string | null
          started_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          verified_by?: string | null
          verified_at?: string | null
          verification_notes?: string | null
          closed_by?: string | null
          closed_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          work_order_number?: string
          fm_request_id?: string | null
          source?: string
          ppm_plan_id?: string | null
          ppm_occurrence_id?: string | null
          location_id?: string
          area_id?: string | null
          asset_id?: string | null
          category_id?: string
          priority_id?: string
          status_id?: string
          title?: string
          description?: string | null
          assigned_to?: string | null
          created_by?: string
          due_date?: string | null
          started_at?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          verified_by?: string | null
          verified_at?: string | null
          verification_notes?: string | null
          closed_by?: string | null
          closed_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ppm_plans: {
        Row: {
          id: string
          organization_id: string
          ppm_number: string
          asset_id: string
          category_id: string
          name: string
          description: string | null
          maintenance_instructions: string | null
          priority_id: string
          frequency_unit: string
          frequency_interval: number
          start_date: string
          next_due_date: string
          last_completed_at: string | null
          default_assigned_to: string | null
          estimated_duration_minutes: number | null
          lead_time_days: number
          due_window_days: number | null
          status: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ppm_number?: string
          asset_id: string
          category_id: string
          name: string
          description?: string | null
          maintenance_instructions?: string | null
          priority_id: string
          frequency_unit: string
          frequency_interval: number
          start_date: string
          next_due_date: string
          last_completed_at?: string | null
          default_assigned_to?: string | null
          estimated_duration_minutes?: number | null
          lead_time_days?: number
          due_window_days?: number | null
          status?: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          ppm_number?: string
          asset_id?: string
          category_id?: string
          name?: string
          description?: string | null
          maintenance_instructions?: string | null
          priority_id?: string
          frequency_unit?: string
          frequency_interval?: number
          start_date?: string
          next_due_date?: string
          last_completed_at?: string | null
          default_assigned_to?: string | null
          estimated_duration_minutes?: number | null
          lead_time_days?: number
          due_window_days?: number | null
          status?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ppm_plan_tasks: {
        Row: {
          id: string
          organization_id: string
          ppm_plan_id: string
          task_description: string
          instructions: string | null
          is_required: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ppm_plan_id: string
          task_description: string
          instructions?: string | null
          is_required?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          ppm_plan_id?: string
          task_description?: string
          instructions?: string | null
          is_required?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ppm_occurrences: {
        Row: {
          id: string
          organization_id: string
          ppm_plan_id: string
          scheduled_date: string
          due_date: string
          status: string
          work_order_id: string | null
          generated_at: string | null
          completed_at: string | null
          skipped_at: string | null
          skipped_by: string | null
          skip_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ppm_plan_id: string
          scheduled_date: string
          due_date: string
          status?: string
          work_order_id?: string | null
          generated_at?: string | null
          completed_at?: string | null
          skipped_at?: string | null
          skipped_by?: string | null
          skip_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          ppm_plan_id?: string
          scheduled_date?: string
          due_date?: string
          status?: string
          work_order_id?: string | null
          generated_at?: string | null
          completed_at?: string | null
          skipped_at?: string | null
          skipped_by?: string | null
          skip_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_order_tasks: {
        Row: {
          id: string
          organization_id: string
          work_order_id: string
          ppm_plan_task_id: string | null
          task_description: string
          instructions: string | null
          is_required: boolean
          is_completed: boolean
          completed_by: string | null
          completed_at: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          work_order_id: string
          ppm_plan_task_id?: string | null
          task_description: string
          instructions?: string | null
          is_required?: boolean
          is_completed?: boolean
          completed_by?: string | null
          completed_at?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          work_order_id?: string
          ppm_plan_task_id?: string | null
          task_description?: string
          instructions?: string | null
          is_required?: boolean
          is_completed?: boolean
          completed_by?: string | null
          completed_at?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ppm_activity: {
        Row: {
          id: string
          organization_id: string
          ppm_plan_id: string | null
          occurrence_id: string | null
          actor_id: string | null
          is_system: boolean
          action: string
          field_name: string | null
          old_value: string | null
          new_value: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ppm_plan_id?: string | null
          occurrence_id?: string | null
          actor_id?: string | null
          is_system?: boolean
          action: string
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          ppm_plan_id?: string | null
          occurrence_id?: string | null
          actor_id?: string | null
          is_system?: boolean
          action?: string
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      work_order_comments: {
        Row: {
          id: string
          organization_id: string
          work_order_id: string
          author_id: string
          body: string
          is_internal: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          work_order_id: string
          author_id: string
          body: string
          is_internal?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          work_order_id?: string
          author_id?: string
          body?: string
          is_internal?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_order_attachments: {
        Row: {
          id: string
          organization_id: string
          work_order_id: string
          file_name: string
          file_path: string
          file_type: string | null
          file_size: number | null
          attachment_type: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          work_order_id: string
          file_name: string
          file_path: string
          file_type?: string | null
          file_size?: number | null
          attachment_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          work_order_id?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          file_size?: number | null
          attachment_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      work_order_activity: {
        Row: {
          id: string
          organization_id: string
          work_order_id: string
          actor_id: string | null
          action: string
          field_name: string | null
          old_value: string | null
          new_value: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          work_order_id: string
          actor_id?: string | null
          action: string
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          work_order_id?: string
          actor_id?: string | null
          action?: string
          field_name?: string | null
          old_value?: string | null
          new_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      areas: {
        Row: {
          area_type: string | null
          code: string | null
          created_at: string
          description: string | null
          floor_or_level: string | null
          id: string
          is_active: boolean
          location_id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          area_type?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          floor_or_level?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area_type?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          floor_or_level?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_activity: {
        Row: {
          action: string
          actor_id: string | null
          asset_id: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          asset_id: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          asset_id?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_activity_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_activity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_attachments: {
        Row: {
          asset_id: string
          attachment_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          organization_id: string
          uploaded_by: string | null
        }
        Insert: {
          asset_id: string
          attachment_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id: string
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string
          attachment_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_attachments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          parent_category_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          parent_category_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          parent_category_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_statuses: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          area_id: string
          asset_code: string | null
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expected_life_years: number | null
          id: string
          installation_date: string | null
          is_active: boolean
          location_id: string
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          purchase_date: string | null
          serial_number: string | null
          status_id: string
          supplier_name: string | null
          updated_at: string
          warranty_expiry: string | null
        }
        Insert: {
          area_id: string
          asset_code?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_life_years?: number | null
          id?: string
          installation_date?: string | null
          is_active?: boolean
          location_id: string
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          purchase_date?: string | null
          serial_number?: string | null
          status_id: string
          supplier_name?: string | null
          updated_at?: string
          warranty_expiry?: string | null
        }
        Update: {
          area_id?: string
          asset_code?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_life_years?: number | null
          id?: string
          installation_date?: string | null
          is_active?: boolean
          location_id?: string
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          purchase_date?: string | null
          serial_number?: string | null
          status_id?: string
          supplier_name?: string | null
          updated_at?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "asset_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          is_protected: boolean
          location_type: string | null
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_protected?: boolean
          location_type?: string | null
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_protected?: boolean
          location_type?: string | null
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          organization_id: string
          phone: string | null
          primary_location_id: string | null
          role_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          organization_id: string
          phone?: string | null
          primary_location_id?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          organization_id?: string
          phone?: string | null
          primary_location_id?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_fm_request_activity: {
        Args: {
          p_request_id: string
          p_action: string
          p_field_name?: string
          p_old_value?: string
          p_new_value?: string
          p_metadata?: Json
        }
        Returns: string
      }
      log_work_order_activity: {
        Args: {
          p_work_order_id: string
          p_action: string
          p_field_name?: string
          p_old_value?: string
          p_new_value?: string
          p_metadata?: Json
        }
        Returns: string
      }
      can_manage_configuration: { Args: never; Returns: boolean }
      can_manage_facility: { Args: never; Returns: boolean }
      can_read_facility: { Args: never; Returns: boolean }
      current_user_is_active: { Args: never; Returns: boolean }
      current_user_organization_id: { Args: never; Returns: string }
      current_user_role_code: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      log_asset_activity: {
        Args: {
          p_action: string
          p_asset_id: string
          p_field_name?: string
          p_new_value?: string
          p_old_value?: string
        }
        Returns: string
      }
      admin_list_users: {
        Args: never
        Returns: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          job_title: string | null
          role_id: string | null
          role_code: string | null
          role_name: string | null
          primary_location_id: string | null
          location_name: string | null
          is_active: boolean
          created_at: string
          last_sign_in_at: string | null
        }[]
      }
      admin_get_user: {
        Args: { p_id: string }
        Returns: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          job_title: string | null
          role_id: string | null
          role_code: string | null
          role_name: string | null
          primary_location_id: string | null
          location_name: string | null
          is_active: boolean
          created_at: string
          last_sign_in_at: string | null
          fm_requests_submitted: number
          work_orders_assigned: number
        }[]
      }
      admin_invite_user: {
        Args: {
          p_full_name: string
          p_email: string
          p_role_id: string
          p_phone?: string | null
          p_job_title?: string | null
          p_primary_location_id?: string | null
          p_is_active?: boolean
        }
        Returns: Json
      }
      admin_update_user: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_phone: string | null
          p_job_title: string | null
          p_role_id: string
          p_primary_location_id: string | null
          p_is_active: boolean
        }
        Returns: Json
      }
      admin_reset_password: { Args: { p_user_id: string }; Returns: Json }
      admin_change_email: { Args: { p_user_id: string; p_email: string }; Returns: Json }
      ppm_generate_now: { Args: { p_occurrence_id: string }; Returns: string }
      ppm_skip_occurrence: { Args: { p_occurrence_id: string; p_reason: string }; Returns: undefined }
      ppm_set_plan_status: { Args: { p_plan_id: string; p_status: string }; Returns: undefined }
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
  public: {
    Enums: {},
  },
} as const
