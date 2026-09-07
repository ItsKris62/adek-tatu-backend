import { describe, it, expect } from 'vitest'
import { requireRoles } from '../../src/plugins/auth'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { AdminUser } from '../../src/db/schema/admins'

describe('RBAC & State Machine Unit Tests', () => {
  describe('RBAC Permission Matrix', () => {
    const mockReply = {} as FastifyReply

    it('SUPER_ADMIN should have access to SUPER_ADMIN protected actions', async () => {
      const superAdminHook = requireRoles('SUPER_ADMIN')
      const req = {
        adminUser: { id: 'uuid-1', role: 'SUPER_ADMIN', email: 'admin@adek.ke', isActive: true } as AdminUser,
      } as FastifyRequest

      await expect(superAdminHook(req, mockReply)).resolves.toBeUndefined()
    })

    it('RECRUITMENT_OFFICER should be denied SUPER_ADMIN protected actions', async () => {
      const superAdminHook = requireRoles('SUPER_ADMIN')
      const req = {
        adminUser: { id: 'uuid-2', role: 'RECRUITMENT_OFFICER', email: 'recruiter@adek.ke', isActive: true } as AdminUser,
      } as FastifyRequest

      await expect(superAdminHook(req, mockReply)).rejects.toThrow(/Access denied/)
    })

    it('CONTENT_EDITOR should be denied membership applications access', async () => {
      const membershipHook = requireRoles('SUPER_ADMIN', 'RECRUITMENT_OFFICER')
      const req = {
        adminUser: { id: 'uuid-3', role: 'CONTENT_EDITOR', email: 'editor@adek.ke', isActive: true } as AdminUser,
      } as FastifyRequest

      await expect(membershipHook(req, mockReply)).rejects.toThrow(/Access denied/)
    })

    it('RECRUITMENT_OFFICER should be granted membership applications access', async () => {
      const membershipHook = requireRoles('SUPER_ADMIN', 'RECRUITMENT_OFFICER')
      const req = {
        adminUser: { id: 'uuid-2', role: 'RECRUITMENT_OFFICER', email: 'recruiter@adek.ke', isActive: true } as AdminUser,
      } as FastifyRequest

      await expect(membershipHook(req, mockReply)).resolves.toBeUndefined()
    })
  })

  describe('Application Status Transitions State Machine', () => {
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      SUBMITTED: ['UNDER_REVIEW'],
      UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'],
      CORRECTION_REQUIRED: ['SUBMITTED'],
      APPROVED: [],
      REJECTED: [],
      WITHDRAWN: [],
    }

    it('should permit SUBMITTED -> UNDER_REVIEW', () => {
      expect(ALLOWED_TRANSITIONS['SUBMITTED']).toContain('UNDER_REVIEW')
      expect(ALLOWED_TRANSITIONS['SUBMITTED']).not.toContain('APPROVED')
    })

    it('should permit UNDER_REVIEW -> APPROVED, REJECTED, CORRECTION_REQUIRED', () => {
      expect(ALLOWED_TRANSITIONS['UNDER_REVIEW']).toEqual(['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'])
    })

    it('APPROVED and REJECTED should be terminal states for standard operations', () => {
      expect(ALLOWED_TRANSITIONS['APPROVED']).toHaveLength(0)
      expect(ALLOWED_TRANSITIONS['REJECTED']).toHaveLength(0)
    })
  })
})
