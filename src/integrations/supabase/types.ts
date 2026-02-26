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
      admin_settings: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          owner_id: string
          pix_beneficiary_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          owner_id: string
          pix_beneficiary_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          owner_id?: string
          pix_beneficiary_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string | null
          owner_id: string | null
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          scheduled_at: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          scheduled_at: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
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
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          read: boolean | null
          read_by_client: boolean | null
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          message: string
          organization_id?: string | null
          read?: boolean | null
          read_by_client?: boolean | null
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          message?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "client_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          custom_status: string | null
          dpp: string | null
          first_login: boolean | null
          full_name: string
          id: string
          labor_started_at: string | null
          neighborhood: string | null
          notes: string | null
          number: string | null
          organization_id: string | null
          owner_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          plan: Database["public"]["Enums"]["plan_type"]
          plan_setting_id: string | null
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
          custom_status?: string | null
          dpp?: string | null
          first_login?: boolean | null
          full_name: string
          id?: string
          labor_started_at?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id?: string | null
          owner_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_setting_id?: string | null
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
          custom_status?: string | null
          dpp?: string | null
          first_login?: boolean | null
          full_name?: string
          id?: string
          labor_started_at?: string | null
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id?: string | null
          owner_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          plan?: Database["public"]["Enums"]["plan_type"]
          plan_setting_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_plan_setting_id_fkey"
            columns: ["plan_setting_id"]
            isOneToOne: false
            referencedRelation: "plan_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      contractions: {
        Row: {
          client_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          organization_id: string | null
          read_by_admin: boolean
          started_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          organization_id?: string | null
          read_by_admin?: boolean
          started_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          organization_id?: string | null
          read_by_admin?: boolean
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
          {
            foreignKeyName: "contractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_services: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_billing: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          notify_on_create: boolean
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          reference_month: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          billing_cycle: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          notify_on_create?: boolean
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          reference_month: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          notify_on_create?: boolean
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          reference_month?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_billing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_notifications: {
        Row: {
          billing_id: string | null
          created_at: string
          id: string
          message: string
          organization_id: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          billing_id?: string | null
          created_at?: string
          id?: string
          message: string
          organization_id: string
          read?: boolean
          title: string
          type?: string
        }
        Update: {
          billing_id?: string | null
          created_at?: string
          id?: string
          message?: string
          organization_id?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_notifications_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "org_billing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_cycle: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          next_billing_date: string | null
          nome_exibicao: string | null
          plan: Database["public"]["Enums"]["org_plan"]
          primary_color: string | null
          responsible_email: string
          secondary_color: string | null
          status: Database["public"]["Enums"]["org_status"]
          updated_at: string
        }
        Insert: {
          billing_cycle?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          next_billing_date?: string | null
          nome_exibicao?: string | null
          plan?: Database["public"]["Enums"]["org_plan"]
          primary_color?: string | null
          responsible_email: string
          secondary_color?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Update: {
          billing_cycle?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          next_billing_date?: string | null
          nome_exibicao?: string | null
          plan?: Database["public"]["Enums"]["org_plan"]
          primary_color?: string | null
          responsible_email?: string
          secondary_color?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Relationships: []
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          owner_id?: string | null
          plan_type?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_plan_limits: {
        Row: {
          created_at: string
          export_reports: boolean
          id: string
          max_clients: number | null
          max_collaborators: number
          multi_collaborators: boolean
          plan: string
          push_notifications: boolean
          reports: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          export_reports?: boolean
          id?: string
          max_clients?: number | null
          max_collaborators?: number
          multi_collaborators?: boolean
          plan: string
          push_notifications?: boolean
          reports?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          export_reports?: boolean
          id?: string
          max_clients?: number | null
          max_collaborators?: number
          multi_collaborators?: boolean
          plan?: string
          push_notifications?: boolean
          reports?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_plan_pricing: {
        Row: {
          billing_cycle: string
          created_at: string
          id: string
          is_active: boolean
          plan: string
          price: number
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          id?: string
          is_active?: boolean
          plan: string
          price?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          id?: string
          is_active?: boolean
          plan?: string
          price?: number
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "pregnancy_diary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          updated_at: string
          user_id: string
          welcome_seen: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
          welcome_seen?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
          welcome_seen?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_type: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_type?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_type?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "service_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      get_user_organization_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "client" | "super_admin"
      client_status: "tentante" | "gestante" | "lactante" | "outro"
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
      org_plan: "free" | "pro" | "premium"
      org_status: "ativo" | "suspenso" | "pendente"
      payment_method: "pix" | "cartao" | "dinheiro" | "transferencia"
      payment_status: "pendente" | "pago" | "parcial"
      plan_type: "basico" | "intermediario" | "completo" | "avulso"
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
      app_role: ["admin", "moderator", "user", "client", "super_admin"],
      client_status: ["tentante", "gestante", "lactante", "outro"],
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
      org_plan: ["free", "pro", "premium"],
      org_status: ["ativo", "suspenso", "pendente"],
      payment_method: ["pix", "cartao", "dinheiro", "transferencia"],
      payment_status: ["pendente", "pago", "parcial"],
      plan_type: ["basico", "intermediario", "completo", "avulso"],
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
