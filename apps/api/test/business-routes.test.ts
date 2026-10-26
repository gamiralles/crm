import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/auth/middleware.js',()=>({
  requireAuth:(req:express.Request,_res:express.Response,next:express.NextFunction)=>{req.auth={userId:'507f1f77bcf86cd799439011',organizationId:'507f1f77bcf86cd799439012',role:'owner'};next()},
  requireOwner:(_req:express.Request,_res:express.Response,next:express.NextFunction)=>next(),
}))
const mocks=vi.hoisted(()=>({claimFind:vi.fn()}))
vi.mock('../src/models/business.js',()=>({
  CalendarEventModel:{},CashTransactionModel:{},ClaimModel:{find:mocks.claimFind},CommissionModel:{},QuoteModel:{},
}))

import { businessRouter } from '../src/business/routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'

const app=express();app.use(express.json());app.use('/business',businessRouter);app.use(errorHandler)

describe('etapas 7 a 9: calendario, actividad comercial y finanzas',()=>{
  it('valida las cotizaciones en servidor antes de persistirlas',async()=>{
    const response=await request(app).post('/business/quotes').send({clientId:'mal',companyId:'mal',line:'',quotedAt:'ayer'})
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
  })

  it('rechaza fechas de calendario invertidas antes de consultar el proveedor',async()=>{
    const response=await request(app).get('/business/calendar').query({from:'2026-10-25T00:00:00Z',to:'2026-10-24T00:00:00Z'})
    expect(response.status).toBe(400)
  })

  it('no permite registrar una comisión como cobrada antes de su conciliación',async()=>{
    const response=await request(app).post('/business/commissions').send({companyId:'507f1f77bcf86cd799439013',period:'2026-10',amount:100,status:'collected'})
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('collection_requires_confirmation')
  })

  it('rechaza informes con períodos invertidos',async()=>{
    const response=await request(app).get('/business/reports').query({from:'2026-10-31',to:'2026-10-01'})
    expect(response.status).toBe(400)
  })

  it('limita las consultas de siniestros a la organización de la sesión',async()=>{
    mocks.claimFind.mockReturnValue({sort:()=>({limit:()=>({populate:()=>({populate:()=>({populate:()=>({lean:()=>Promise.resolve([])})})})})})})
    const response=await request(app).get('/business/claims')
    expect(response.status).toBe(200)
    expect(mocks.claimFind).toHaveBeenCalledWith({organizationId:'507f1f77bcf86cd799439012'})
  })
})
