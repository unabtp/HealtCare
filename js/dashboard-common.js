// ═══════════════════════════════════════════════
//  dashboard-common.js · Lógica compartida dashboards
//  Single Responsibility: inicialización, navegación, UI común
//  ═══════════════════════════════════════════════

import { supabase } from '../supabaseClient.js'
import { authService } from '../services/authService.js'
import { profileService } from '../services/profileService.js'
import { redirectService } from '../services/redirectService.js'

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

  // 4. Actualizar last_sign_in_at
  await profileService.update(session.user.id, {
    last_sign_in_at: new Date().toISOString()
  })

  // 5. Setup UI
  setupMobileMenu()
  setupPushNotifications()
  updateHeader(perfil)

  return perfil
}

// ── HEADER ──
function updateHeader(perfil) {
  const saludo = document.getElementById('saludo-usuario')
  const nombre = document.getElementById('perfil-nombre')
  const dni = document.getElementById('perfil-dni')

  if (saludo) {
    const hora = new Date().getHours()
    const texto = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
    saludo.textContent = `${texto}, ${perfil.nombre}`
  }
  if (nombre) nombre.textContent = `${perfil.nombre} ${perfil.apellido}`
  if (dni) dni.textContent = perfil.dni
}

// ── MOBILE MENU ──
function setupMobileMenu() {
  const toggle = document.getElementById('menu-toggle')
  const overlay = document.getElementById('sidebar-overlay')
  const menu = document.getElementById('sidebar-mobile')

  if (!toggle || !overlay || !menu) return

  toggle.addEventListener('click', () => {
    overlay.classList.add('activo')
    menu.classList.add('activo')
    document.body.style.overflow = 'hidden'
  })

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
  document.getElementById('push-botones').innerHTML = botones || '<button class="btn btn-prim" onclick="window.pushNotification.close()">Aceptar</button>'
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
