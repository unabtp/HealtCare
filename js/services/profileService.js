// ═══════════════════════════════════════════════
//  profileService.js · Servicio de perfiles
//  Single Responsibility: solo CRUD de perfiles
//  ═══════════════════════════════════════════════

import { supabase } from '../supabaseClient.js'

class ProfileService {
  // ── OBTENER PERFIL POR ID ──
  async getById(userId) {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw new Error('No se pudo obtener el perfil')
    return data
  }

  // ── OBTENER PERFIL DEL USUARIO ACTUAL ──
  async getCurrent() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    return this.getById(session.user.id)
  }

  // ── CREAR PERFIL ──
  async create(profile) {
    const { error } = await supabase
      .from('perfiles')
      .insert(profile)
    if (error) throw new Error('Error al crear perfil: ' + error.message)
  }

  // ── ACTUALIZAR PERFIL ──
  async update(userId, updates) {
    const { error } = await supabase
      .from('perfiles')
      .update(updates)
      .eq('id', userId)
    if (error) throw new Error('Error al actualizar perfil')
  }

  // ── LISTAR TODOS ──
  async listAll() {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
    if (error) throw new Error('Error al listar perfiles')
    return data || []
  }

  // ── CONTAR POR ROL ──
  async countByRole(rol) {
    const { count, error } = await supabase
      .from('perfiles')
      .select('*', { count: 'exact', head: true })
      .eq('rol', rol)
    if (error) return 0
    return count || 0
  }
}

export const profileService = new ProfileService()
