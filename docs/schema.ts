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
      announcements: {
        Row: {
          audience_code: number
          created_at: string | null
          expiration_date: string
          id_no: number
          message_html: string
          reg_organization: string | null
          start_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          audience_code?: number
          created_at?: string | null
          expiration_date: string
          id_no?: number
          message_html: string
          reg_organization?: string | null
          start_date: string
          title: string
          updated_at?: string | null
        }
        Update: {
          audience_code?: number
          created_at?: string | null
          expiration_date?: string
          id_no?: number
          message_html?: string
          reg_organization?: string | null
          start_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_usage_logs: {
        Row: {
          action_type: string
          assistance_type: string | null
          id: string
          log_date: string
          reg_organization: string
          search_mode: string | null
          search_value: string | null
        }
        Insert: {
          action_type: string
          assistance_type?: string | null
          id?: string
          log_date: string
          reg_organization: string
          search_mode?: string | null
          search_value?: string | null
        }
        Update: {
          action_type?: string
          assistance_type?: string | null
          id?: string
          log_date?: string
          reg_organization?: string
          search_mode?: string | null
          search_value?: string | null
        }
        Relationships: []
      }
      assistance: {
        Row: {
          assist_id: string | null
          assistance: string | null
          category: string | null
          group: string | null
          icon: string | null
          id_no: number
          is_fin_assist: boolean | null
          url_slug: string | null
        }
        Insert: {
          assist_id?: string | null
          assistance?: string | null
          category?: string | null
          group?: string | null
          icon?: string | null
          id_no: number
          is_fin_assist?: boolean | null
          url_slug?: string | null
        }
        Update: {
          assist_id?: string | null
          assistance?: string | null
          category?: string | null
          group?: string | null
          icon?: string | null
          id_no?: number
          is_fin_assist?: boolean | null
          url_slug?: string | null
        }
        Relationships: []
      }
      directory: {
        Row: {
          assist_id: string | null
          assistance: string | null
          client_zip_codes: string | null
          googlemaps: string | null
          hours_notes: string | null
          id_no: number
          is_fin_funding: boolean | null
          is_first_bold: boolean | null
          is_first_red: boolean | null
          org_address1: string | null
          org_address2: string | null
          org_city: string | null
          org_coordinates: string | null
          org_county: string | null
          org_email: string | null
          org_hours: Json | null
          org_neighborhood: string | null
          org_parent: string | null
          org_state: string | null
          org_telephone: string | null
          org_zip_code: string | null
          organization: string | null
          requirements: string | null
          status: string | null
          status_date: string | null
          status_id: number | null
          status_text: string | null
          webpage: string | null
          zip_neighborhoods: string | null
        }
        Insert: {
          assist_id?: string | null
          assistance?: string | null
          client_zip_codes?: string | null
          googlemaps?: string | null
          hours_notes?: string | null
          id_no: number
          is_fin_funding?: boolean | null
          is_first_bold?: boolean | null
          is_first_red?: boolean | null
          org_address1?: string | null
          org_address2?: string | null
          org_city?: string | null
          org_coordinates?: string | null
          org_county?: string | null
          org_email?: string | null
          org_hours?: Json | null
          org_neighborhood?: string | null
          org_parent?: string | null
          org_state?: string | null
          org_telephone?: string | null
          org_zip_code?: string | null
          organization?: string | null
          requirements?: string | null
          status?: string | null
          status_date?: string | null
          status_id?: number | null
          status_text?: string | null
          webpage?: string | null
          zip_neighborhoods?: string | null
        }
        Update: {
          assist_id?: string | null
          assistance?: string | null
          client_zip_codes?: string | null
          googlemaps?: string | null
          hours_notes?: string | null
          id_no?: number
          is_fin_funding?: boolean | null
          is_first_bold?: boolean | null
          is_first_red?: boolean | null
          org_address1?: string | null
          org_address2?: string | null
          org_city?: string | null
          org_coordinates?: string | null
          org_county?: string | null
          org_email?: string | null
          org_hours?: Json | null
          org_neighborhood?: string | null
          org_parent?: string | null
          org_state?: string | null
          org_telephone?: string | null
          org_zip_code?: string | null
          organization?: string | null
          requirements?: string | null
          status?: string | null
          status_date?: string | null
          status_id?: number | null
          status_text?: string | null
          webpage?: string | null
          zip_neighborhoods?: string | null
        }
        Relationships: []
      }
      fin_funding_data: {
        Row: {
          client_zip_code: string | null
          id: number
          org_funding: number | null
          org_parent: string | null
          zip_fin_fund: number | null
          zip_fin_fund_score: number | null
        }
        Insert: {
          client_zip_code?: string | null
          id?: number
          org_funding?: number | null
          org_parent?: string | null
          zip_fin_fund?: number | null
          zip_fin_fund_score?: number | null
        }
        Update: {
          client_zip_code?: string | null
          id?: number
          org_funding?: number | null
          org_parent?: string | null
          zip_fin_fund?: number | null
          zip_fin_fund_score?: number | null
        }
        Relationships: []
      }
      header_config: {
        Row: {
          display_label: string | null
          field_name: string
          format: string | null
          id_no: number
          table: string
          visible: boolean
        }
        Insert: {
          display_label?: string | null
          field_name: string
          format?: string | null
          id_no?: number
          table: string
          visible: boolean
        }
        Update: {
          display_label?: string | null
          field_name?: string
          format?: string | null
          id_no?: number
          table?: string
          visible?: boolean
        }
        Relationships: []
      }
      help_logs: {
        Row: {
          created_at: string | null
          id: number
          question: string
          reg_organization: string | null
          response: string
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          question: string
          reg_organization?: string | null
          response: string
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          question?: string
          reg_organization?: string | null
          response?: string
          session_id?: string | null
        }
        Relationships: []
      }
      llm_search_logs: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: number
          interpretation: string | null
          query: string
          result_count: number | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: number
          interpretation?: string | null
          query: string
          result_count?: number | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: number
          interpretation?: string | null
          query?: string
          result_count?: number | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          contact: string | null
          email: string | null
          fin_funding: number | null
          id_no: number
          org_assistance: string | null
          org_parent: string | null
          organization: string | null
          telephone: string | null
        }
        Insert: {
          contact?: string | null
          email?: string | null
          fin_funding?: number | null
          id_no: number
          org_assistance?: string | null
          org_parent?: string | null
          organization?: string | null
          telephone?: string | null
        }
        Update: {
          contact?: string | null
          email?: string | null
          fin_funding?: number | null
          id_no?: number
          org_assistance?: string | null
          org_parent?: string | null
          organization?: string | null
          telephone?: string | null
        }
        Relationships: []
      }
      registered_organizations: {
        Row: {
          id_no: number
          org_color: string | null
          org_passcode: string | null
          org_phone: string | null
          org_webpage: string | null
          reg_organization: string | null
        }
        Insert: {
          id_no: number
          org_color?: string | null
          org_passcode?: string | null
          org_phone?: string | null
          org_webpage?: string | null
          reg_organization?: string | null
        }
        Update: {
          id_no?: number
          org_color?: string | null
          org_passcode?: string | null
          org_phone?: string | null
          org_webpage?: string | null
          reg_organization?: string | null
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          announcements_count: number | null
          assistance_count: number | null
          directory_count: number | null
          distress_data_count: number | null
          fin_funding_data_count: number | null
          header_config_count: number | null
          id_no: number
          organizations_count: number | null
          registered_organizations_count: number | null
          sync_timestamp: string
          working_poor_data_count: number | null
          zip_code_data_count: number | null
          zip_codes_count: number | null
        }
        Insert: {
          announcements_count?: number | null
          assistance_count?: number | null
          directory_count?: number | null
          distress_data_count?: number | null
          fin_funding_data_count?: number | null
          header_config_count?: number | null
          id_no?: number
          organizations_count?: number | null
          registered_organizations_count?: number | null
          sync_timestamp: string
          working_poor_data_count?: number | null
          zip_code_data_count?: number | null
          zip_codes_count?: number | null
        }
        Update: {
          announcements_count?: number | null
          assistance_count?: number | null
          directory_count?: number | null
          distress_data_count?: number | null
          fin_funding_data_count?: number | null
          header_config_count?: number | null
          id_no?: number
          organizations_count?: number | null
          registered_organizations_count?: number | null
          sync_timestamp?: string
          working_poor_data_count?: number | null
          zip_code_data_count?: number | null
          zip_codes_count?: number | null
        }
        Relationships: []
      }
      usage_log_summary: {
        Row: {
          action_type: string
          assistance_type: string | null
          count: number
          created_at: string | null
          id: string
          month: string
          reg_organization: string
          search_mode: string | null
          search_value: string | null
        }
        Insert: {
          action_type: string
          assistance_type?: string | null
          count?: number
          created_at?: string | null
          id?: string
          month: string
          reg_organization: string
          search_mode?: string | null
          search_value?: string | null
        }
        Update: {
          action_type?: string
          assistance_type?: string | null
          count?: number
          created_at?: string | null
          id?: string
          month?: string
          reg_organization?: string
          search_mode?: string | null
          search_value?: string | null
        }
        Relationships: []
      }
      zip_code_data: {
        Row: {
          amount_per_filing: number | null
          bivariate_map_code: number | null
          claim_amount: number | null
          county: string | null
          dci_catg: string | null
          dci_quin: number | null
          dci_score: number | null
          distress_score: number | null
          evictions_score: number | null
          exclude: number | null
          family_vulnerability_index: number | null
          filings_count: number | null
          fvi_map_code: number | null
          households: number | null
          households_w_children: number | null
          houston_area: string | null
          id: number
          income_ratio: number | null
          median_household_income: number | null
          median_rent: number | null
          neighborhood: string | null
          no_health_insurance: number | null
          no_hs_diploma: number | null
          no_vehicle: number | null
          normal_efficiency_ratio: number | null
          owner_occupancy: number | null
          population: number | null
          population_score: number | null
          poverty_rate: number | null
          snap: number | null
          unemployment_rate: number | null
          vacancy_rate: number | null
          working_poor_score: number | null
          zip_code: string | null
          zip_fin_fund_score: number | null
          zip_fin_funding: number | null
        }
        Insert: {
          amount_per_filing?: number | null
          bivariate_map_code?: number | null
          claim_amount?: number | null
          county?: string | null
          dci_catg?: string | null
          dci_quin?: number | null
          dci_score?: number | null
          distress_score?: number | null
          evictions_score?: number | null
          exclude?: number | null
          family_vulnerability_index?: number | null
          filings_count?: number | null
          fvi_map_code?: number | null
          households?: number | null
          households_w_children?: number | null
          houston_area?: string | null
          id?: number
          income_ratio?: number | null
          median_household_income?: number | null
          median_rent?: number | null
          neighborhood?: string | null
          no_health_insurance?: number | null
          no_hs_diploma?: number | null
          no_vehicle?: number | null
          normal_efficiency_ratio?: number | null
          owner_occupancy?: number | null
          population?: number | null
          population_score?: number | null
          poverty_rate?: number | null
          snap?: number | null
          unemployment_rate?: number | null
          vacancy_rate?: number | null
          working_poor_score?: number | null
          zip_code?: string | null
          zip_fin_fund_score?: number | null
          zip_fin_funding?: number | null
        }
        Update: {
          amount_per_filing?: number | null
          bivariate_map_code?: number | null
          claim_amount?: number | null
          county?: string | null
          dci_catg?: string | null
          dci_quin?: number | null
          dci_score?: number | null
          distress_score?: number | null
          evictions_score?: number | null
          exclude?: number | null
          family_vulnerability_index?: number | null
          filings_count?: number | null
          fvi_map_code?: number | null
          households?: number | null
          households_w_children?: number | null
          houston_area?: string | null
          id?: number
          income_ratio?: number | null
          median_household_income?: number | null
          median_rent?: number | null
          neighborhood?: string | null
          no_health_insurance?: number | null
          no_hs_diploma?: number | null
          no_vehicle?: number | null
          normal_efficiency_ratio?: number | null
          owner_occupancy?: number | null
          population?: number | null
          population_score?: number | null
          poverty_rate?: number | null
          snap?: number | null
          unemployment_rate?: number | null
          vacancy_rate?: number | null
          working_poor_score?: number | null
          zip_code?: string | null
          zip_fin_fund_score?: number | null
          zip_fin_funding?: number | null
        }
        Relationships: []
      }
      zip_codes: {
        Row: {
          city: string | null
          coordinates: string | null
          county: string | null
          county_city_zip: string | null
          county_city_zip_neighborhood: string | null
          distress_score: number | null
          houston_area: string | null
          id_no: number
          neighborhood: string | null
          population: number | null
          state: string | null
          working_poor: number | null
          zip_code: string | null
          zip_link: string | null
        }
        Insert: {
          city?: string | null
          coordinates?: string | null
          county?: string | null
          county_city_zip?: string | null
          county_city_zip_neighborhood?: string | null
          distress_score?: number | null
          houston_area?: string | null
          id_no: number
          neighborhood?: string | null
          population?: number | null
          state?: string | null
          working_poor?: number | null
          zip_code?: string | null
          zip_link?: string | null
        }
        Update: {
          city?: string | null
          coordinates?: string | null
          county?: string | null
          county_city_zip?: string | null
          county_city_zip_neighborhood?: string | null
          distress_score?: number | null
          houston_area?: string | null
          id_no?: number
          neighborhood?: string | null
          population?: number | null
          state?: string | null
          working_poor?: number | null
          zip_code?: string | null
          zip_link?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_daily_usage: {
        Row: {
          action_type: string | null
          assistance_type: string | null
          count: number | null
          log_date: string | null
          reg_organization: string | null
          search_mode: string | null
        }
        Relationships: []
      }
      v_live_stats: {
        Row: {
          top_assistance: string | null
          top_assistance_count: number | null
          top_reg_org: string | null
          top_reg_org_count: number | null
          top_zip: string | null
          top_zip_count: number | null
          total_assistance_searches: number | null
          total_searches: number | null
          total_zip_searches: number | null
        }
        Relationships: []
      }
      v_monthly_usage: {
        Row: {
          action_type: string | null
          assistance_type: string | null
          count: number | null
          month: string | null
          reg_organization: string | null
          search_mode: string | null
        }
        Relationships: []
      }
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
