// ═══════════════════════════════════════════════
//  supabase/functions/inactivity-check/index.ts
//  Edge Function: Detecta usuarios inactivos por 365 días
//  Se ejecuta via cron cada 24 horas
//  ═══════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

// Usamos SUPABASE_SECRET_KEYS (JSON) en lugar de SERVICE_ROLE_KEY legacy
function getServiceRoleKey(): string {
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeysJson) {
    try {
      const keys = JSON.parse(secretKeysJson)
      return keys.service_role ?? ''
    } catch {
      return ''
    }
  }
  // Fallback al legacy (por si acaso)
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const serviceRoleKey = getServiceRoleKey()
    if (!serviceRoleKey) {
      throw new Error('No se encontró service_role key. Verificá los secrets.')
    }

    const supabase = createClient(SUPABASE_URL, serviceRoleKey)

    // Buscar usuarios inactivos por más de 365 días
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - 365)
    const fechaLimiteISO = fechaLimite.toISOString()

    const { data: inactivos, error } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, email, last_sign_in_at')
      .lt('last_sign_in_at', fechaLimiteISO)
      .eq('activo', true)

    if (error) {
      console.error('Error consultando inactivos:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    if (!inactivos || inactivos.length === 0) {
      return new Response(JSON.stringify({ message: 'No hay usuarios inactivos', count: 0 }), { status: 200 })
    }

    const resultados = []
    for (const usuario of inactivos) {
      const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: usuario.email,
        options: {
          redirectTo: `${Deno.env.get('SITE_URL') ?? 'https://healthcare-pediatria.vercel.app'}/login.html`
        }
      })

      if (authError) {
        console.error(`Error generando token para ${usuario.email}:`, authError)
        resultados.push({ email: usuario.email, status: 'error', error: authError.message })
        continue
      }

      const { error: emailError } = await supabase.functions.invoke('send-reactivation-email', {
        body: {
          email: usuario.email,
          firstName: usuario.nombre,
          lastName: usuario.apellido,
          token: authData.properties.hashed_token,
          siteUrl: Deno.env.get('SITE_URL') ?? 'https://healthcare-pediatria.vercel.app'
        }
      })

      if (emailError) {
        console.error(`Error enviando email a ${usuario.email}:`, emailError)
        resultados.push({ email: usuario.email, status: 'email_error', error: emailError.message })
        continue
      }

      resultados.push({ email: usuario.email, status: 'notified' })
    }

    return new Response(JSON.stringify({
      message: 'Proceso completado',
      inactivosEncontrados: inactivos.length,
      resultados
    }), { status: 200 })

  } catch (err) {
    console.error('Error inesperado:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
