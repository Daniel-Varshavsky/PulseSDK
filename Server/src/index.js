import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'

import appRoutes from './routes/apps.js'
import experimentRoutes from './routes/experiments.js'
import feedbackRoutes from './routes/feedback.js'
import deviceRoutes from './routes/devices.js'
import notificationRoutes from './routes/notifications.js'
import authRoutes from './routes/auth.js'
import exposureRoutes from './routes/exposures.js'
import crashRoutes from './routes/crashes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { runTokenCleanup } from './workers/tokenCleanup.js'

dotenv.config()

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use('/apps', appRoutes)
app.use('/experiments', experimentRoutes)
app.use('/feedback', feedbackRoutes)
app.use('/devices', deviceRoutes)
app.use('/notifications', notificationRoutes)
app.use('/auth', authRoutes)
app.use('/exposure', exposureRoutes)
app.use('/crashes', crashRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Run token cleanup once a day
setInterval(runTokenCleanup, 24 * 60 * 60 * 1000)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`PulseSDK server running on port ${PORT}`)
})

app.use(errorHandler)

export default app