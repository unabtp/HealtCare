// ═══════════════════════════════════════════════
//  redirectService.js · Servicio de redirección
//  Open/Closed: agregar nuevos roles sin modificar código existente
//  ═══════════════════════════════════════════════

class RedirectService {
  constructor() {
    // Mapa de roles a rutas - fácil de extender
    this.routes = {
      paciente:       '../dashboard/paciente.html',
      doctor:         '../dashboard/doctor.html',
      administracion: '../dashboard/admin.html'
    }
    this.defaultRoute = '../login.html'
    this.fallbackRoute = '../login.html'
  }

  // ── REGISTRAR NUEVA RUTA (extensibilidad) ──
  registerRoute(role, path) {
    this.routes[role] = path
  }

  // ── OBTENER RUTA POR ROL ──
  getRoute(role) {
    return this.routes[role] || this.fallbackRoute
  }

  // ── REDIRIGIR POR ROL ──
  redirect(role) {
    window.location.href = this.getRoute(role)
  }

  // ── REDIRIGIR CON DELAY ──
  redirectDelayed(role, delayMs = 1200) {
    setTimeout(() => this.redirect(role), delayMs)
  }

  // ── REDIRIGIR A LOGIN ──
  redirectToLogin() {
    window.location.href = this.defaultRoute
  }

  // ── VERIFICAR Y REDIRIGIR (protección de páginas) ──
  async protect(requiredRole, authService, profileService) {
    const session = await authService.getSession()
    if (!session) {
      this.redirectToLogin()
      return null
    }

    const perfil = await profileService.getById(session.user.id)
    if (!perfil || perfil.rol !== requiredRole) {
      this.redirectToLogin()
      return null
    }

    return perfil
  }
}

export const redirectService = new RedirectService()
