// ═══════════════════════════════════════════════
//  pushNotification.js · Sistema de notificaciones
//  Open/Closed: extensible sin modificar
//  ═══════════════════════════════════════════════

class PushNotification {
  constructor() {
    this.overlay = null
    this.box = null
    this.icon = null
    this.title = null
    this.msg = null
    this.buttons = null
    this._init()
  }

  _init() {
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

    this.overlay = document.getElementById('push-overlay')
    this.box = document.getElementById('push-box')
    this.icon = document.getElementById('push-icon')
    this.title = document.getElementById('push-titulo')
    this.msg = document.getElementById('push-msg')
    this.buttons = document.getElementById('push-botones')
  }

  show(type, title, message, customButtons = '') {
    const icons = { ok: '✅', err: '❌', warn: '⚠️' }
    this.icon.textContent = icons[type] || icons.warn
    this.title.textContent = title
    this.msg.textContent = message
    this.buttons.innerHTML = customButtons || '<button class="btn btn-prim" onclick="window.pushNotification.close()">Aceptar</button>'
    this.box.className = 'push-box ' + type
    this.overlay.classList.add('activo')
  }

  close() {
    this.overlay.classList.remove('activo')
  }

  confirm(title, message, onConfirm, onCancel = null) {
    const buttons = `
      <button class="btn btn-sec" onclick="window.pushNotification.close(); ${onCancel ? onCancel + '()' : ''}">No, volver</button>
      <button class="btn btn-peligro" onclick="window.pushNotification.close(); ${onConfirm}()">Sí, confirmar</button>
    `
    this.show('warn', title, message, buttons)
  }
}

// Singleton global
window.pushNotification = new PushNotification()

// API pública para compatibilidad con código existente
window.mostrarPush = function(type, title, msg, botones = '') {
  window.pushNotification.show(type, title, msg, botones)
}

window.cerrarPush = function() {
  window.pushNotification.close()
}
