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
      appointments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          owner_id: string | null
          scheduled_at: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          scheduled_at: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          scheduled_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          client_id: string
          created_at: string
          id: string
          message: string
          read: boolean | null
          read_by_client: boolean | null
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          read_by_client?: boolean | null
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          read_by_client?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          baby_names: string[] | null
          birth_date: string | null
          birth_height: number | null
          birth_occurred: boolean | null
          birth_time: string | null
          birth_weight: number | null
          city: string | null
          companion_name: string | null
          companion_phone: string | null
          cpf: string | null
          created_at: string
          dpp: string | null
          first_login: boolean | null
          full_name: string
          id: string
          labor_started_at: string | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          owner_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          plan: Database["public"]["Enums"]["plan_type"]
          plan_value: number | null
          preferred_name: string | null
          pregnancy_weeks: number | null
          pregnancy_weeks_set_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          street: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          baby_names?: string[] | null
          birth_date?: string | null
          birth_height?: number | null
          birth_occurred?: boolean | null
          birth_time?: string | null
          birth_weight?: number | null
          city?: string | null
          companion_name?: string | null
          companion_phone?: string | null
          cpf?: string | null
          created_at?: string
          dpp?: string | null
          first_login?: boolean | null
          full_name: string
          id?: string
          labor_started_at?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          owner_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_value?: number | null
          preferred_name?: string | null
          pregnancy_weeks?: number | null
          pregnancy_weeks_set_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          baby_names?: string[] | null
          birth_date?: string | null
          birth_height?: number | null
          birth_occurred?: boolean | null
          birth_time?: string | null
          birth_weight?: number | null
          city?: string | null
          companion_name?: string | null
          companion_phone?: string | null
          cpf?: string | null
          created_at?: string
          dpp?: string | null
          first_login?: boolean | null
          full_name?: string
          id?: string
          labor_started_at?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          owner_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_value?: number | null
          preferred_name?: string | null
          pregnancy_weeks?: number | null
          pregnancy_weeks_set_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      contractions: {
        Row: {
          client_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_paid: number
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          installment_number: number
          notes: string | null
          owner_id: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          total_installments: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          total_installments?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          total_installments?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_settings: {
        Row: {
          created_at: string
          default_value: number
          description: string | null
          features: string[] | null
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
          plan_type: Database["public"]["Enums"]["plan_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: number
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
          plan_type: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: number
          description?: string | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
        }
        Relationships: []
      }
      pregnancy_diary: {
        Row: {
          client_id: string
          content: string
          created_at: string
          emotion: string | null
          id: string
          observations: string | null
          read_by_admin: boolean
          symptoms: string[] | null
          updated_at: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          emotion?: string | null
          id?: string
          observations?: string | null
          read_by_admin?: boolean
          symptoms?: string[] | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          emotion?: string | null
          id?: string
          observations?: string | null
          read_by_admin?: boolean
          symptoms?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pregnancy_diary_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          budget_sent_at: string | null
          budget_value: number | null
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          rating: number | null
          rating_comment: string | null
          rating_photos: string[] | null
          responded_at: string | null
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          budget_sent_at?: string | null
          budget_value?: number | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          rating_comment?: string | null
          rating_photos?: string[] | null
          responded_at?: string | null
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          budget_sent_at?: string | null
          budget_value?: number | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          rating_comment?: string | null
          rating_photos?: string[] | null
          responded_at?: string | null
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          amount_received: number | null
          client_id: string | null
          created_at: string
          current_installment: number | null
          date: string
          description: string
          expense_category:
            | Database["public"]["Enums"]["expense_category"]
            | null
          expense_type: Database["public"]["Enums"]["expense_type"] | null
          id: string
          installment_value: number | null
          installments: number | null
          is_auto_generated: boolean | null
          notes: string | null
          owner_id: string | null
          payment_method:
            | Database["public"]["Enums"]["transaction_payment_method"]
            | null
          plan_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          amount_received?: number | null
          client_id?: string | null
          created_at?: string
          current_installment?: number | null
          date?: string
          description: string
          expense_category?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          expense_type?: Database["public"]["Enums"]["expense_type"] | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          is_auto_generated?: boolean | null
          notes?: string | null
          owner_id?: string | null
          payment_method?:
            | Database["public"]["Enums"]["transaction_payment_method"]
            | null
          plan_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_received?: number | null
          client_id?: string | null
          created_at?: string
          current_installment?: number | null
          date?: string
          description?: string
          expense_category?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          expense_type?: Database["public"]["Enums"]["expense_type"] | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          is_auto_generated?: boolean | null
          notes?: string | null
          owner_id?: string | null
          payment_method?:
            | Database["public"]["Enums"]["transaction_payment_method"]
            | null
          plan_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "client"
      client_status: "tentante" | "gestante" | "lactante"
      expense_category:
        | "social_media"
        | "filmmaker"
        | "marketing"
        | "material_hospitalar"
        | "material_escritorio"
        | "transporte"
        | "formacao"
        | "equipamentos"
        | "servicos_terceiros"
        | "outros"
      expense_type: "material_trabalho" | "servicos_contratados"
      payment_method: "pix" | "cartao" | "dinheiro" | "transferencia"
      payment_status: "pendente" | "pago" | "parcial"
      plan_type: "basico" | "intermediario" | "completo"
      transaction_payment_method:
        | "pix"
        | "cartao"
        | "dinheiro"
        | "transferencia"
        | "boleto"
      transaction_type: "receita" | "despesa"
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
      app_role: ["admin", "moderator", "user", "client"],
      client_status: ["tentante", "gestante", "lactante"],
      expense_category: [
        "social_media",
        "filmmaker",
        "marketing",
        "material_hospitalar",
        "material_escritorio",
        "transporte",
        "formacao",
        "equipamentos",
        "servicos_terceiros",
        "outros",
      ],
      expense_type: ["material_trabalho", "servicos_contratados"],
      payment_method: ["pix", "cartao", "dinheiro", "transferencia"],
      payment_status: ["pendente", "pago", "parcial"],
      plan_type: ["basico", "intermediario", "completo"],
      transaction_payment_method: [
        "pix",
        "cartao",
        "dinheiro",
        "transferencia",
        "boleto",
      ],
      transaction_type: ["receita", "despesa"],
    },
  },
} as const
