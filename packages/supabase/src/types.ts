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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
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
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
      lexicon: {
        Row: {
          created_at: string | null
          id: string
          lib: string | null
          updated_at: string | null
          word: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lib?: string | null
          updated_at?: string | null
          word?: string
        }
        Update: {
          created_at?: string | null
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
          prompt: string | null
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
          prompt?: string | null
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
          prompt?: string | null
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
      memories: {
        Row: {
          content: string
          created_at: string
          creator: string
          id: number
          public: boolean
          streak: boolean
        }
        Insert: {
          content: string
          created_at?: string
          creator: string
          id?: number
          public: boolean
          streak: boolean
        }
        Update: {
          content?: string
          created_at?: string
          creator?: string
          id?: number
          public?: boolean
          streak?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "memories_creator_fkey"
            columns: ["creator"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          content: Json
          created_at: string
          creator: string
          id: number
          public: boolean
          tags: string[]
          title: string
        }
        Insert: {
          content?: Json
          created_at?: string
          creator: string
          id?: number
          public?: boolean
          tags?: string[]
          title?: string
        }
        Update: {
          content?: Json
          created_at?: string
          creator?: string
          id?: number
          public?: boolean
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "papers_creator_fkey"
            columns: ["creator"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reads: {
        Row: {
          created_at: string
          id: number
          text: string
          uid: string
        }
        Insert: {
          created_at?: string
          id?: number
          text: string
          uid?: string
        }
        Update: {
          created_at?: string
          id?: number
          text?: string
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "reads_text_fkey"
            columns: ["text"]
            isOneToOne: false
            referencedRelation: "texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reads_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          answers: Json
          created_at: string
          id: number
          paper: number
          question_count: number
          score: number
          user: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: number
          paper: number
          question_count: number
          score: number
          user?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: number
          paper?: number
          question_count?: number
          score?: number
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_paper_fkey"
            columns: ["paper"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_fkey"
            columns: ["user"]
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
        Relationships: [
          {
            foreignKeyName: "subs_uid_fkey"
            columns: ["uid"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      texts: {
        Row: {
          content: string
          created_at: string | null
          has_ebook: boolean
          id: string
          lib: string | null
          no: number | null
          title: string
          topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          has_ebook?: boolean
          id?: string
          lib?: string | null
          no?: number | null
          title?: string
          topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          has_ebook?: boolean
          id?: string
          lib?: string | null
          no?: number | null
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
          plan: string
          token: string | null
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
          plan?: string
          token?: string | null
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
          plan?: string
          token?: string | null
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
