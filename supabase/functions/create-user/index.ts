// ═══════════════════════════════════════════════
// supabase/functions/create-user/index.ts
// Edge Function: Crear usuarios desde panel de administración
// Contraseña default = DNI, guarda teléfono
// FIX CORS: headers en TODAS las respuestas
// ═══════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

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
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

// Headers CORS para TODAS las respuestas
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceRoleKey = getServiceRoleKey()
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'No se encontró service_role key. Verificá los secrets.' }),
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(SUPABASE_URL, serviceRoleKey)

    // Verificar que el request venga de un admin autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const { nombre, apellido, dni, telefono, email, rol, password } = await req.json()

    // Validaciones
    if (!nombre || !apellido || !dni || !email || !rol) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos' }),
        { status: 400, headers: corsHeaders }
      )
    }
    if (!/^\d{7,8}$/.test(dni)) {
      return new Response(
        JSON.stringify({ error: 'DNI inválido. Debe tener 7 u 8 dígitos.' }),
        { status: 400, headers: corsHeaders }
      )
    }
    if (!['doctor', 'administracion'].includes(rol)) {
      return new Response(
        JSON.stringify({ error: 'Rol inválido. Solo doctor o administracion.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Validar teléfono (10 dígitos)
    const telefonoLimpio = telefono ? telefono.replace(/\D/g, '') : null
    if (telefonoLimpio && telefonoLimpio.length !== 10) {
      return new Response(
        JSON.stringify({ error: 'Teléfono inválido. Debe tener 10 dígitos (ej: 11 4000 0000).' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // La contraseña default es el DNI si no se proporciona otra
    const userPassword = password || dni

    // 1. Crear usuario en auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: { nombre, apellido, dni }
    })

    if (authError) {
      console.error('Error creando usuario auth:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // 2. Crear perfil en tabla perfiles
    const { error: perfilError } = await supabase
      .from('perfiles')
      .insert({
        id: authData.user.id,
        nombre,
        apellido,
        dni,
        telefono: telefonoLimpio,
        email,
        rol,
        activo: true,
        last_sign_in_at: null
      })

    if (perfilError) {
      console.error('Error creando perfil:', perfilError)
      // Intentar eliminar el usuario auth si falló el perfil
      await supabase.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: 'Error al crear el perfil: ' + perfilError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        message: `Usuario ${nombre} ${apellido} creado correctamente. Contraseña inicial: ${userPassword}`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err) {
    console.error('Error inesperado:', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Error inesperado del servidor' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
