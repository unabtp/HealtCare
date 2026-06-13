// ═══════════════════════════════════════════════
//  mobileMenu.js · Menú hamburguesa reutilizable
//  ═══════════════════════════════════════════════

class MobileMenu {
  constructor(options = {}) {
    this.toggleSelector = options.toggle || '#menu-toggle'
    this.overlaySelector = options.overlay || '#sidebar-overlay'
    this.menuSelector = options.menu || '#sidebar-mobile'
    this.toggle = document.querySelector(this.toggleSelector)
    this.overlay = document.querySelector(this.overlaySelector)
    this.menu = document.querySelector(this.menuSelector)

    if (this.toggle && this.overlay && this.menu) {
      this._init()
    }
  }

  _init() {
    this.toggle.addEventListener('click', () => this.open())
    this.overlay.addEventListener('click', () => this.close())

    // Cerrar al hacer click en links del menú
    this.menu.querySelectorAll('a, [onclick*="cerrarSidebar"]').forEach(el => {
      el.addEventListener('click', () => this.close())
    })

    // Swipe para cerrar
    let startX = 0
    this.menu.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX
    })
    this.menu.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX
      if (startX - endX > 80) this.close()
    })
  }

  open() {
    this.overlay.classList.add('activo')
    this.menu.classList.add('activo')
    document.body.style.overflow = 'hidden'
    this.toggle.setAttribute('aria-expanded', 'true')
  }

  close() {
    this.overlay.classList.remove('activo')
    this.menu.classList.remove('activo')
    document.body.style.overflow = ''
    this.toggle.setAttribute('aria-expanded', 'false')
  }
}

// Helper global
window.initMobileMenu = function(options) {
  return new MobileMenu(options)
}
