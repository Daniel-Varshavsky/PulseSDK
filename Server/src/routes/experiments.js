import { Router } from 'express'
import { authenticateApiKey } from '../middleware/auth.js'
import { authenticateJwt } from '../middleware/authJwt.js'
import {
  createExperiment,
  getExperiments,
  updateExperiment,
  getExperimentResults,
  getExperimentAggregate,
} from '../controllers/experiments.js'

const router = Router()

// Portal routes — JWT protected
router.post('/', authenticateJwt, createExperiment)
router.patch('/:id', authenticateJwt, updateExperiment)

// SDK + portal routes — API key protected
router.get('/', authenticateApiKey, getExperiments)
router.get('/:id/results', authenticateApiKey, getExperimentResults)
router.get('/:id/aggregate', authenticateApiKey, getExperimentAggregate)

export default router