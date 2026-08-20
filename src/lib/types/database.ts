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
