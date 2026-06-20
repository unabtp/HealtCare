// ═══════════════════════════════════════════════
//  dashboard-common.js · Lógica compartida dashboards
//  Single Responsibility: inicialización, navegación, UI común
//  
//  ARQUITECTURA DOCTORES/PERFILES (2026-06-20):
//  ───────────────────────────────────────────────
//  • 'perfiles'  → Solo datos de AUTENTICACIÓN (id, nombre, apellido, 
//                  email, telefono, dni, rol, activo, last_sign_in_at)
//  • 'doctores'  → Fuente de verdad para DATOS MÉDICOS de TODOS los 
//                  doctores (logueables y no logueables).
//                  Incluye: especialidad, horarios, fechas_disponibles
//  
//  SINCRONIZACIÓN: Al iniciar sesión un doctor (rol='doctor'), se
//  verifica/crea automáticamente su registro en 'doctores' vía
//  syncDoctorToDoctores(). Esto garantiza una sola fuente de verdad.
//  
//  El paciente lee doctores ÚNICAMENTE de la tabla 'doctores'.
//  ═══════════════════════════════════════════════

import { supabase } from '/js/supabaseClient.js'
import { authService } from '/js/services/authService.js'
import { profileService } from '/js/services/profileService.js'
import { redirectService } from '/js/services/redirectService.js'

// ── INICIALIZACIÓN GLOBAL ──
export async function initDashboard(requiredRole) {
  // 1. Verificar sesión
  const session = await authService.getSession()
  if (!session) {
    redirectService.redirectToLogin()
    return null
  }

  // 2. Verificar inactividad
  const inactivity = await authService.checkInactivity(365)
  if (!inactivity.active) {
    await authService.logout()
    redirectService.redirectToLogin()
    return null
  }

  // 3. Obtener perfil y verificar rol
  const perfil = await profileService.getById(session.user.id)
  if (!perfil || perfil.rol !== requiredRole) {
    redirectService.redirectToLogin()
    return null
  }

  // 4. SINCRONIZAR DOCTOR CON TABLA 'doctores' (si aplica)
  //    Esto garantiza que todo doctor logueable exista en la tabla
  //    'doctores' con sus datos médicos, manteniendo una sola fuente
  //    de verdad para disponibilidad, horarios, especialidad, etc.
  if (perfil.rol === 'doctor') {
    await syncDoctorToDoctores(perfil)
  }

  // 5. Actualizar last_sign_in_at
  await profileService.update(session.user.id, {
    last_sign_in_at: new Date().toISOString()
  })

  // 6. Setup UI
  setupMobileMenu()
  setupPushNotifications()
  updateHeader(perfil)

  return perfil
}

// ═══════════════════════════════════════════════
//  SYNC: perfiles → doctores
//  ═══════════════════════════════════════════════
//  Cuando un doctor (con cuenta auth) inicia sesión, esta función
//  garantiza que exista un registro correspondiente en la tabla
//  'doctores'. Si no existe, lo crea. Si existe, actualiza datos
//  básicos (nombre, email, teléfono) sin tocar campos médicos.
//  
//  PRINCIPIO: 'doctores' es la ÚNICA fuente de verdad para:
//  • especialidad, horarios, fechas_disponibles, estado
//  'perfiles' es la ÚNICA fuente de verdad para:
//  • autenticación, rol, last_sign_in_at
//  ═══════════════════════════════════════════════
async function syncDoctorToDoctores(perfil) {
  if (!perfil || perfil.rol !== 'doctor') return

  try {
    // Verificar si el doctor ya existe en tabla 'doctores'
    const { data: existente, error: selectError } = await supabase
      .from('doctores')
      .select('id, especialidad, horarios, fechas_disponibles')
      .eq('id', perfil.id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = "JSON object requested, multiple (or no) rows returned"
      // Es el error esperado cuando no hay filas (single() con 0 resultados)
      console.warn('[syncDoctor] Error consultando doctores:', selectError.message)
    }

    if (!existente) {
      // ── CASO A: Doctor NO existe en 'doctores' → CREAR ──
      console.log('[syncDoctor] Creando registro en doctores para:', perfil.id)

      const { error: insertError } = await supabase
        .from('doctores')
        .insert({
          id: perfil.id,
          nombre: perfil.nombre || '',
          apellido: perfil.apellido || '',
          // Si el perfil tiene especialidad, usarla. Si no, default.
          // Nota: en la práctica, la especialidad se configura en el
          // dashboard del doctor y se guarda en 'doctores'.
          especialidad: perfil.especialidad || 'Pediatría General',
          email: perfil.email || '',
          telefono: perfil.telefono || '',
          activo: true,
          estado: 'libre',
          // 'dias' es legacy (días de semana 0-6). Se mantiene para
          // compatibilidad hacia atrás con doctores que aún no usen
          // fechas_disponibles (días específicos del calendario).
          dias: [1, 2, 3, 4, 5],
          horarios: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
                     '15:00', '15:30', '16:00', '16:30'],
          fechas_disponibles: []
        })

      if (insertError) {
        console.error('[syncDoctor] Error creando doctor:', insertError.message)
      } else {
        console.log('[syncDoctor] Doctor creado exitosamente en tabla doctores')
      }

    } else {
      // ── CASO B: Doctor YA existe en 'doctores' → ACTUALIZAR básicos ──
      // Solo actualizamos datos personales que pueden cambiar en 'perfiles'.
      // NUNCA tocamos: especialidad, horarios, fechas_disponibles, estado
      // porque esos son configurados por el doctor en su dashboard.
      const updates = {}
      if (perfil.nombre !== undefined) updates.nombre = perfil.nombre
      if (perfil.apellido !== undefined) updates.apellido = perfil.apellido
      if (perfil.email !== undefined) updates.email = perfil.email
      if (perfil.telefono !== undefined) updates.telefono = perfil.telefono
      updates.activo = true

      // Solo hacer update si hay algo que actualizar
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('doctores')
          .update(updates)
          .eq('id', perfil.id)

        if (updateError) {
          console.warn('[syncDoctor] Error actualizando doctor:', updateError.message)
        } else {
          console.log('[syncDoctor] Datos básicos del doctor actualizados')
        }
      }
    }
  } catch (err) {
    // El sync NUNCA debe bloquear el login. Si falla, logueamos y seguimos.
    console.error('[syncDoctor] Error inesperado en sync:', err)
  }
}

// ── HEADER ──
function updateHeader(perfil) {
  const saludo = document.getElementById('saludo-usuario')
  const nombre = document.getElementById('perfil-nombre')

  if (saludo) {
    saludo.textContent = `¡Hola! ${perfil.nombre}`
  }
  if (nombre) nombre.textContent = `${perfil.nombre} ${perfil.apellido}`
}

// ── MOBILE MENU ──
function setupMobileMenu() {
  const toggle = document.getElementById('menu-toggle')
  const overlay = document.getElementById('sidebar-overlay')
  const menu = document.getElementById('sidebar-mobile')

  if (!toggle || !overlay || !menu) return

  function abrirSidebar(e) {
    e.preventDefault()
    overlay.classList.add('activo')
    menu.classList.add('activo')
    document.body.style.overflow = 'hidden'
  }

  toggle.addEventListener('click', abrirSidebar)
  toggle.addEventListener('touchstart', abrirSidebar, { passive: false })

  overlay.addEventListener('click', cerrarSidebar)
  menu.querySelectorAll('a, [onclick*="cerrarSidebar"]').forEach(el => {
    el.addEventListener('click', cerrarSidebar)
  })

  // Swipe para cerrar
  let startX = 0
  menu.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX })
  menu.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX
    if (startX - endX > 80) cerrarSidebar()
  })
}

window.cerrarSidebar = function() {
  const overlay = document.getElementById('sidebar-overlay')
  const menu = document.getElementById('sidebar-mobile')
  if (overlay) overlay.classList.remove('activo')
  if (menu) menu.classList.remove('activo')
  document.body.style.overflow = ''
}

// ── PUSH NOTIFICATIONS ──
function setupPushNotifications() {
  // Crear elementos si no existen
  if (!document.getElementById('push-overlay')) {
    const html = `
      <div class="push-overlay" id="push-overlay">
        <div class="push-box" id="push-box">
          <div class="push-icon" id="push-icon">✅</div>
          <div class="push-titulo" id="push-titulo">¡Listo!</div>
          <div class="push-msg" id="push-msg">Operación realizada correctamente.</div>
          <div class="push-actions" id="push-botones">
            <button class="btn btn-prim" onclick="window.pushNotification.close()">Aceptar</button>
          </div>
        </div>
      </div>
    `
    const div = document.createElement('div')
    div.innerHTML = html
    document.body.appendChild(div.firstElementChild)
  }
}

window.mostrarPush = function(tipo, titulo, msg, botones = '') {
  const overlay = document.getElementById('push-overlay')
  const box = document.getElementById('push-box')
  if (!overlay || !box) return

  document.getElementById('push-icon').textContent = tipo === 'ok' ? '✅' : tipo === 'err' ? '❌' : '⚠️'
  document.getElementById('push-titulo').textContent = titulo
  document.getElementById('push-msg').textContent = msg
  document.getElementById('push-botones').innerHTML = botones || '<button class="btn btn-prim" onclick="cerrarPush()">Aceptar</button>'
  box.className = 'push-box ' + tipo
  overlay.classList.add('activo')
}

window.cerrarPush = function() {
  const overlay = document.getElementById('push-overlay')
  if (overlay) overlay.classList.remove('activo')
}

// ── NAVEGACIÓN ──
window.cambiarSubseccion = function(id) {
  document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'))
  if (event && event.currentTarget) event.currentTarget.classList.add('active')
  document.querySelectorAll('.subseccion-dash').forEach(s => s.classList.remove('activa'))
  const target = document.getElementById('sub-' + id)
  if (target) target.classList.add('activa')
}

// ── CERRAR SESIÓN ──
window.cerrarSesion = async function() {
  await authService.logout()
  redirectService.redirectToLogin()
}
