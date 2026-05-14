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
      clients: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          dni: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          notes: string | null
          phone_country_code: string | null
          phone_number: string | null
          reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone_country_code?: string | null
          phone_number?: string | null
          reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone_country_code?: string | null
          phone_number?: string | null
          reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          loan_id: string
          number: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          loan_id: string
          number: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          loan_id?: string
          number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_evidences: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          loan_id: string
          mime_type: string
          size_bytes: number
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          loan_id: string
          mime_type: string
          size_bytes: number
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          loan_id?: string
          mime_type?: string
          size_bytes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_evidences_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          address: string | null
          amount_lent: number
          amount_returned: number
          amount_to_return: number
          concept: string | null
          confirmation_responded_at: string | null
          confirmation_sent_at: string | null
          confirmation_status: string
          confirmation_token: string | null
          confirmation_token_expires_at: string | null
          created_at: string
          dni: string | null
          email: string | null
          first_name: string | null
          frequency: string | null
          id: string
          last_name: string | null
          name: string
          operation_type: string
          otp_attempts: number
          otp_expires_at: string | null
          otp_hash: string | null
          otp_phone_validated: string | null
          otp_verified_at: string | null
          payment_type: string
          phone_country_code: string | null
          phone_number: string | null
          reference: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          amount_lent: number
          amount_returned?: number
          amount_to_return: number
          concept?: string | null
          confirmation_responded_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmation_token_expires_at?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          first_name?: string | null
          frequency?: string | null
          id?: string
          last_name?: string | null
          name: string
          operation_type?: string
          otp_attempts?: number
          otp_expires_at?: string | null
          otp_hash?: string | null
          otp_phone_validated?: string | null
          otp_verified_at?: string | null
          payment_type: string
          phone_country_code?: string | null
          phone_number?: string | null
          reference?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          amount_lent?: number
          amount_returned?: number
          amount_to_return?: number
          concept?: string | null
          confirmation_responded_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmation_token_expires_at?: string | null
          created_at?: string
          dni?: string | null
          email?: string | null
          first_name?: string | null
          frequency?: string | null
          id?: string
          last_name?: string | null
          name?: string
          operation_type?: string
          otp_attempts?: number
          otp_expires_at?: string | null
          otp_hash?: string | null
          otp_phone_validated?: string | null
          otp_verified_at?: string | null
          payment_type?: string
          phone_country_code?: string | null
          phone_number?: string | null
          reference?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments_history: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          installment_id: string | null
          loan_id: string
          notes: string | null
          payment_date: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          installment_id?: string | null
          loan_id: string
          notes?: string | null
          payment_date?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          installment_id?: string | null
          loan_id?: string
          notes?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_history_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_history_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepted_terms: boolean
          created_at: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_terms?: boolean
          created_at?: string
          email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_terms?: boolean
          created_at?: string
          email?: string
          id?: string
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
      get_installments_by_token: {
        Args: { _token: string }
        Returns: {
          amount: number
          due_date: string
          number: number
        }[]
      }
      get_loan_by_token: {
        Args: { _token: string }
        Returns: {
          amount_lent: number
          amount_to_return: number
          concept: string
          confirmation_responded_at: string
          confirmation_sent_at: string
          confirmation_status: string
          dni_required: boolean
          email_masked: string
          expired: boolean
          frequency: string
          id: string
          name: string
          num_installments: number
          operation_type: string
          otp_active: boolean
          otp_verified: boolean
          payment_type: string
          phone_masked: string
          start_date: string
        }[]
      }
      register_payment: {
        Args: { _amount: number; _loan_id: string; _notes?: string }
        Returns: string
      }
      request_confirmation_otp: { Args: { _loan_id: string }; Returns: string }
      respond_loan_confirmation: {
        Args: { _status: string; _token: string }
        Returns: boolean
      }
      verify_confirmation_dni: {
        Args: { _dni: string; _token: string }
        Returns: boolean
      }
      verify_confirmation_otp: {
        Args: { _code: string; _token: string }
        Returns: boolean
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
