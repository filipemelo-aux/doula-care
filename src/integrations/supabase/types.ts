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
          city: string | null
          companion_name: string | null
          companion_phone: string | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          plan: Database["public"]["Enums"]["plan_type"]
          plan_value: number | null
          pregnancy_weeks: number | null
          pregnancy_weeks_set_at: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          street: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          companion_name?: string | null
          companion_phone?: string | null
          cpf?: string | null
          created_at?: string
          full_name: string
          id?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_value?: number | null
          pregnancy_weeks?: number | null
          pregnancy_weeks_set_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          companion_name?: string | null
          companion_phone?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_value?: number | null
          pregnancy_weeks?: number | null
          pregnancy_weeks_set_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          street?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
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
          plan_type?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
        }
        Relationships: []
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
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
