// ═══════════════════════════════════════════════
// dashboard-common.js · Lógica compartida de dashboards
// ═══════════════════════════════════════════════

import { supabase } from '/js/supabaseClient.js'
import { authService } from '/js/services/authService.js'
import { profileService } from '/js/services/profileService.js'

// ── INICIALIZACIÓN COMÚN ──
export async function initDashboardCommon() {
  // 1. Verificar sesión
  const session = await authService.getSession()
  if (!session) {
    window.location.href = '/login.html'
    return null
  }

  // 2. Obtener perfil
  let perfil = null
  try {
    perfil = await profileService.getById(session.user.id)
  } catch (e) {
    console.error('Error cargando perfil:', e)
  }

  if (!perfil) {
    window.location.href = '/login.html'
    return null
  }

  // 3. Mostrar saludo con nombre y DNI
  const saludoEl = document.getElementById('dash-saludo')
  const dniEl = document.getElementById('dash-dni')
  if (saludoEl) {
    saludoEl.textContent = `Hola, ${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
  }
  if (dniEl) {
    dniEl.textContent = `DNI: ${perfil.dni || '-'}`
  }

  // 4. Cerrar sesión - quitar emoji puerta
  const logoutBtn = document.getElementById('btn-logout')
  if (logoutBtn) {
    logoutBtn.innerHTML = 'Cerrar sesión'
    logoutBtn.addEventListener('click', async () => {
      await authService.logout()
      window.location.href = '/login.html'
    })
  }

  // 5. Mobile menu - fix para Android (click + touch)
  initMobileMenuFix()

  return perfil
}

// ── FIX MOBILE MENU PARA ANDROID ──
function initMobileMenuFix() {
  const toggle = document.getElementById('menu-toggle')
  const overlay = document.getElementById('sidebar-overlay')
  const menu = document.getElementById('sidebar-mobile')

  if (!toggle || !overlay || !menu) return

  // Remover listeners anteriores si existen
  const newToggle = toggle.cloneNode(true)
  toggle.parentNode.replaceChild(newToggle, toggle)

  function openMenu() {
    overlay.classList.add('activo')
    menu.classList.add('activo')
    document.body.style.overflow = 'hidden'
    newToggle.setAttribute('aria-expanded', 'true')
  }

  function closeMenu() {
    overlay.classList.remove('activo')
    menu.classList.remove('activo')
    document.body.style.overflow = ''
    newToggle.setAttribute('aria-expanded', 'false')
  }

  // Click para desktop + touchstart para Android
  newToggle.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (menu.classList.contains('activo')) {
      closeMenu()
    } else {
      openMenu()
    }
  })

  newToggle.addEventListener('touchstart', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (menu.classList.contains('activo')) {
      closeMenu()
    } else {
      openMenu()
    }
  }, { passive: false })

  overlay.addEventListener('click', closeMenu)
  overlay.addEventListener('touchstart', closeMenu, { passive: true })

  // Cerrar al tocar links del menú
  menu.querySelectorAll('a, [onclick*="cerrarSidebar"]').forEach(el => {
    el.addEventListener('click', closeMenu)
    el.addEventListener('touchstart', closeMenu, { passive: true })
  })

  // Swipe para cerrar
  let startX = 0
  menu.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX
  }, { passive: true })
  menu.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX
    if (startX - endX > 80) closeMenu()
  }, { passive: true })
}

// ── UTILIDADES ──
export function mostrarAlerta(id, mensaje, tipo = 'ok') {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = mensaje
  el.className = `alerta ${tipo} visible`
  setTimeout(() => el.classList.remove('visible'), 4000)
}

export function formatearFecha(fecha) {
  if (!fecha) return '-'
  const d = new Date(fecha)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatearHora(hora) {
  if (!hora) return '-'
  return hora
}
