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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      correction_rules: {
        Row: {
          applied_count: number
          correct: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_applied_at: string | null
          lesson: string
          master_profile_id: string | null
          region: Database["public"]["Enums"]["region_t"]
          scene_pattern: string
          source_correction_id: string | null
          wrong: string
        }
        Insert: {
          applied_count?: number
          correct: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_applied_at?: string | null
          lesson: string
          master_profile_id?: string | null
          region: Database["public"]["Enums"]["region_t"]
          scene_pattern: string
          source_correction_id?: string | null
          wrong: string
        }
        Update: {
          applied_count?: number
          correct?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_applied_at?: string | null
          lesson?: string
          master_profile_id?: string | null
          region?: Database["public"]["Enums"]["region_t"]
          scene_pattern?: string
          source_correction_id?: string | null
          wrong?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_rules_master_profile_id_fkey"
            columns: ["master_profile_id"]
            isOneToOne: false
            referencedRelation: "master_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_rules_source_correction_id_fkey"
            columns: ["source_correction_id"]
            isOneToOne: false
            referencedRelation: "corrections"
            referencedColumns: ["id"]
          },
        ]
      }
      corrections: {
        Row: {
          bolge: Database["public"]["Enums"]["region_t"]
          correct: string
          created_at: string
          created_by: string | null
          id: string
          lesson: string
          scene: string
          usta: string
          wrong: string
        }
        Insert: {
          bolge: Database["public"]["Enums"]["region_t"]
          correct: string
          created_at?: string
          created_by?: string | null
          id?: string
          lesson: string
          scene: string
          usta: string
          wrong: string
        }
        Update: {
          bolge?: Database["public"]["Enums"]["region_t"]
          correct?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lesson?: string
          scene?: string
          usta?: string
          wrong?: string
        }
        Relationships: []
      }
      learning_cases: {
        Row: {
          alarm: string
          bolge: Database["public"]["Enums"]["region_t"]
          created_at: string
          created_by: string | null
          diagnosis: string
          id: string
          month: string
          success: boolean
          usta: string
        }
        Insert: {
          alarm: string
          bolge: Database["public"]["Enums"]["region_t"]
          created_at?: string
          created_by?: string | null
          diagnosis: string
          id?: string
          month: string
          success?: boolean
          usta: string
        }
        Update: {
          alarm?: string
          bolge?: Database["public"]["Enums"]["region_t"]
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          id?: string
          month?: string
          success?: boolean
          usta?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          alert_text: string | null
          city: string
          code: string
          created_at: string
          district: string
          id: string
          last_service: string | null
          model: string
          name: string
          next_maintenance: string | null
          operating_hours: number
          region: Database["public"]["Enums"]["region_t"]
          serial_no: string | null
          status: string
          year: number | null
        }
        Insert: {
          alert_text?: string | null
          city: string
          code: string
          created_at?: string
          district: string
          id?: string
          last_service?: string | null
          model: string
          name: string
          next_maintenance?: string | null
          operating_hours?: number
          region: Database["public"]["Enums"]["region_t"]
          serial_no?: string | null
          status?: string
          year?: number | null
        }
        Update: {
          alert_text?: string | null
          city?: string
          code?: string
          created_at?: string
          district?: string
          id?: string
          last_service?: string | null
          model?: string
          name?: string
          next_maintenance?: string | null
          operating_hours?: number
          region?: Database["public"]["Enums"]["region_t"]
          serial_no?: string | null
          status?: string
          year?: number | null
        }
        Relationships: []
      }
      master_profiles: {
        Row: {
          city: string
          created_at: string
          created_by: string | null
          domain: string
          experience_years: number
          id: string
          is_active: boolean
          name: string
          persona_md: string
          region: Database["public"]["Enums"]["region_t"]
          updated_at: string
          version: number
          work_md: string
        }
        Insert: {
          city: string
          created_at?: string
          created_by?: string | null
          domain?: string
          experience_years?: number
          id?: string
          is_active?: boolean
          name: string
          persona_md?: string
          region: Database["public"]["Enums"]["region_t"]
          updated_at?: string
          version?: number
          work_md?: string
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string | null
          domain?: string
          experience_years?: number
          id?: string
          is_active?: boolean
          name?: string
          persona_md?: string
          region?: Database["public"]["Enums"]["region_t"]
          updated_at?: string
          version?: number
          work_md?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          client: string
          created_at: string
          full_name: string
          id: string
          region: Database["public"]["Enums"]["region_t"]
        }
        Insert: {
          client?: string
          created_at?: string
          full_name: string
          id: string
          region?: Database["public"]["Enums"]["region_t"]
        }
        Update: {
          client?: string
          created_at?: string
          full_name?: string
          id?: string
          region?: Database["public"]["Enums"]["region_t"]
        }
        Relationships: []
      }
      repair_videos: {
        Row: {
          created_at: string
          created_by: string | null
          duration_sec: number | null
          error_msg: string | null
          id: string
          learning_case_id: string | null
          machine_id: string | null
          region: Database["public"]["Enums"]["region_t"] | null
          sop_steps: Json
          status: string
          storage_path: string
          summary: string | null
          transcript: string | null
          updated_at: string
          wo_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          error_msg?: string | null
          id?: string
          learning_case_id?: string | null
          machine_id?: string | null
          region?: Database["public"]["Enums"]["region_t"] | null
          sop_steps?: Json
          status?: string
          storage_path: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
          wo_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          error_msg?: string | null
          id?: string
          learning_case_id?: string | null
          machine_id?: string | null
          region?: Database["public"]["Enums"]["region_t"] | null
          sop_steps?: Json
          status?: string
          storage_path?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
          wo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_videos_learning_case_id_fkey"
            columns: ["learning_case_id"]
            isOneToOne: false
            referencedRelation: "learning_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_videos_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_videos_wo_id_fkey"
            columns: ["wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          city: string
          created_at: string
          experience_years: number
          full_name: string
          id: string
          region: Database["public"]["Enums"]["region_t"]
          specialty: string | null
        }
        Insert: {
          city: string
          created_at?: string
          experience_years: number
          full_name: string
          id?: string
          region: Database["public"]["Enums"]["region_t"]
          specialty?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          experience_years?: number
          full_name?: string
          id?: string
          region?: Database["public"]["Enums"]["region_t"]
          specialty?: string | null
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          alarm_code: string | null
          assignee_id: string | null
          badge: string
          closed_at: string | null
          closing_notes: string | null
          code: string
          complaint: string
          created_at: string
          description: string | null
          id: string
          machine_id: string
          parts: Json
          status: string
        }
        Insert: {
          alarm_code?: string | null
          assignee_id?: string | null
          badge?: string
          closed_at?: string | null
          closing_notes?: string | null
          code: string
          complaint: string
          created_at?: string
          description?: string | null
          id?: string
          machine_id: string
          parts?: Json
          status?: string
        }
        Update: {
          alarm_code?: string | null
          assignee_id?: string | null
          badge?: string
          closed_at?: string | null
          closing_notes?: string | null
          code?: string
          complaint?: string
          created_at?: string
          description?: string | null
          id?: string
          machine_id?: string
          parts?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      region_t: "Marmara" | "Ege" | "İç Anadolu"
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
    Enums: {
      region_t: ["Marmara", "Ege", "İç Anadolu"],
    },
  },
} as const
