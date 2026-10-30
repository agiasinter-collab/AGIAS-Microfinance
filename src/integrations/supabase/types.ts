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
      audit_log: {
        Row: {
          action: string
          admin_name: string
          created_at: string
          detail: string
          id: string
          target_user: string
        }
        Insert: {
          action: string
          admin_name: string
          created_at?: string
          detail: string
          id?: string
          target_user: string
        }
        Update: {
          action?: string
          admin_name?: string
          created_at?: string
          detail?: string
          id?: string
          target_user?: string
        }
        Relationships: []
      }
      beneficiaires: {
        Row: {
          activite: string | null
          adresse: string | null
          agent_id: string | null
          agent_name: string | null
          created_at: string
          credit_num: string | null
          dob: string | null
          dossier: string
          groupe: string | null
          id: string
          inscription: string | null
          montant: number
          nom: string
          notes: string | null
          paye: number
          pct: number
          photo_url: string | null
          quartier: string | null
          score: number
          statut: string
          taux: string | null
          tel: string | null
          total: number
          updated_at: string
          ville: string | null
        }
        Insert: {
          activite?: string | null
          adresse?: string | null
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          credit_num?: string | null
          dob?: string | null
          dossier: string
          groupe?: string | null
          id?: string
          inscription?: string | null
          montant?: number
          nom: string
          notes?: string | null
          paye?: number
          pct?: number
          photo_url?: string | null
          quartier?: string | null
          score?: number
          statut?: string
          taux?: string | null
          tel?: string | null
          total?: number
          updated_at?: string
          ville?: string | null
        }
        Update: {
          activite?: string | null
          adresse?: string | null
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          credit_num?: string | null
          dob?: string | null
          dossier?: string
          groupe?: string | null
          id?: string
          inscription?: string | null
          montant?: number
          nom?: string
          notes?: string | null
          paye?: number
          pct?: number
          photo_url?: string | null
          quartier?: string | null
          score?: number
          statut?: string
          taux?: string | null
          tel?: string | null
          total?: number
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      documents_beneficiaire: {
        Row: {
          beneficiaire_id: string
          created_at: string
          file_name: string
          file_url: string
          id: string
          nom: string
          type: string
        }
        Insert: {
          beneficiaire_id: string
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          nom: string
          type?: string
        }
        Update: {
          beneficiaire_id?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          nom?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_beneficiaire_beneficiaire_id_fkey"
            columns: ["beneficiaire_id"]
            isOneToOne: false
            referencedRelation: "beneficiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_utilisateur: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          nom: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          nom: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          nom?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      echeances: {
        Row: {
          beneficiaire_id: string
          created_at: string
          date: string
          id: string
          paye: number
          prevu: number
          retard: number
          statut: string
        }
        Insert: {
          beneficiaire_id: string
          created_at?: string
          date: string
          id?: string
          paye?: number
          prevu?: number
          retard?: number
          statut?: string
        }
        Update: {
          beneficiaire_id?: string
          created_at?: string
          date?: string
          id?: string
          paye?: number
          prevu?: number
          retard?: number
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "echeances_beneficiaire_id_fkey"
            columns: ["beneficiaire_id"]
            isOneToOne: false
            referencedRelation: "beneficiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          created_at: string
          data: Json | null
          file_name: string | null
          file_url: string | null
          format: string
          generated_by: string
          generated_by_id: string
          id: string
          name: string
          period: string
          report_date: string
          report_type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          file_name?: string | null
          file_url?: string | null
          format?: string
          generated_by: string
          generated_by_id: string
          id?: string
          name: string
          period: string
          report_date?: string
          report_type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          file_name?: string | null
          file_url?: string | null
          format?: string
          generated_by?: string
          generated_by_id?: string
          id?: string
          name?: string
          period?: string
          report_date?: string
          report_type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          icon: string
          id: string
          read: boolean
          text: string
          time: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          read?: boolean
          text: string
          time: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          read?: boolean
          text?: string
          time?: string
          user_id?: string | null
        }
        Relationships: []
      }
      presidentes: {
        Row: {
          active: boolean
          agent_id: string | null
          agent_name: string | null
          created_at: string
          groupe: string | null
          id: string
          localite: string | null
          nom: string
          notes: string | null
          photo_url: string | null
          quartier: string | null
          tel: string | null
          updated_at: string
          ville: string | null
        }
        Insert: {
          active?: boolean
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          groupe?: string | null
          id?: string
          localite?: string | null
          nom: string
          notes?: string | null
          photo_url?: string | null
          quartier?: string | null
          tel?: string | null
          updated_at?: string
          ville?: string | null
        }
        Update: {
          active?: boolean
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          groupe?: string | null
          id?: string
          localite?: string | null
          nom?: string
          notes?: string | null
          photo_url?: string | null
          quartier?: string | null
          tel?: string | null
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          color: string
          created_at: string
          email: string | null
          id: string
          initials: string
          name: string
          photo_url: string | null
          sub: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          email?: string | null
          id: string
          initials?: string
          name: string
          photo_url?: string | null
          sub?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          email?: string | null
          id?: string
          initials?: string
          name?: string
          photo_url?: string | null
          sub?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          beneficiaire_id: string | null
          beneficiaire_nom: string | null
          created_at: string
          id: string
          methode: string | null
          montant: number
          notes: string | null
          reference: string | null
          type: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          beneficiaire_id?: string | null
          beneficiaire_nom?: string | null
          created_at?: string
          id?: string
          methode?: string | null
          montant: number
          notes?: string | null
          reference?: string | null
          type: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          beneficiaire_id?: string | null
          beneficiaire_nom?: string | null
          created_at?: string
          id?: string
          methode?: string | null
          montant?: number
          notes?: string | null
          reference?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_beneficiaire_id_fkey"
            columns: ["beneficiaire_id"]
            isOneToOne: false
            referencedRelation: "beneficiaires"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "superviseur" | "agent"
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
      app_role: ["admin", "superviseur", "agent"],
    },
  },
} as const
