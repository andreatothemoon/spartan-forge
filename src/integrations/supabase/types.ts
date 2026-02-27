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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      athlete_profiles: {
        Row: {
          created_at: string
          display_name: string
          dob: string | null
          hr_zones_json: Json | null
          id: string
          max_hr: number | null
          pace_zones_json: Json | null
          threshold_hr: number | null
          threshold_pace_sec_per_km: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          display_name?: string
          dob?: string | null
          hr_zones_json?: Json | null
          id?: string
          max_hr?: number | null
          pace_zones_json?: Json | null
          threshold_hr?: number | null
          threshold_pace_sec_per_km?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          display_name?: string
          dob?: string | null
          hr_zones_json?: Json | null
          id?: string
          max_hr?: number | null
          pace_zones_json?: Json | null
          threshold_hr?: number | null
          threshold_pace_sec_per_km?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      availability_profiles: {
        Row: {
          created_at: string
          days_available_json: Json
          id: string
          max_minutes_by_day_json: Json
          preferred_long_run_day: string
          start_date: string
          updated_at: string
          user_id: string
          weekend_long_run_avoid: boolean
        }
        Insert: {
          created_at?: string
          days_available_json?: Json
          id?: string
          max_minutes_by_day_json?: Json
          preferred_long_run_day?: string
          start_date?: string
          updated_at?: string
          user_id: string
          weekend_long_run_avoid?: boolean
        }
        Update: {
          created_at?: string
          days_available_json?: Json
          id?: string
          max_minutes_by_day_json?: Json
          preferred_long_run_day?: string
          start_date?: string
          updated_at?: string
          user_id?: string
          weekend_long_run_avoid?: boolean
        }
        Relationships: []
      }
      export_jobs: {
        Row: {
          created_at: string
          download_url: string | null
          error_message: string | null
          export_type: string
          id: string
          plan_id: string | null
          range_end: string
          range_start: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          export_type?: string
          id?: string
          plan_id?: string | null
          range_end: string
          range_start: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          export_type?: string
          id?: string
          plan_id?: string | null
          range_end?: string
          range_start?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          athlete_profile_id: string | null
          availability_profile_id: string | null
          created_at: string
          end_date: string
          id: string
          plan_name: string
          start_date: string
          status: string
          training_goal_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          athlete_profile_id?: string | null
          availability_profile_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          plan_name?: string
          start_date?: string
          status?: string
          training_goal_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          athlete_profile_id?: string | null
          availability_profile_id?: string | null
          created_at?: string
          end_date?: string
          id?: string
          plan_name?: string
          start_date?: string
          status?: string
          training_goal_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_availability_profile_id_fkey"
            columns: ["availability_profile_id"]
            isOneToOne: false
            referencedRelation: "availability_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_training_goal_id_fkey"
            columns: ["training_goal_id"]
            isOneToOne: false
            referencedRelation: "training_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      session_steps: {
        Row: {
          created_at: string
          duration_type: string
          duration_value: number
          id: string
          session_id: string
          step_notes: string | null
          step_order: number
          step_type: string
          target_hr_high_bpm: number | null
          target_hr_low_bpm: number | null
          target_pace_high_sec_per_km: number | null
          target_pace_low_sec_per_km: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_type?: string
          duration_value?: number
          id?: string
          session_id: string
          step_notes?: string | null
          step_order?: number
          step_type?: string
          target_hr_high_bpm?: number | null
          target_hr_low_bpm?: number | null
          target_pace_high_sec_per_km?: number | null
          target_pace_low_sec_per_km?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_type?: string
          duration_value?: number
          id?: string
          session_id?: string
          step_notes?: string | null
          step_order?: number
          step_type?: string
          target_hr_high_bpm?: number | null
          target_hr_low_bpm?: number | null
          target_pace_high_sec_per_km?: number | null
          target_pace_low_sec_per_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_steps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          notes: string | null
          plan_id: string
          primary_target: string
          session_date: string
          session_type: string
          title: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          plan_id: string
          primary_target?: string
          session_date: string
          session_type?: string
          title?: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          plan_id?: string
          primary_target?: string
          session_date?: string
          session_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          notes: string | null
          race_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_type?: string
          id?: string
          notes?: string | null
          race_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          notes?: string | null
          race_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
