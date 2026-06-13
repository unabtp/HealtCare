// ═══════════════════════════════════════════════
//  supabaseClient.js · Cliente único de Supabase
//  Single Responsibility: solo crea y exporta el cliente
//  ═══════════════════════════════════════════════

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://zayvsijksoolbksaybjl.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheXZzaWprc29vbGJrc2F5YmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzc2MjUsImV4cCI6MjA5MTM1MzYyNX0.qtTSevotMfsCMFYd7xM5tZ4dcr0bSohkQFXzsYVz7HQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
