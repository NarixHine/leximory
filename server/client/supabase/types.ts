export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      audio: {
        Row: {
          created_at: string | null
          gen: string | null
          id: string
          lib: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gen?: string | null
          id?: string
          lib?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gen?: string | null
          id?: string
          lib?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_lib_fkey"
            columns: ["lib"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      lexicon: {
        Row: {
          created_at: string | null
          day: string
          id: string
          lib: string | null
          updated_at: string | null
          word: string
        }
        Insert: {
          created_at?: string | null
          day?: string
          id?: string
          lib?: string | null
          updated_at?: string | null
          word?: string
        }
        Update: {
          created_at?: string | null
          day?: string
          id?: string
          lib?: string | null
          updated_at?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexicon_lib_fkey"
            columns: ["lib"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      libraries: {
        Row: {
          access: number
          created_at: string | null
          id: string
          lang: string
          name: string
          org: string | null
          owner: string
          price: number
          shadow: boolean
          starred_by: string[] | null
          updated_at: string | null
        }
        Insert: {
          access?: number
          created_at?: string | null
          id?: string
          lang?: string
          name?: string
          org?: string | null
          owner: string
          price?: number
          shadow?: boolean
          starred_by?: string[] | null
          updated_at?: string | null
        }
        Update: {
          access?: number
          created_at?: string | null
          id?: string
          lang?: string
          name?: string
          org?: string | null
          owner?: string
          price?: number
          shadow?: boolean
          starred_by?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "libraries_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subs: {
        Row: {
          created_at: string | null
          hour: number
          id: string
          subscription: Json
          uid: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hour?: number
          id?: string
          subscription?: Json
          uid?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hour?: number
          id?: string
          subscription?: Json
          uid?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      texts: {
        Row: {
          content: string
          created_at: string | null
          ebook: string | null
          id: string
          lib: string | null
          title: string
          topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          ebook?: string | null
          id?: string
          lib?: string | null
          title?: string
          topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          ebook?: string | null
          id?: string
          lib?: string | null
          title?: string
          topics?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "texts_lib_fkey"
            columns: ["lib"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accent: string
          archived_libs: string[] | null
          created_at: string | null
          creem_id: string | null
          id: string
          last_daily_claim: string | null
          lexicoin: number
          updated_at: string | null
        }
        Insert: {
          accent?: string
          archived_libs?: string[] | null
          created_at?: string | null
          creem_id?: string | null
          id?: string
          last_daily_claim?: string | null
          lexicoin?: number
          updated_at?: string | null
        }
        Update: {
          accent?: string
          archived_libs?: string[] | null
          created_at?: string | null
          creem_id?: string | null
          id?: string
          last_daily_claim?: string | null
          lexicoin?: number
          updated_at?: string | null
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
