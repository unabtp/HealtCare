// ═══════════════════════════════════════════════
//  dataTable.js · Tablas responsive con modo cards
//  ═══════════════════════════════════════════════

class DataTable {
  constructor(tableSelector, options = {}) {
    this.table = document.querySelector(tableSelector)
    this.container = this.table?.closest('.table-container')
    this.breakpoint = options.breakpoint || 768
    this.cardModeClass = options.cardModeClass || 'table-cards'
    this._init()
  }

  _init() {
    if (!this.table) return
    this._checkMode()
    window.addEventListener('resize', () => this._checkMode())
  }

  _checkMode() {
    if (!this.container) return
    if (window.innerWidth < this.breakpoint) {
      this.container.classList.add(this.cardModeClass)
    } else {
      this.container.classList.remove(this.cardModeClass)
    }
  }

  // Agregar data-labels automáticamente desde los th
  autoLabels() {
    const headers = Array.from(this.table.querySelectorAll('thead th'))
    const labels = headers.map(th => th.textContent.trim())

    this.table.querySelectorAll('tbody tr').forEach(row => {
      row.querySelectorAll('td').forEach((td, i) => {
        if (labels[i]) td.setAttribute('data-label', labels[i])
      })
    })
  }

  refresh() {
    this._checkMode()
  }
}

window.DataTable = DataTable
