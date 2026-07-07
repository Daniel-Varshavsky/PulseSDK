import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // ── Accounts ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10)

  const alice = await prisma.account.create({
    data: { email: 'alice@example.com', name: 'Alice', passwordHash },
  })
  const bob = await prisma.account.create({
    data: { email: 'bob@example.com', name: 'Bob', passwordHash },
  })

  console.log('Created accounts: Alice, Bob')

  // ── App ───────────────────────────────────────────────────────────
  const app = await prisma.app.create({
    data: {
      name: 'MixTape',
      members: {
        create: [
          { accountId: alice.id, role: 'OWNER' },
          { accountId: bob.id, role: 'COLLABORATOR' },
        ],
      },
    },
  })

  console.log(`Created app: MixTape (apiKey: ${app.apiKey})`)

  // ── Experiments ───────────────────────────────────────────────────
  const exp1 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: alice.id,
      name: 'Playlist Sort UI',
      status: 'ACTIVE',
      trafficSplit: [
        { name: 'Variant A', weight: 50 },
        { name: 'Variant B', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Variant A', weight: 50 },
          { name: 'Variant B', weight: 50 },
        ],
      },
    },
    include: { variants: true },
  })

  const exp2 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: bob.id,
      name: 'Now Playing Screen Layout',
      status: 'ACTIVE',
      trafficSplit: [
        { name: 'Classic', weight: 50 },
        { name: 'Minimal', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Classic', weight: 50 },
          { name: 'Minimal', weight: 50 },
        ],
      },
    },
    include: { variants: true },
  })

  const exp3 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: alice.id,
      name: 'Shuffle Button Placement',
      status: 'COMPLETED',
      trafficSplit: [
        { name: 'Top Bar', weight: 50 },
        { name: 'Bottom Bar', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Top Bar', weight: 50 },
          { name: 'Bottom Bar', weight: 50 },
        ],
      },
    },
    include: { variants: true },
  })

  // Multiple choice experiment
  const sortChoices = ['By date added', 'By title A-Z', 'By artist', 'By duration']
  const exp4 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: alice.id,
      name: 'Default Sort Preference',
      status: 'ACTIVE',
      trafficSplit: [
        { name: 'Variant A', weight: 50 },
        { name: 'Variant B', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Variant A', weight: 50, choices: sortChoices },
          { name: 'Variant B', weight: 50, choices: sortChoices },
        ],
      },
    },
    include: { variants: true },
  })

  console.log('Created 4 experiments')

  // ── App Users ─────────────────────────────────────────────────────
  const userNames = [
    'jordan_42', 'maya_music', 'thelastdj', 'neon_beats',
    'cassette_kid', 'vinyl_vibes', 'bassline_bob', 'echo_chamber',
    'rhythm_rex', 'lo_fi_luna',
  ]

  const appUsers = await Promise.all(
    userNames.map(name =>
      prisma.user.create({
        data: { appId: app.id, externalUserId: name },
      })
    )
  )

  await Promise.all(
    appUsers.map((user, i) =>
      prisma.deviceToken.create({
        data: {
          userId: user.id,
          fcmToken: `fcm-token-${user.externalUserId}-${i}`,
        },
      })
    )
  )

  console.log(`Created ${appUsers.length} app users with device tokens`)

  // ── Feedback helpers ──────────────────────────────────────────────
  function randomStarRating(bias = 0) {
    const weights = [1, 2, 4, 6, 5]
    const total = weights.reduce((a, b) => a + b, 0)
    let rand = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i]
      if (rand <= 0) return Math.min(5, Math.max(1, i + 1 + bias))
    }
    return 5
  }

  const comments = [
    'Really intuitive, love it!',
    'Could use some improvements but overall good.',
    'Not sure about this layout.',
    'Much better than before.',
    'Takes some getting used to.',
    'Exactly what I was looking for.',
    'Would prefer more customization options.',
    null, null, null,
  ]

  function randomComment() {
    return comments[Math.floor(Math.random() * comments.length)]
  }

  // ── Feedback: Playlist Sort UI (STAR_RATING + TEXT) ───────────────
  const exp1VariantA = exp1.variants[0]
  const exp1VariantB = exp1.variants[1]

  for (let i = 0; i < 5; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp1VariantA.id,
        type: 'STAR_RATING',
        value: randomStarRating(1),
        comment: randomComment(),
        screenId: 'playlist-screen',
        appVersion: '1.0.0',
      },
    })
  }

  for (let i = 5; i < 10; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp1VariantB.id,
        type: 'STAR_RATING',
        value: randomStarRating(-1),
        comment: randomComment(),
        screenId: 'playlist-screen',
        appVersion: '1.0.0',
      },
    })
  }

  const textResponses = [
    'I love the new sorting options, especially sort by recently added.',
    'Would be great if I could sort by BPM for workout playlists.',
    'The drag to reorder is a bit finicky on smaller screens.',
  ]
  for (let i = 0; i < 3; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp1VariantA.id,
        type: 'TEXT',
        value: textResponses[i],
        screenId: 'playlist-screen',
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created feedback for Playlist Sort UI')

  // ── Feedback: Now Playing Screen Layout (THUMBS) ──────────────────
  const exp2Classic = exp2.variants[0]
  const exp2Minimal = exp2.variants[1]

  for (let i = 0; i < 5; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp2Classic.id,
        type: 'THUMBS',
        value: i < 4,
        comment: i === 4 ? 'Too much going on visually.' : randomComment(),
        screenId: 'now-playing-screen',
        appVersion: '1.0.0',
      },
    })
  }

  for (let i = 5; i < 10; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp2Minimal.id,
        type: 'THUMBS',
        value: i < 8,
        comment: i >= 8 ? 'Feels a bit bare, I miss the album art.' : randomComment(),
        screenId: 'now-playing-screen',
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created feedback for Now Playing Screen Layout')

  // ── Feedback: Shuffle Button Placement (STAR_RATING, completed) ───
  const exp3TopBar = exp3.variants[0]
  const exp3BottomBar = exp3.variants[1]

  for (let i = 0; i < 5; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp3TopBar.id,
        type: 'STAR_RATING',
        value: randomStarRating(),
        comment: randomComment(),
        screenId: 'player-screen',
        appVersion: '1.0.0',
      },
    })
  }

  for (let i = 5; i < 10; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp3BottomBar.id,
        type: 'STAR_RATING',
        value: randomStarRating(1),
        comment: randomComment(),
        screenId: 'player-screen',
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created feedback for Shuffle Button Placement')

  // ── Feedback: Default Sort Preference (MULTIPLE_CHOICE) ──────────
  const exp4VariantA = exp4.variants[0]
  const exp4VariantB = exp4.variants[1]

  // Variant A: users prefer "By date added" and "By title A-Z"
  const exp4AChoices = [0, 0, 1, 0, 2, 1, 0, 3, 1, 0]
  for (let i = 0; i < 5; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp4VariantA.id,
        type: 'MULTIPLE_CHOICE',
        value: exp4AChoices[i],
        screenId: 'playlist-screen',
        appVersion: '1.0.0',
      },
    })
  }

  // Variant B: users more spread out, prefer "By artist"
  const exp4BChoices = [2, 1, 2, 3, 2, 0, 2, 1, 2, 3]
  for (let i = 5; i < 10; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp4VariantB.id,
        type: 'MULTIPLE_CHOICE',
        value: exp4BChoices[i - 5],
        screenId: 'playlist-screen',
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created feedback for Default Sort Preference')

  // ── Standalone text feedback (no experiment) ──────────────────────
  const standaloneTexts = [
    { user: appUsers[0], value: 'It would be great to have a sleep timer feature. Sometimes I fall asleep listening and the music just keeps going all night.', screenId: 'player-screen' },
    { user: appUsers[3], value: 'The app crashes occasionally when I switch between playlists very quickly. Happens maybe once a week.', screenId: 'playlist-screen' },
    { user: appUsers[7], value: 'Love the app overall! One thing — can you add support for importing playlists from Spotify?', screenId: null },
  ]

  for (const { user, value, screenId } of standaloneTexts) {
    await prisma.feedbackResponse.create({
      data: {
        userId: user.id,
        variantId: null,
        type: 'TEXT',
        value,
        screenId: screenId ?? null,
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created standalone text feedback')

  console.log('\n========================================')
  console.log('Seed complete!')
  console.log(`App API Key: ${app.apiKey}`)
  console.log('Login: alice@example.com / password123')
  console.log('Login: bob@example.com / password123')
  console.log('========================================\n')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())