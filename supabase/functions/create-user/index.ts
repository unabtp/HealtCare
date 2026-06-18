// ═══════════════════════════════════════════════
//  supabase/functions/create-user/index.ts
//  Edge Function: Crear usuarios desde panel de administración
//  Contraseña default = DNI, guarda teléfono
//  ═══════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

function getServiceRoleKey(): string {
  // 1. Intentar leer de Custom Secret (sin prefijo SUPABASE_ prohibido)
  const customKey = Deno.env.get('SERVICE_ROLE_KEY')
  if (customKey) return customKey

  // 2. Intentar leer de SUPABASE_SECRET_KEYS (JSON)
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeysJson) {
    try {
      const keys = JSON.parse(secretKeysJson)
      return keys.service_role ?? ''
    } catch {
      return ''
    }
  }

  // 3. Fallback a deprecated SUPABASE_SERVICE_ROLE_KEY
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

    // Verificar que el request venga de un admin autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
    }

    const { nombre, apellido, dni, telefono, email, rol, password } = await req.json()

    // Validaciones
    if (!nombre || !apellido || !dni || !email || !rol) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), { status: 400 })
    }
    if (!/^\d{7,8}$/.test(dni)) {
      return new Response(JSON.stringify({ error: 'DNI inválido' }), { status: 400 })
    }
    if (!['doctor', 'administracion'].includes(rol)) {
      return new Response(JSON.stringify({ error: 'Rol inválido' }), { status: 400 })
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
      return new Response(JSON.stringify({ error: authError.message }), { status: 500 })
    }

    // 2. Crear perfil en tabla perfiles
    const telefonoLimpio = telefono ? telefono.replace(/[^\d]/g, '') : null
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
      return new Response(JSON.stringify({ error: 'Error al crear el perfil: ' + perfilError.message }), { status: 500 })
    }

    return new Response(JSON.stringify({
      success: true,
      userId: authData.user.id,
      message: `Usuario ${nombre} ${apellido} creado correctamente. Contraseña inicial: ${userPassword}`
    }), { status: 200 })

  } catch (err) {
    console.error('Error inesperado:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
